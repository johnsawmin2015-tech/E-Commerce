import { getProductById } from "./services/product-service.js";
import {
  STORAGE_KEYS,
  getStorageKey,
  isPlainObject,
  readStorage,
  writeStorage,
} from "./storage.js";

export const CART_CHANGE_EVENT = "ecommerce:cart-change";
export const FREE_SHIPPING_THRESHOLD = 150;
export const STANDARD_SHIPPING_COST = 12;

const CART_GUARD = Array.isArray;
let cartRecords;

const roundCurrency = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeVariantText = (value) =>
  String(value ?? "").trim().toLocaleLowerCase("en-US");

const canonicalVariantValue = (value, availableValues) => {
  const normalized = normalizeVariantText(value);
  if (!normalized) return "";
  return availableValues.find(
    (availableValue) => normalizeVariantText(availableValue) === normalized,
  );
};

const normalizeOptions = (product, options) => {
  if (options === undefined || options === null) return null;
  if (!isPlainObject(options)) return null;

  const nestedVariant = isPlainObject(options.variant) ? options.variant : {};
  const source = { ...options, ...nestedVariant };
  delete source.variant;

  if (source.selectedColor !== undefined && source.color === undefined) {
    source.color = source.selectedColor;
  }
  if (source.selectedSize !== undefined && source.size === undefined) {
    source.size = source.selectedSize;
  }
  delete source.selectedColor;
  delete source.selectedSize;

  const normalizedOptions = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    if (!["string", "number", "boolean"].includes(typeof rawValue)) continue;
    const key = String(rawKey).trim().toLocaleLowerCase("en-US").replace(/\s+/g, "-");
    const value = String(rawValue).trim();
    if (key && value) normalizedOptions[key] = value;
  }

  if (normalizedOptions.color) {
    const color = canonicalVariantValue(normalizedOptions.color, product.colors ?? []);
    if (!color) return null;
    normalizedOptions.color = color;
  }
  if (normalizedOptions.size) {
    const size = canonicalVariantValue(normalizedOptions.size, product.sizes ?? []);
    if (!size) return null;
    normalizedOptions.size = size;
  }

  if ((product.colors?.length && !normalizedOptions.color)
    || (product.sizes?.length && !normalizedOptions.size)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(normalizedOptions).sort(([left], [right]) => left.localeCompare(right)),
  );
};

export const createCartItemKey = (productId, options = {}) => {
  const variantPart = Object.entries(options)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `${String(productId)}::${variantPart || "default"}`;
};

const normalizeQuantity = (quantity) => {
  const number = Number(quantity);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};

const sanitizeRecords = (value) => {
  if (!Array.isArray(value)) return [];

  const recordsByKey = new Map();
  const productQuantities = new Map();
  value.forEach((candidate) => {
    if (!isPlainObject(candidate)) return;

    const product = getProductById(candidate.productId);
    if (!product || product.stock <= 0) return;

    const options = normalizeOptions(product, candidate.options);
    const quantity = normalizeQuantity(candidate.quantity);
    if (!options || quantity <= 0) return;

    const itemKey = createCartItemKey(product.id, options);
    const previous = recordsByKey.get(itemKey);
    const usedQuantity = productQuantities.get(product.id) ?? 0;
    const addedQuantity = Math.min(quantity, Math.max(0, product.stock - usedQuantity));
    if (addedQuantity <= 0) return;
    const nextQuantity = addedQuantity + (previous?.quantity ?? 0);

    recordsByKey.set(itemKey, {
      itemKey,
      productId: product.id,
      quantity: nextQuantity,
      options,
      addedAt:
        previous?.addedAt ??
        (typeof candidate.addedAt === "string" ? candidate.addedAt : new Date().toISOString()),
    });
    productQuantities.set(product.id, usedQuantity + addedQuantity);
  });

  return [...recordsByKey.values()];
};

const ensureLoaded = () => {
  if (cartRecords) return cartRecords;

  const storedRecords = readStorage(STORAGE_KEYS.CART, [], CART_GUARD);
  cartRecords = sanitizeRecords(storedRecords);

  // Rewrite sanitized state to discard stale IDs, malformed variants, and
  // quantities that exceed current inventory.
  if (JSON.stringify(cartRecords) !== JSON.stringify(storedRecords)) {
    writeStorage(STORAGE_KEYS.CART, cartRecords, CART_GUARD);
  }

  return cartRecords;
};

const hydrateRecord = (record) => {
  const product = getProductById(record.productId);
  if (!product) return null;

  const unitPrice = Number(product.price) || 0;
  const originalUnitPrice = Number(product.originalPrice) || unitPrice;
  const lineSubtotal = roundCurrency(unitPrice * record.quantity);
  const lineOriginalSubtotal = roundCurrency(originalUnitPrice * record.quantity);

  return {
    ...record,
    options: { ...record.options },
    product,
    name: product.name,
    slug: product.slug,
    image: product.images[0] ?? "",
    unitPrice,
    originalUnitPrice,
    stock: product.stock,
    lineSubtotal,
    lineOriginalSubtotal,
    lineSavings: roundCurrency(lineOriginalSubtotal - lineSubtotal),
  };
};

export const getCart = () => ensureLoaded().map(hydrateRecord).filter(Boolean);

export const getCartSummary = () => {
  const items = getCart();
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = roundCurrency(
    items.reduce((total, item) => total + item.lineSubtotal, 0),
  );
  const originalSubtotal = roundCurrency(
    items.reduce((total, item) => total + item.lineOriginalSubtotal, 0),
  );
  const discount = roundCurrency(originalSubtotal - subtotal);
  const estimatedShipping =
    subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD
      ? 0
      : STANDARD_SHIPPING_COST;
  const estimatedTotal = roundCurrency(subtotal + estimatedShipping);

  return {
    items,
    uniqueItemCount: items.length,
    itemCount,
    totalQuantity: itemCount,
    subtotal,
    originalSubtotal,
    discount,
    savings: discount,
    estimatedShipping,
    shipping: estimatedShipping,
    estimatedTotal,
    total: estimatedTotal,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    currency: "USD",
  };
};

const dispatchCartChange = (reason, itemKey = null) => {
  if (typeof globalThis.dispatchEvent !== "function") return;

  const detail = {
    reason,
    itemKey,
    cart: getCart(),
    summary: getCartSummary(),
  };

  if (typeof globalThis.CustomEvent === "function") {
    globalThis.dispatchEvent(new globalThis.CustomEvent(CART_CHANGE_EVENT, { detail }));
  }
};

const persist = (reason, itemKey = null) => {
  writeStorage(STORAGE_KEYS.CART, ensureLoaded(), CART_GUARD);
  dispatchCartChange(reason, itemKey);
};

export const addToCart = (productId, quantity = 1, options = {}) => {
  const product = getProductById(productId);
  const requestedQuantity = normalizeQuantity(quantity);
  if (!product || product.stock <= 0 || requestedQuantity <= 0) return null;

  const normalizedOptions = normalizeOptions(product, options);
  if (!normalizedOptions) return null;

  const itemKey = createCartItemKey(product.id, normalizedOptions);
  const records = ensureLoaded();
  const existingRecord = records.find((record) => record.itemKey === itemKey);
  const productQuantity = records
    .filter((record) => record.productId === product.id)
    .reduce((total, record) => total + record.quantity, 0);

  if (existingRecord) {
    const previousQuantity = existingRecord.quantity;
    const availableForVariant = Math.max(
      0,
      product.stock - (productQuantity - existingRecord.quantity),
    );
    const nextQuantity = Math.min(
      availableForVariant,
      existingRecord.quantity + requestedQuantity,
    );
    if (nextQuantity !== existingRecord.quantity) {
      existingRecord.quantity = nextQuantity;
      persist("quantity-updated", itemKey);
    }
    const item = getCart().find((entry) => entry.itemKey === itemKey) ?? null;
    return item ? {
      ...item,
      addedQuantity: nextQuantity - previousQuantity,
      reason: nextQuantity > previousQuantity ? "added" : "stock-limit",
    } : null;
  } else {
    const availableQuantity = Math.max(0, product.stock - productQuantity);
    if (availableQuantity <= 0) return null;
    const addedQuantity = Math.min(availableQuantity, requestedQuantity);
    records.push({
      itemKey,
      productId: product.id,
      quantity: addedQuantity,
      options: normalizedOptions,
      addedAt: new Date().toISOString(),
    });
    persist("item-added", itemKey);
    const item = getCart().find((entry) => entry.itemKey === itemKey) ?? null;
    return item ? { ...item, addedQuantity, reason: "added" } : null;
  }
};

export const updateCartItem = (itemKey, quantity) => {
  const records = ensureLoaded();
  const index = records.findIndex((record) => record.itemKey === itemKey);
  if (index < 0) return null;

  const nextQuantity = normalizeQuantity(quantity);
  if (nextQuantity <= 0) {
    records.splice(index, 1);
    persist("item-removed", itemKey);
    return null;
  }

  const product = getProductById(records[index].productId);
  if (!product || product.stock <= 0) {
    records.splice(index, 1);
    persist("stale-item-removed", itemKey);
    return null;
  }

  const otherVariantQuantity = records
    .filter((record, recordIndex) => recordIndex !== index && record.productId === product.id)
    .reduce((total, record) => total + record.quantity, 0);
  const clampedQuantity = Math.min(
    Math.max(0, product.stock - otherVariantQuantity),
    nextQuantity,
  );
  if (clampedQuantity <= 0) {
    records.splice(index, 1);
    persist("stock-limit-item-removed", itemKey);
    return null;
  }
  if (records[index].quantity !== clampedQuantity) {
    records[index].quantity = clampedQuantity;
    persist("quantity-updated", itemKey);
  }

  return getCart().find((item) => item.itemKey === itemKey) ?? null;
};

export const removeCartItem = (itemKey) => {
  const records = ensureLoaded();
  const index = records.findIndex((record) => record.itemKey === itemKey);
  if (index < 0) return false;

  records.splice(index, 1);
  persist("item-removed", itemKey);
  return true;
};

export const clearCart = () => {
  const records = ensureLoaded();
  if (records.length === 0) return false;

  records.splice(0, records.length);
  persist("cart-cleared");
  return true;
};

export const getCartTotals = getCartSummary;

export const subscribeToCart = (listener) => {
  if (typeof globalThis.addEventListener !== "function") return () => {};
  globalThis.addEventListener(CART_CHANGE_EVENT, listener);
  return () => globalThis.removeEventListener(CART_CHANGE_EVENT, listener);
};

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("storage", (event) => {
    if (event.key !== getStorageKey(STORAGE_KEYS.CART)) return;
    cartRecords = sanitizeRecords(readStorage(STORAGE_KEYS.CART, [], CART_GUARD));
    dispatchCartChange("external-storage-update");
  });
}

export default Object.freeze({
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  getCartSummary,
});

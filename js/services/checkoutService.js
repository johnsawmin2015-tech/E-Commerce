import { ANALYTICS_EVENTS, ORDER_STATUS, PAYMENT_METHODS } from "../core/constants.js";
import { AppError, ErrorCodes } from "../core/errors.js";
import { TAX_RATE } from "../core/config.js";
import { CHECKOUT_FIELD_VALIDATORS, isValid } from "../utils/validators.js";
import { uniqueId } from "../utils/helpers.js";
import { getCart, clearCart } from "../cart.js";
import { getProductById } from "./product-service.js";
import { calculatePricing } from "./pricingService.js";
import {
  calculateCouponDiscount,
  normalizeCouponCode,
  validateCoupon,
} from "./couponService.js";
import { couponRepository, orderRepository } from "../data/repositories.js";
import { atomic } from "../data/database.js";
import { getAvailable, hydrateInventory } from "./inventoryService.js";
import { getSession } from "./authService.js";
import { trackEvent } from "./analyticsService.js";
import { STORAGE_KEYS, writeSessionStorage } from "../storage.js";
import { getEstimatedDelivery } from "../order.js";

export const createOrderReference = () => {
  const year = new Date().getFullYear();
  const token = uniqueId("").replaceAll("-", "").slice(-6).toUpperCase();
  return `ORD-${year}-${token}`;
};

export const getCouponByCode = async (code) => {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  const coupons = await couponRepository.getAll();
  return coupons.find((coupon) => coupon.code === normalized) || null;
};

export const quoteCheckout = async ({
  shippingMethod = "standard",
  discountCode = "",
  includeTax = true,
} = {}) => {
  const items = getCart();
  const coupon = discountCode ? await getCouponByCode(discountCode) : null;
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const validation = coupon
    ? validateCoupon(coupon, { items, subtotal })
    : discountCode
      ? { ok: false, reason: "That demonstration code isn’t recognized." }
      : { ok: true, coupon: null };
  const discount = validation.ok ? calculateCouponDiscount(validation.coupon, subtotal, items) : 0;
  const pricing = calculatePricing({
    items: items.map((item) => ({ ...item, unitPrice: item.unitPrice })),
    discount,
    shippingMethod,
    taxRate: TAX_RATE,
    includeTax,
  });
  return {
    ...pricing,
    coupon: validation.ok ? validation.coupon : null,
    couponError: validation.ok ? "" : validation.reason,
    discountCode: validation.ok && validation.coupon ? validation.coupon.code : "",
  };
};

export const validateCheckoutFields = (payload) => {
  const errors = {};
  Object.entries(CHECKOUT_FIELD_VALIDATORS).forEach(([field, validator]) => {
    const result = validator(payload[field] ?? "");
    if (!isValid(result)) errors[field] = result;
  });
  if (!payload.shippingMethod) errors.shippingMethod = "Choose a shipping method.";
  if (!Object.values(PAYMENT_METHODS).includes(payload.paymentMethod)) {
    errors.paymentMethod = "Choose a simulated payment method.";
  }
  return errors;
};

export const placeOrder = async (payload) => {
  const items = getCart();
  if (!items.length) {
    throw new AppError(ErrorCodes.EMPTY_CART, "Your bag is empty. Add a product before checking out.");
  }

  const fieldErrors = validateCheckoutFields(payload);
  if (Object.keys(fieldErrors).length) {
    throw new AppError(ErrorCodes.CHECKOUT_INVALID, "Review the highlighted checkout details.", {
      details: { fieldErrors },
    });
  }

  const checkoutKey = String(payload.idempotencyKey || payload.checkoutKey || "").trim() || uniqueId("checkout");
  const existingOrder = (await orderRepository.getAll()).find((entry) => entry.checkoutKey === checkoutKey);
  if (existingOrder) {
    throw new AppError(ErrorCodes.DUPLICATE_RECORD, "This checkout was already submitted.", { details: { orderId: existingOrder.id } });
  }

  for (const item of items) {
    const product = getProductById(item.productId);
    if (!product) {
      throw new AppError(ErrorCodes.MISSING_PRODUCT, "A product in your bag is no longer available.");
    }
    const available = getAvailable(item.productId);
    const cap = Number.isFinite(available) && available >= 0 ? available : product.stock;
    if (item.quantity > cap) {
      throw new AppError(
        ErrorCodes.INSUFFICIENT_STOCK,
        `${product.name} no longer has enough stock for the quantity in your bag.`,
      );
    }
  }

  const quote = await quoteCheckout({
    shippingMethod: payload.shippingMethod,
    discountCode: payload.discountCode,
    includeTax: true,
  });
  if (payload.discountCode && quote.couponError) {
    throw new AppError(ErrorCodes.INVALID_COUPON, quote.couponError);
  }

  const now = new Date();
  const session = getSession();
  const resolveVariant = (item) => {
    const product = item.product || getProductById(item.productId);
    const options = item.options || {};
    return (product?.variants || []).find((variant) => {
      const colorOk = !options.color || variant.color === options.color;
      const sizeOk = !options.size || variant.size === options.size;
      return colorOk && sizeOk;
    }) || null;
  };
  const order = {
    id: crypto.randomUUID?.() || uniqueId("order"),
    reference: createOrderReference(),
    userId: session?.userId || null,
    checkoutKey,
    inventoryCommitted: true,
    status: ORDER_STATUS.PENDING,
    contact: {
      name: String(payload.name).trim(),
      email: String(payload.email).trim(),
      phone: String(payload.phone).trim(),
    },
    shipping: {
      address: String(payload.address).trim(),
      city: String(payload.city).trim(),
      region: String(payload.region).trim(),
      postalCode: String(payload.postalCode).trim(),
      country: payload.countryName || String(payload.country).trim(),
      countryCode: String(payload.country).trim(),
      method: payload.shippingMethod,
    },
    paymentMethod: payload.paymentMethod,
    estimatedDelivery: getEstimatedDelivery(payload.shippingMethod, now),
    items: items.map((item) => {
      const variant = resolveVariant(item);
      const product = item.product || getProductById(item.productId);
      return {
        id: uniqueId("oi"),
        productId: item.productId,
        variantId: item.variantId || variant?.id || null,
        productNameSnapshot: item.name || product?.name,
        skuSnapshot: variant?.sku || product?.sku || item.productId,
        imageSnapshot: item.image || variant?.image || product?.images?.[0] || "",
        unitPriceSnapshot: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.lineSubtotal,
        options: item.options || {},
      };
    }),
    totals: {
      subtotal: quote.subtotal,
      discount: quote.discount,
      shipping: quote.shipping,
      tax: quote.tax,
      total: quote.total,
    },
    couponCode: quote.discountCode || "",
    timeline: [{ status: ORDER_STATUS.PENDING, at: now.toISOString(), note: "Order created in browser demonstration" }],
    createdAt: now.toISOString(),
  };

  if (!getInventoryReady()) throw new AppError(ErrorCodes.DATABASE_FAILURE, "Inventory is still loading. Try checkout again in a moment.");
  const quantityByProduct = items.reduce((map, item) => map.set(item.productId, (map.get(item.productId) || 0) + item.quantity), new Map());
  await atomic(["orders", "inventory", "inventoryHistory", "products", "coupons"], (tx) => {
    const duplicate = tx.getAll("orders").find((entry) => entry.checkoutKey === order.checkoutKey);
    if (duplicate) throw new AppError(ErrorCodes.DUPLICATE_RECORD, "This checkout was already submitted.", { details: { orderId: duplicate.id } });
    const inventoryRows = tx.getAll("inventory");
    quantityByProduct.forEach((quantity, productId) => {
      const record = inventoryRows.find((entry) => entry.productId === productId);
      if (!record) throw new AppError(ErrorCodes.MISSING_PRODUCT, "Inventory was not found for a product in your bag.");
      const available = Math.max(0, Number(record.onHand) - Number(record.reserved));
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > available) {
        throw new AppError(ErrorCodes.INSUFFICIENT_STOCK, "Stock changed while you were checking out. Review your bag and try again.");
      }
      const next = { ...record, onHand: record.onHand - quantity, updatedAt: now.toISOString() };
      tx.put("inventory", next);
      tx.put("products", { ...(tx.get("products", productId) || {}), stock: Math.max(0, next.onHand - next.reserved), updatedAt: now.toISOString() });
      tx.put("inventoryHistory", {
        id: uniqueId("invh"), inventoryId: record.id, productId, variantId: record.variantId || null,
        action: "sale", delta: -quantity, previousOnHand: record.onHand, newOnHand: next.onHand,
        reserved: next.reserved, reason: "Checkout sale", actorId: session?.userId || "guest", createdAt: now.toISOString(),
      });
    });
    if (quote.coupon) {
      const coupon = tx.get("coupons", quote.coupon.id);
      if (!coupon || validateCoupon(coupon, { items, subtotal }).ok !== true) throw new AppError(ErrorCodes.INVALID_COUPON, "This promotion is no longer available.");
      tx.put("coupons", { ...coupon, usageCount: (Number(coupon.usageCount) || 0) + 1, updatedAt: now.toISOString() });
    }
    tx.put("orders", order);
  });
  await hydrateInventory();

  const confirmation = {
    ...order,
    status: "simulated",
    items: order.items.map((item) => ({
      productId: item.productId,
      name: item.productNameSnapshot,
      image: item.imageSnapshot,
      price: item.unitPriceSnapshot,
      quantity: item.quantity,
      options: item.options,
    })),
  };
  writeSessionStorage(STORAGE_KEYS.LAST_ORDER, confirmation);
  clearCart();

  await trackEvent(ANALYTICS_EVENTS.CHECKOUT_COMPLETED, {
    entityId: order.id,
    metadata: { total: order.totals.total, itemCount: quote.itemCount, couponCode: order.couponCode },
  });
  await trackEvent(ANALYTICS_EVENTS.ORDER_CREATED, {
    entityId: order.id,
    metadata: { total: order.totals.total },
  });
  await trackEvent(ANALYTICS_EVENTS.PURCHASE, {
    entityId: order.id,
    metadata: { total: order.totals.total, itemCount: quote.itemCount },
  });

  return order;
};

let inventoryReady = false;
export const setInventoryReady = (value) => {
  inventoryReady = Boolean(value);
};
const getInventoryReady = () => inventoryReady;

export default Object.freeze({
  quoteCheckout,
  placeOrder,
  validateCheckoutFields,
  createOrderReference,
  getCouponByCode,
});

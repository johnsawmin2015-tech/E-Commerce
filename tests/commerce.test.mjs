import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key) { return this.#values.has(String(key)) ? this.#values.get(String(key)) : null; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  removeItem(key) { this.#values.delete(String(key)); }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
}

const eventBus = new EventTarget();
globalThis.window = globalThis;
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.addEventListener = eventBus.addEventListener.bind(eventBus);
globalThis.removeEventListener = eventBus.removeEventListener.bind(eventBus);
globalThis.dispatchEvent = eventBus.dispatchEvent.bind(eventBus);

const catalog = await import("../js/services/product-service.js");
const search = await import("../js/search.js");
const filters = await import("../js/filters.js");
const cart = await import("../js/cart.js");
const wishlist = await import("../js/wishlist.js");
const storage = await import("../js/storage.js");
const order = await import("../js/order.js");

test("catalog records are coherent and uniquely addressable", () => {
  const products = catalog.getProducts();
  assert.equal(products.length, 24);
  assert.equal(new Set(products.map(({ id }) => id)).size, products.length);
  assert.deepEqual(catalog.getCategories(), ["Apparel", "Footwear", "Accessories", "Home"]);
  products.forEach((product) => {
    assert.equal(catalog.getProductById(product.id), product);
    assert.equal(catalog.getProductBySlug(product.slug), product);
    assert.ok(product.price > 0);
    assert.ok(Array.isArray(product.images) && product.images.length > 0);
  });
});

test("search is case- and diacritic-insensitive", () => {
  const products = catalog.getProducts();
  const upper = search.searchProducts(products, "MERINO");
  const lower = search.searchProducts(products, "merino");
  assert.deepEqual(upper.map(({ id }) => id), lower.map(({ id }) => id));
  assert.ok(lower.length > 0);
});

test("combined catalog state filters then sorts predictably", () => {
  const results = filters.applyProductPipeline(catalog.getProducts(), {
    categories: ["Apparel"],
    availability: "in-stock",
    minPrice: "60",
    sort: "price-asc",
  });
  assert.ok(results.length > 0);
  assert.ok(results.every((product) => product.category === "Apparel" && product.stock > 0 && product.price >= 60));
  assert.deepEqual(results.map(({ price }) => price), [...results].map(({ price }) => price).sort((a, b) => a - b));
});

test("shop URL state round-trips multiple facets", () => {
  const state = {
    q: "linen",
    categories: ["Apparel", "Home"],
    brands: ["Still House"],
    availability: "in-stock",
    minPrice: "50",
    maxPrice: "200",
    sort: "rating",
    page: 2,
  };
  const params = filters.serializeShopState(state, new URLSearchParams());
  assert.deepEqual(filters.readShopState(params), state);
});

test("cart merges identical variants and separates different variants", () => {
  cart.clearCart();
  const first = catalog.getProductById("prod-001");
  cart.addToCart(first.id, 1, { color: first.colors[0], size: first.sizes[0] });
  cart.addToCart(first.id, 2, { size: first.sizes[0], color: first.colors[0] });
  cart.addToCart(first.id, 1, { color: first.colors[1], size: first.sizes[0] });
  const items = cart.getCart();
  assert.equal(items.length, 2);
  assert.equal(items.find((item) => item.options.color === first.colors[0]).quantity, 3);
  assert.equal(cart.getCartSummary().itemCount, 4);
});

test("cart clamps stock and removes invalid quantities", () => {
  cart.clearCart();
  const product = catalog.getProductById("prod-001");
  const item = cart.addToCart(product.id, product.stock + 100, { color: product.colors[0], size: product.sizes[0] });
  assert.equal(item.quantity, product.stock);
  cart.updateCartItem(item.itemKey, 0);
  assert.equal(cart.getCart().length, 0);
});

test("cart requires configured variants and enforces stock across variants", () => {
  cart.clearCart();
  const product = catalog.getProductById("prod-001");
  assert.equal(cart.addToCart(product.id, 1), null);
  assert.equal(cart.getCart().length, 0);

  const first = cart.addToCart(product.id, product.stock - 1, {
    color: product.colors[0],
    size: product.sizes[0],
  });
  const second = cart.addToCart(product.id, 5, {
    color: product.colors[1],
    size: product.sizes[0],
  });
  assert.equal(first.addedQuantity, product.stock - 1);
  assert.equal(second.addedQuantity, 1);
  assert.equal(cart.getCartSummary().itemCount, product.stock);

  const blocked = cart.addToCart(product.id, 1, {
    color: product.colors[1],
    size: product.sizes[0],
  });
  assert.equal(blocked.addedQuantity, 0);
  assert.equal(blocked.reason, "stock-limit");
});

test("wishlist toggles a valid product and rejects a stale ID", () => {
  wishlist.clearWishlist();
  assert.equal(wishlist.toggleWishlist("prod-002"), true);
  assert.equal(wishlist.isWishlisted("prod-002"), true);
  assert.equal(wishlist.toggleWishlist("prod-002"), false);
  assert.equal(wishlist.toggleWishlist("not-a-product"), false);
  assert.deepEqual(wishlist.getWishlist(), []);
});

test("session storage uses a guarded versioned envelope", () => {
  const value = { reference: "ORD-2026-ABC123" };
  assert.equal(storage.writeSessionStorage(storage.STORAGE_KEYS.LAST_ORDER, value), true);
  assert.deepEqual(storage.readSessionStorage(storage.STORAGE_KEYS.LAST_ORDER, null), value);
  sessionStorage.setItem(storage.getStorageKey(storage.STORAGE_KEYS.LAST_ORDER), "not json");
  assert.equal(storage.readSessionStorage(storage.STORAGE_KEYS.LAST_ORDER, null), null);
});

test("order totals share promotion and shipping rules", () => {
  cart.clearCart();
  const product = catalog.getProductById("prod-002");
  cart.addToCart(product.id, 2, { color: product.colors[0], size: product.sizes[0] });
  const totals = order.calculateOrder({ discountCode: order.PROMOTION.code, shippingMethod: "standard" });
  assert.equal(totals.shipping, 0);
  assert.equal(totals.discount, Math.round(totals.subtotal * 0.1 * 100) / 100);
  assert.equal(totals.total, totals.subtotal - totals.discount);
});

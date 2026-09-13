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
const cart = await import("../js/cart.js");

test("cart add, quantity, remove, and totals", () => {
  cart.clearCart();
  const product = catalog.getProductById("prod-001");
  const added = cart.addToCart(product.id, 2, { color: product.colors[0], size: product.sizes[0] });
  assert.equal(added.quantity, 2);
  cart.updateCartItem(added.itemKey, 3);
  assert.equal(cart.getCart()[0].quantity, 3);
  const summary = cart.getCartSummary();
  assert.equal(summary.itemCount, 3);
  assert.equal(summary.subtotal, product.price * 3);
  cart.removeCartItem(added.itemKey);
  assert.equal(cart.getCart().length, 0);
});

test("cart accepts object-shaped color options", () => {
  const product = catalog.getProductById("prod-001");
  const originalColors = product.colors;
  product.colors = originalColors.map((name) => ({ name, hex: "#111111" }));
  cart.clearCart();
  try {
    const added = cart.addToCart(product.id, 1, { color: "Ink", size: product.sizes[0] });
    assert.equal(added?.addedQuantity, 1);
    assert.equal(added.options.color, "Ink");
  } finally {
    product.colors = originalColors;
    cart.clearCart();
  }
});

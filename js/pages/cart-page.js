import { clearCart, getCart, removeCartItem, updateCartItem } from "../cart.js";
import { calculateOrder, getDetailedCart, getPromotionCode, PROMOTION, setPromotionCode } from "../order.js";
import { showToast } from "../ui.js";
import { escapeHtml, formatCurrency, safeImage } from "../utils.js";

const FALLBACK_IMAGE = "assets/images/product-placeholder.svg";
const container = document.querySelector("#cart-page");
let clearIsArmed = false;
let clearTimer;
let pendingFocus = null;

const itemOptions = (options = {}) => Object.entries(options)
  .filter(([, value]) => value)
  .map(([key, value]) => `${key[0].toUpperCase()}${key.slice(1)}: ${value}`)
  .join(" · ");

const findItemControl = (action, itemKey) => [...container.querySelectorAll(`[data-page-cart-${action}]`)]
  .find((button) => button.dataset[`pageCart${action[0].toUpperCase()}${action.slice(1)}`] === itemKey);

const restoreFocus = (request) => {
  if (!request) return;
  window.requestAnimationFrame(() => {
    const requestedControl = request.action && request.itemKey
      ? findItemControl(request.action, request.itemKey)
      : null;
    const fallback = container.querySelector(
      request.empty
        ? ".empty-state h2"
        : "[data-page-cart-remove], [data-clear-cart], #promotion-code, a[href='shop.html']",
    );
    (requestedControl?.disabled ? null : requestedControl || document.querySelector(request.selector) || fallback)?.focus();
  });
};

const render = () => {
  if (!container) return;
  window.clearTimeout(clearTimer);
  clearTimer = undefined;
  clearIsArmed = false;
  const focusRequest = pendingFocus;
  pendingFocus = null;
  const items = getDetailedCart();
  if (!items.length) {
    container.setAttribute("aria-busy", "false");
    container.innerHTML = `
      <div class="empty-state empty-state--page">
        <span class="empty-state__icon" aria-hidden="true">🛍</span>
        <p class="eyebrow">Your bag</p>
        <h2 tabindex="-1">Nothing here yet</h2>
        <p>Discover considered objects and everyday pieces made to stay with you.</p>
        <a class="btn btn--primary" href="shop.html">Explore the collection</a>
      </div>`;
    restoreFocus(focusRequest);
    return;
  }
  const order = calculateOrder({ items, discountCode: getPromotionCode() });
  const productQuantities = new Map();
  items.forEach((item) => {
    productQuantities.set(
      item.product.id,
      (productQuantities.get(item.product.id) ?? 0) + item.quantity,
    );
  });
  container.setAttribute("aria-busy", "false");
  container.innerHTML = `
    <div class="cart-page__toolbar"><p>${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}</p><button class="text-button" type="button" data-clear-cart>Clear bag</button></div>
    <div class="cart-layout">
      <section aria-labelledby="cart-items-title">
        <h2 class="sr-only" id="cart-items-title">Cart items</h2>
        <ul class="cart-list">
          ${items.map((item) => {
            const productQuantity = productQuantities.get(item.product.id) ?? item.quantity;
            const atStockLimit = productQuantity >= item.product.stock;
            return `<li class="cart-item" data-page-cart-item="${escapeHtml(item.itemKey)}">
            <a class="cart-item__image" href="product.html?id=${encodeURIComponent(item.product.id)}">
              <img src="${escapeHtml(safeImage(item.product.images?.[0], FALLBACK_IMAGE))}" alt="${escapeHtml(item.product.name)}" width="240" height="300" loading="lazy" data-image-fallback>
            </a>
            <div class="cart-item__content">
              <div class="cart-item__heading">
                <div><p class="eyebrow">${escapeHtml(item.product.brand)}</p><h3><a href="product.html?id=${encodeURIComponent(item.product.id)}">${escapeHtml(item.product.name)}</a></h3></div>
                <strong>${formatCurrency(item.product.price * item.quantity)}</strong>
              </div>
              ${itemOptions(item.options) ? `<p class="cart-item__options">${escapeHtml(itemOptions(item.options))}</p>` : ""}
              <p class="stock-status stock-status--${atStockLimit ? "low" : "in"}"><span aria-hidden="true"></span>${atStockLimit ? "Maximum available quantity selected" : "In stock"}</p>
              <div class="cart-item__actions">
                <div class="quantity-control" role="group" aria-label="Quantity for ${escapeHtml(item.product.name)}">
                  <button type="button" data-page-cart-decrease="${escapeHtml(item.itemKey)}" aria-label="Decrease quantity for ${escapeHtml(item.product.name)}">−</button>
                  <output aria-live="polite">${item.quantity}</output>
                  <button type="button" data-page-cart-increase="${escapeHtml(item.itemKey)}" aria-label="Increase quantity for ${escapeHtml(item.product.name)}" ${atStockLimit ? "disabled" : ""}>+</button>
                </div>
                <button class="text-button" type="button" data-page-cart-remove="${escapeHtml(item.itemKey)}">Remove</button>
              </div>
            </div>
          </li>`;
          }).join("")}
        </ul>
        <a class="text-link" href="shop.html">← Continue shopping</a>
      </section>
      <aside class="summary-card" aria-labelledby="order-summary-title">
        <h2 id="order-summary-title">Order summary</h2>
        <dl class="summary-card__lines">
          <div><dt>Subtotal</dt><dd>${formatCurrency(order.subtotal)}</dd></div>
          <div><dt>Estimated shipping</dt><dd>${order.shipping === 0 ? "Complimentary" : formatCurrency(order.shipping)}</dd></div>
          ${order.discount ? `<div class="summary-card__discount"><dt>Discount (${PROMOTION.code})</dt><dd>−${formatCurrency(order.discount)}</dd></div>` : ""}
          <div class="summary-card__total"><dt>Estimated total</dt><dd>${formatCurrency(order.total)}</dd></div>
        </dl>
        ${order.subtotal < 150 ? `<p class="shipping-progress">Add ${formatCurrency(150 - order.subtotal)} for complimentary standard delivery.</p>` : `<p class="shipping-progress shipping-progress--complete">You qualify for complimentary standard delivery.</p>`}
        <form class="promotion-form" id="promotion-form" novalidate>
          <label for="promotion-code">Promotion code</label>
          <div><input id="promotion-code" name="promotionCode" autocomplete="off" placeholder="Enter code" value="${escapeHtml(order.discountCode)}"><button class="btn btn--secondary" type="submit">Apply</button></div>
          <p class="form-hint" id="promotion-message" aria-live="polite">Try MORROW10 for this demonstration.</p>
        </form>
        <a class="btn btn--primary btn--large btn--full" href="checkout.html">Proceed to checkout</a>
        <p class="summary-card__notice"><span aria-hidden="true">◎</span> Checkout is simulated. No real payment is processed.</p>
      </aside>
    </div>`;
  restoreFocus(focusRequest);
};

container?.addEventListener("click", (event) => {
  const increase = event.target.closest("[data-page-cart-increase]");
  const decrease = event.target.closest("[data-page-cart-decrease]");
  const remove = event.target.closest("[data-page-cart-remove]");
  if (increase || decrease) {
    const button = increase || decrease;
    const itemKey = button.dataset.pageCartIncrease || button.dataset.pageCartDecrease;
    const item = getCart().find((entry) => entry.itemKey === itemKey);
    if (item) {
      pendingFocus = { action: increase ? "increase" : "decrease", itemKey };
      updateCartItem(itemKey, item.quantity + (increase ? 1 : -1));
    }
    return;
  }
  if (remove) {
    const itemKey = remove.dataset.pageCartRemove;
    const items = getCart();
    const index = items.findIndex((item) => item.itemKey === itemKey);
    const nextItem = items[index + 1] || items[index - 1];
    pendingFocus = nextItem
      ? { action: "remove", itemKey: nextItem.itemKey }
      : { empty: true };
    removeCartItem(itemKey);
    showToast("Item removed from your bag");
    return;
  }
  const clearButton = event.target.closest("[data-clear-cart]");
  if (clearButton) {
    if (!clearIsArmed) {
      clearIsArmed = true;
      clearButton.textContent = "Confirm clear bag";
      clearButton.focus();
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        clearIsArmed = false;
        if (clearButton.isConnected) clearButton.textContent = "Clear bag";
      }, 5000);
      return;
    }
    pendingFocus = { empty: true };
    clearCart();
    setPromotionCode("");
    showToast("Your bag is now empty");
  }
});

container?.addEventListener("submit", (event) => {
  if (event.target.id !== "promotion-form") return;
  event.preventDefault();
  const code = new FormData(event.target).get("promotionCode");
  const valid = setPromotionCode(code);
  if (valid) showToast("MORROW10 applied — 10% off");
  else showToast("That demonstration code isn’t recognized", "error");
  pendingFocus = { selector: "#promotion-message" };
  render();
});

window.addEventListener("ecommerce:cart-change", render);
render();

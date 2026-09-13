import { addToCart } from "../cart.js";
import { getProductById } from "../services/product-service.js";
import { getWishlist, removeFromWishlist } from "../wishlist.js";
import { productCardMarkup, showToast } from "../ui.js";
import { appReady } from "../core/app.js";

await appReady().catch(() => {});

const container = document.querySelector("#wishlist-page");
let focusAfterRender = false;

const defaultOptions = (product) => {
  const options = {};
  if (product.colors?.length) options.color = typeof product.colors[0] === "string" ? product.colors[0] : product.colors[0].name;
  if (product.sizes?.length) options.size = product.sizes[0];
  return options;
};

const render = () => {
  if (!container) return;
  const activeProductId = document.activeElement
    ?.closest?.("[data-product-id]")
    ?.dataset.productId;
  const products = getWishlist().map((id) => getProductById(id)).filter(Boolean);
  container.setAttribute("aria-busy", "false");
  if (!products.length) {
    container.innerHTML = `
      <div class="empty-state empty-state--page">
        <span class="empty-state__icon" aria-hidden="true">♡</span>
        <p class="eyebrow">Saved pieces</p>
        <h2 tabindex="-1">Your wishlist is waiting</h2>
        <p>Keep a considered edit of the pieces you want to revisit.</p>
        <a class="btn btn--primary" href="shop.html">Discover products</a>
      </div>`;
    if (focusAfterRender || activeProductId) {
      focusAfterRender = false;
      window.requestAnimationFrame(() => container.querySelector(".empty-state h2")?.focus());
    }
    return;
  }
  container.innerHTML = `
    <h2 class="sr-only">Saved products</h2>
    ${products.map((product) => `<div class="wishlist-item">${productCardMarkup(product, { showQuickAdd: false })}<button class="btn btn--secondary btn--full wishlist-item__move" type="button" data-move-to-cart="${product.id}" ${product.stock <= 0 ? "disabled" : ""}>${product.stock <= 0 ? "Currently unavailable" : "Move to bag"}</button></div>`).join("")}`;
  if (focusAfterRender || activeProductId) {
    focusAfterRender = false;
    window.requestAnimationFrame(() => {
      const matchingCard = activeProductId
        ? [...container.querySelectorAll("[data-product-id]")]
          .find((card) => card.dataset.productId === activeProductId)
        : null;
      (matchingCard?.querySelector("[data-wishlist-id]")
        || container.querySelector("[data-wishlist-id], [data-move-to-cart]"))?.focus();
    });
  }
};

container?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-move-to-cart]");
  if (!button) return;
  const product = getProductById(button.dataset.moveToCart);
  if (!product || product.stock <= 0) return;
  const result = addToCart(product.id, 1, defaultOptions(product));
  if (!result || result.addedQuantity <= 0) {
    showToast("Maximum available quantity is already in your bag", "error");
    return;
  }
  focusAfterRender = true;
  removeFromWishlist(product.id);
  showToast(`${product.name} moved to your bag`);
});

window.addEventListener("ecommerce:wishlist-change", render);
render();

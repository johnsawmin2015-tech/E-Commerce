import { addToCart } from "../cart.js";
import { getProductById, getRelatedProducts } from "../services/product-service.js";
import { readStorage, writeStorage, STORAGE_KEYS } from "../storage.js";
import { isWishlisted } from "../wishlist.js";
import { openCartDrawer, renderProductGrid, showToast } from "../ui.js";
import { clamp, escapeHtml, formatCurrency, safeImage } from "../utils.js";

const FALLBACK_IMAGE = "assets/images/product-placeholder.svg";
const productView = document.querySelector("#product-view");
const relatedContainer = document.querySelector("#related-products");
const recentContainer = document.querySelector("#recent-products");
const productId = new URLSearchParams(window.location.search).get("id");
const product = getProductById(productId);

const getColorName = (color) => typeof color === "string" ? color : color.name;
const COLOR_PALETTE = {
  ink: "#252525", bone: "#e8e1d6", sage: "#8e9b83", oat: "#d6c7ae",
  charcoal: "#555653", pine: "#384f43", stone: "#a39c92", sand: "#c8aa7e",
  navy: "#26384d", white: "#f7f7f4", black: "#171717", tan: "#a8784f",
  rust: "#a2583f", olive: "#6d714e", clay: "#b87057", natural: "#d1b995",
  smoke: "#777a7a", walnut: "#604b3d", amber: "#b16f32", moss: "#697055",
};
const getColorHex = (color) => {
  if (typeof color !== "string") return color.hex || "#d5cec3";
  return COLOR_PALETTE[color.toLowerCase()] || "#d5cec3";
};

const renderNotFound = () => {
  document.title = "Product not found — Morrow";
  if (productView) {
    productView.innerHTML = `
      <div class="empty-state empty-state--page">
        <span class="empty-state__icon" aria-hidden="true">?</span>
        <p class="eyebrow">Product unavailable</p>
        <h1>We couldn’t find that piece</h1>
        <p>The link may be outdated, or the product is no longer part of the collection.</p>
        <a class="btn btn--primary" href="shop.html">Browse the collection</a>
      </div>`;
  }
  renderProductGrid(relatedContainer, []);
  renderProductGrid(recentContainer, []);
};

if (!product) {
  renderNotFound();
} else {
  document.title = `${product.name} — Morrow`;
  const state = {
    color: "",
    size: "",
    quantity: 1,
    imageIndex: 0,
  };
  const discount = product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;
  const unavailable = product.stock <= 0;
  const images = product.images?.length ? product.images : [FALLBACK_IMAGE];

  const breadcrumbCurrent = document.querySelector("#product-breadcrumb-current");
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = product.name;
  productView.setAttribute("aria-busy", "false");
  productView.innerHTML = `
    <div class="product-detail">
      <section class="product-gallery" aria-label="Product images">
        <div class="product-gallery__main">
          ${product.badge || unavailable ? `<span class="badge">${escapeHtml(unavailable ? "OUT OF STOCK" : product.badge)}</span>` : ""}
          <img id="product-main-image" src="${escapeHtml(safeImage(images[0], FALLBACK_IMAGE))}" alt="${escapeHtml(product.name)}, view 1" width="900" height="1125" data-image-fallback>
        </div>
        ${images.length > 1 ? `<div class="product-gallery__thumbnails" role="group" aria-label="Choose product image">
          ${images.map((image, index) => `<button type="button" class="product-gallery__thumbnail${index === 0 ? " is-active" : ""}" data-gallery-index="${index}" aria-label="Show image ${index + 1}" aria-pressed="${index === 0}">
            <img src="${escapeHtml(safeImage(image, FALLBACK_IMAGE))}" alt="" width="120" height="150" loading="lazy" data-image-fallback>
          </button>`).join("")}
        </div>` : ""}
      </section>

      <section class="product-info" aria-labelledby="product-title">
        <p class="eyebrow">${escapeHtml(product.brand)}</p>
        <h1 id="product-title">${escapeHtml(product.name)}</h1>
        <a class="product-info__rating" href="#product-details" aria-label="Rated ${product.rating} out of 5 from ${product.reviewCount} reviews">
          <span aria-hidden="true">★★★★★</span> ${product.rating} <span>(${product.reviewCount} reviews)</span>
        </a>
        <div class="price price--large" aria-label="Price ${formatCurrency(product.price)}${product.originalPrice ? `, originally ${formatCurrency(product.originalPrice)}` : ""}">
          <span class="price__current">${formatCurrency(product.price)}</span>
          ${product.originalPrice ? `<s class="price__original">${formatCurrency(product.originalPrice)}</s>` : ""}
          ${discount ? `<span class="price__discount">Save ${discount}%</span>` : ""}
        </div>
        <p class="product-info__description">${escapeHtml(product.description)}</p>
        <p class="stock-status stock-status--${unavailable ? "out" : product.stock < 6 ? "low" : "in"}">
          <span aria-hidden="true"></span>${unavailable ? "Out of stock" : product.stock < 6 ? `Low stock — ${product.stock} left` : "In stock and ready to ship"}
        </p>

        ${product.colors?.length ? `<fieldset class="product-options" data-option-group="color">
          <legend>Color <span data-selected-option="color">— Select</span></legend>
          <div class="swatch-grid">
            ${product.colors.map((color) => {
              const name = getColorName(color);
              return `<button type="button" class="color-swatch" data-option="color" data-value="${escapeHtml(name)}" aria-label="${escapeHtml(name)}" aria-pressed="false"><span style="--swatch-color:${escapeHtml(getColorHex(color))}"></span></button>`;
            }).join("")}
          </div>
        </fieldset>` : ""}

        ${product.sizes?.length ? `<fieldset class="product-options" data-option-group="size">
          <legend>Size <span data-selected-option="size">— Select</span></legend>
          <div class="option-grid">
            ${product.sizes.map((size) => `<button type="button" class="option-button" data-option="size" data-value="${escapeHtml(size)}" aria-pressed="false">${escapeHtml(size)}</button>`).join("")}
          </div>
        </fieldset>` : ""}

        <div class="product-purchase">
          <div class="quantity-control" role="group" aria-label="Quantity for ${escapeHtml(product.name)}">
            <button type="button" id="product-quantity-decrease" aria-label="Decrease quantity for ${escapeHtml(product.name)}">−</button>
            <output id="product-quantity" aria-live="polite">1</output>
            <button type="button" id="product-quantity-increase" aria-label="Increase quantity for ${escapeHtml(product.name)}" ${unavailable ? "disabled" : ""}>+</button>
          </div>
          <button class="btn btn--primary btn--large product-purchase__add" type="button" id="product-add-to-cart" ${unavailable ? "disabled" : ""}>
            ${unavailable ? "Unavailable" : "Add to bag"}
          </button>
          <button class="icon-btn icon-btn--bordered" type="button" data-wishlist-id="${escapeHtml(product.id)}" aria-label="${isWishlisted(product.id) ? "Remove" : "Add"} ${escapeHtml(product.name)} ${isWishlisted(product.id) ? "from" : "to"} wishlist" aria-pressed="${isWishlisted(product.id)}"><span aria-hidden="true">${isWishlisted(product.id) ? "♥" : "♡"}</span></button>
        </div>
        <p class="form-hint" id="product-selection-hint" aria-live="polite">${product.colors?.length || product.sizes?.length ? "Choose the available options before adding to your bag." : ""}</p>

        <div class="product-assurances" aria-label="Shopping assurances">
          <div><span aria-hidden="true">◇</span><strong>Complimentary delivery</strong><small>On standard orders over $150</small></div>
          <div><span aria-hidden="true">↺</span><strong>Considered returns</strong><small>30 days in original condition</small></div>
          <div><span aria-hidden="true">◎</span><strong>Secure demo checkout</strong><small>No payment details are stored</small></div>
        </div>

        <div class="product-accordions" id="product-details">
          <details open><summary>Details & care</summary><p>${escapeHtml(product.description)}</p></details>
          <details><summary>Specifications</summary>
            <dl>${Object.entries(product.specifications || {}).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
          </details>
          <details><summary>Delivery & returns</summary><p>Standard delivery takes 4–6 business days. Unused pieces can be returned within 30 days. This storefront is a frontend demonstration and does not create a real shipment.</p></details>
        </div>
      </section>
    </div>`;

  const addButton = document.querySelector("#product-add-to-cart");
  const hint = document.querySelector("#product-selection-hint");
  const updatePurchaseState = () => {
    const missing = [];
    if (product.colors?.length && !state.color) missing.push("color");
    if (product.sizes?.length && !state.size) missing.push("size");
    if (addButton && !unavailable) addButton.disabled = missing.length > 0;
    if (hint) hint.textContent = missing.length ? `Select ${missing.join(" and ")} to continue.` : "Ready to add to your bag.";
  };

  productView.addEventListener("click", (event) => {
    const thumbnail = event.target.closest("[data-gallery-index]");
    if (thumbnail) {
      state.imageIndex = Number(thumbnail.dataset.galleryIndex);
      const mainImage = document.querySelector("#product-main-image");
      if (mainImage) {
        mainImage.src = safeImage(images[state.imageIndex], FALLBACK_IMAGE);
        mainImage.alt = `${product.name}, view ${state.imageIndex + 1}`;
      }
      productView.querySelectorAll("[data-gallery-index]").forEach((button) => {
        const selected = button === thumbnail;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      return;
    }

    const option = event.target.closest("[data-option]");
    if (option) {
      const type = option.dataset.option;
      state[type] = option.dataset.value;
      productView.querySelectorAll(`[data-option="${type}"]`).forEach((button) => {
        const selected = button === option;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      const label = productView.querySelector(`[data-selected-option="${type}"]`);
      if (label) label.textContent = `— ${state[type]}`;
      updatePurchaseState();
      return;
    }

    if (event.target.closest("#product-quantity-decrease")) {
      state.quantity = clamp(state.quantity - 1, 1, product.stock || 1);
      document.querySelector("#product-quantity").textContent = state.quantity;
      return;
    }
    if (event.target.closest("#product-quantity-increase")) {
      state.quantity = clamp(state.quantity + 1, 1, product.stock || 1);
      document.querySelector("#product-quantity").textContent = state.quantity;
      return;
    }
    if (event.target.closest("#product-add-to-cart")) {
      const options = {};
      if (state.color) options.color = state.color;
      if (state.size) options.size = state.size;
      const result = addToCart(product.id, state.quantity, options);
      if (!result || result.addedQuantity <= 0) {
        showToast("Maximum available quantity is already in your bag", "error");
        return;
      }
      const partial = result.addedQuantity < state.quantity;
      showToast(partial
        ? `${result.addedQuantity} added — your bag now contains the available stock`
        : `${product.name} added to your bag`);
      openCartDrawer();
    }
  });

  updatePurchaseState();
  renderProductGrid(relatedContainer, getRelatedProducts(product.id, 4));

  const recentIds = readStorage(STORAGE_KEYS.RECENTLY_VIEWED, []);
  const validRecentIds = (Array.isArray(recentIds) ? recentIds : [])
    .map((id) => String(id ?? "").trim())
    .filter((id, index, ids) => id && id !== product.id && ids.indexOf(id) === index && getProductById(id));
  const recentProducts = validRecentIds
    .map((id) => getProductById(id))
    .slice(0, 4);
  if (recentProducts.length) {
    renderProductGrid(recentContainer, recentProducts);
  } else {
    recentContainer.closest("section")?.setAttribute("hidden", "");
  }
  writeStorage(STORAGE_KEYS.RECENTLY_VIEWED, [
    product.id,
    ...validRecentIds,
  ].slice(0, 8));
}

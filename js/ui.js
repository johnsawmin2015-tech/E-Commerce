import { getProducts, getProductById } from "./services/product-service.js";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  getCartSummary,
} from "./cart.js";
import { getWishlist, isWishlisted, toggleWishlist } from "./wishlist.js";
import { getSearchSuggestions } from "./search.js";
import {
  announce,
  debounce,
  escapeHtml,
  formatCurrency,
  getFocusableElements,
  safeImage,
  setSiblingsInert,
  uniqueId,
} from "./utils.js";

const FALLBACK_IMAGE = "assets/images/product-placeholder.svg";
let toastTimer;
let drawerReturnFocus = null;
let mobileNavReturnFocus = null;

const syncBodyScrollLock = () => {
  const drawerOpen = Boolean(document.querySelector("#cart-drawer:not([hidden])"));
  const mobileNavOpen = Boolean(document.querySelector("#mobile-nav:not([hidden])"));
  const filterOpen = Boolean(document.querySelector(".filter-panel.filters--open"));
  document.body.classList.toggle("is-scroll-locked", drawerOpen || mobileNavOpen || filterOpen);
};

const optionLabel = (options = {}) =>
  Object.entries(options)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key[0].toUpperCase()}${key.slice(1)}: ${value}`)
    .join(" · ");

export const productCardMarkup = (product, { showQuickAdd = true } = {}) => {
  const unavailable = product.stock <= 0;
  const wished = isWishlisted(product.id);
  const discount = product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;
  const badge = unavailable ? "OUT OF STOCK" : product.badge;
  const primaryImage = safeImage(product.images?.[0], FALLBACK_IMAGE);
  const secondaryImage = product.images?.[1]
    ? safeImage(product.images[1], FALLBACK_IMAGE)
    : "";

  return `
    <article class="product-card${unavailable ? " product-card--unavailable" : ""}" data-product-id="${escapeHtml(product.id)}">
      <div class="product-card__media">
        <a class="product-card__media-link" href="product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${escapeHtml(product.name)}">
          <img class="product-card__image" src="${escapeHtml(primaryImage)}" alt="${escapeHtml(product.name)}" loading="lazy" width="640" height="800" data-image-fallback>
          ${secondaryImage ? `<img class="product-card__image product-card__image--secondary" src="${escapeHtml(secondaryImage)}" alt="" loading="lazy" width="640" height="800" data-image-fallback>` : ""}
        </a>
        ${badge ? `<span class="badge product-card__badge">${escapeHtml(badge)}</span>` : ""}
        <button class="icon-btn product-card__wishlist" type="button" data-wishlist-id="${escapeHtml(product.id)}" aria-label="${wished ? "Remove" : "Add"} ${escapeHtml(product.name)} ${wished ? "from" : "to"} wishlist" aria-pressed="${wished}">
          <span aria-hidden="true">${wished ? "♥" : "♡"}</span>
        </button>
        ${showQuickAdd ? `
          <button class="btn btn--light product-card__quick-add" type="button" data-quick-add="${escapeHtml(product.id)}" ${unavailable ? "disabled" : ""}>
            ${unavailable ? "Unavailable" : "Quick add"}
          </button>` : ""}
      </div>
      <div class="product-card__content">
        <p class="product-card__brand">${escapeHtml(product.brand)}</p>
        <h3 class="product-card__title"><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
        <div class="product-card__meta">
          <div class="price" aria-label="Price ${formatCurrency(product.price)}${product.originalPrice ? `, originally ${formatCurrency(product.originalPrice)}` : ""}">
            <span class="price__current">${formatCurrency(product.price)}</span>
            ${product.originalPrice ? `<s class="price__original">${formatCurrency(product.originalPrice)}</s>` : ""}
            ${discount ? `<span class="price__discount">−${discount}%</span>` : ""}
          </div>
          <span class="rating" aria-label="${product.rating} out of 5 stars, ${product.reviewCount} reviews"><span aria-hidden="true">★</span> ${product.rating} <span class="rating__count">(${product.reviewCount})</span></span>
        </div>
      </div>
    </article>`;
};

export const renderProductGrid = (container, products, options = {}) => {
  if (!container) return;
  container.setAttribute("aria-busy", "false");
  if (!products.length) {
    container.innerHTML = `
      <div class="empty-state product-grid__empty">
        <span class="empty-state__icon" aria-hidden="true">◇</span>
        <h2>${escapeHtml(options.emptyTitle || "Nothing matched")}</h2>
        <p>${escapeHtml(options.emptyMessage || "Try adjusting your search or filters.")}</p>
        ${options.emptyAction ? `<button type="button" class="btn btn--primary" data-empty-action>${escapeHtml(options.emptyAction)}</button>` : ""}
      </div>`;
    return;
  }
  container.innerHTML = products.map((product) => productCardMarkup(product, options)).join("");
};

export const showToast = (message, type = "success") => {
  const region = document.querySelector("#toast-region");
  if (!region) return;
  window.clearTimeout(toastTimer);
  const returnFocus = document.activeElement;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast__icon" aria-hidden="true">${type === "error" ? "!" : "✓"}</span><span></span><button type="button" class="toast__close" aria-label="Dismiss notification">×</button>`;
  toast.querySelector("span:last-of-type").textContent = message;
  region.replaceChildren(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  const dismiss = ({ restoreFocus = false } = {}) => {
    window.clearTimeout(toastTimer);
    toast.classList.remove("toast--visible");
    window.setTimeout(() => {
      toast.remove();
      if (
        restoreFocus
        && returnFocus instanceof HTMLElement
        && returnFocus.isConnected
        && !returnFocus.closest("[inert]")
      ) {
        returnFocus.focus();
      }
    }, 180);
  };

  const scheduleDismiss = () => {
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      if (toast.contains(document.activeElement)) return;
      dismiss();
    }, 3600);
  };

  toast.querySelector("button").addEventListener("click", () => dismiss({ restoreFocus: true }));
  toast.addEventListener("focusin", () => window.clearTimeout(toastTimer));
  toast.addEventListener("focusout", (event) => {
    if (!toast.contains(event.relatedTarget)) scheduleDismiss();
  });
  toast.addEventListener("pointerenter", () => window.clearTimeout(toastTimer));
  toast.addEventListener("pointerleave", scheduleDismiss);
  scheduleDismiss();
  announce(message);
};

export const updateHeaderCounts = () => {
  const summary = getCartSummary();
  const cartCount = summary?.itemCount ?? getCart().reduce((sum, item) => sum + item.quantity, 0);
  const wishlistCount = getWishlist().length;
  document.querySelectorAll("[data-cart-count]").forEach((element) => {
    element.textContent = String(cartCount);
    element.hidden = cartCount === 0;
    element.setAttribute("aria-hidden", "true");
    element.closest("a")?.setAttribute(
      "aria-label",
      `Shopping bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`,
    );
  });
  document.querySelectorAll("[data-wishlist-count]").forEach((element) => {
    element.textContent = String(wishlistCount);
    element.hidden = wishlistCount === 0;
    element.setAttribute("aria-hidden", "true");
    element.closest("a")?.setAttribute(
      "aria-label",
      `Wishlist, ${wishlistCount} ${wishlistCount === 1 ? "item" : "items"}`,
    );
  });
};

const getItemProduct = (item) => item.product || getProductById(item.productId);

export const renderCartDrawer = () => {
  const container = document.querySelector("#cart-drawer-content");
  if (!container) return;
  const activeElement = document.activeElement;
  const focusWasInContent = activeElement instanceof HTMLElement && container.contains(activeElement);
  const focusAttributes = ["data-cart-decrease", "data-cart-increase", "data-cart-remove"];
  const focusAttribute = focusAttributes.find((attribute) => activeElement?.hasAttribute?.(attribute));
  const focusValue = focusAttribute ? activeElement.getAttribute(focusAttribute) : "";
  const focusedItemKey = activeElement?.closest?.("[data-cart-item]")?.getAttribute("data-cart-item") || "";

  const restoreDrawerContentFocus = () => {
    if (!focusWasInContent) return;
    requestAnimationFrame(() => {
      let target = focusAttribute
        ? [...container.querySelectorAll(`[${focusAttribute}]`)].find(
          (element) => element.getAttribute(focusAttribute) === focusValue && !element.disabled,
        )
        : null;
      const sameItem = [...container.querySelectorAll("[data-cart-item]")].find(
        (element) => element.getAttribute("data-cart-item") === focusedItemKey,
      );
      target ||= sameItem?.querySelector("[data-cart-decrease]:not([disabled]), [data-cart-remove], a[href]");
      target ||= container.querySelector("[data-cart-decrease]:not([disabled]), [data-cart-remove], a[href]");
      target ||= document.querySelector("#cart-drawer-close");
      target?.focus();
    });
  };

  const cart = getCart();
  const validItems = cart.filter((item) => getItemProduct(item));
  const summary = getCartSummary();
  const quantitiesByProduct = validItems.reduce((quantities, item) => {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
    return quantities;
  }, new Map());

  if (!validItems.length) {
    container.innerHTML = `
      <div class="empty-state empty-state--compact">
        <span class="empty-state__icon" aria-hidden="true">🛍</span>
        <h2>Your bag is empty</h2>
        <p>Explore considered pieces made for everyday life.</p>
        <a class="btn btn--primary btn--full" href="shop.html">Start shopping</a>
      </div>`;
    restoreDrawerContentFocus();
    return;
  }

  container.innerHTML = `
    <ul class="mini-cart" aria-label="Cart items">
      ${validItems.map((item) => {
        const product = getItemProduct(item);
        const aggregateQuantity = quantitiesByProduct.get(item.productId) || item.quantity;
        const maximumSelected = aggregateQuantity >= product.stock;
        return `<li class="mini-cart__item" data-cart-item="${escapeHtml(item.itemKey)}">
          <a href="product.html?id=${encodeURIComponent(product.id)}" class="mini-cart__image-link">
            <img src="${escapeHtml(safeImage(product.images?.[0], FALLBACK_IMAGE))}" alt="" width="112" height="140" loading="lazy" data-image-fallback>
          </a>
          <div class="mini-cart__content">
            <p class="mini-cart__brand">${escapeHtml(product.brand)}</p>
            <a class="mini-cart__name" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a>
            ${optionLabel(item.options) ? `<p class="mini-cart__options">${escapeHtml(optionLabel(item.options))}</p>` : ""}
            ${maximumSelected ? `<p class="mini-cart__stock-limit">Maximum available quantity selected across all options.</p>` : ""}
            <div class="mini-cart__footer">
              <div class="quantity-control quantity-control--small" role="group" aria-label="Quantity for ${escapeHtml(product.name)}">
                <button type="button" data-cart-decrease="${escapeHtml(item.itemKey)}" aria-label="Decrease quantity for ${escapeHtml(product.name)}">−</button>
                <output aria-label="Current quantity ${item.quantity}">${item.quantity}</output>
                <button type="button" data-cart-increase="${escapeHtml(item.itemKey)}" aria-label="Increase quantity for ${escapeHtml(product.name)}${maximumSelected ? ", maximum available quantity selected" : ""}" ${maximumSelected ? "disabled" : ""}>+</button>
              </div>
              <strong>${formatCurrency(product.price * item.quantity)}</strong>
            </div>
            <button class="text-button mini-cart__remove" type="button" data-cart-remove="${escapeHtml(item.itemKey)}">Remove</button>
          </div>
        </li>`;
      }).join("")}
    </ul>
    <div class="drawer__summary">
      <div><span>Subtotal</span><strong>${formatCurrency(summary?.subtotal ?? 0)}</strong></div>
      <p>Shipping and taxes are calculated at checkout.</p>
      <a class="btn btn--primary btn--full" href="checkout.html">Checkout</a>
      <a class="btn btn--secondary btn--full" href="cart.html">View bag</a>
    </div>`;
  restoreDrawerContentFocus();
};

const setDrawerState = (open) => {
  const drawer = document.querySelector("#cart-drawer");
  const backdrop = document.querySelector("#cart-drawer-backdrop");
  if (!drawer || !backdrop) return;

  if (open) {
    drawerReturnFocus = document.activeElement;
    drawer.hidden = false;
    backdrop.hidden = false;
    drawer.classList.add("drawer--open");
    backdrop.classList.add("drawer__backdrop--visible");
    renderCartDrawer();
    drawer.querySelector("#cart-drawer-close")?.focus();
    setSiblingsInert(drawer, true);
  } else {
    setSiblingsInert(drawer, false);
    drawer.classList.remove("drawer--open");
    backdrop.classList.remove("drawer__backdrop--visible");
    drawer.hidden = true;
    backdrop.hidden = true;
  }

  syncBodyScrollLock();
  if (open) {
    window.setTimeout(() => {
      if (!drawer.hidden && !drawer.contains(document.activeElement)) {
        drawer.querySelector("#cart-drawer-close")?.focus();
      }
    }, 40);
  } else {
    if (
      drawerReturnFocus instanceof HTMLElement
      && drawerReturnFocus.isConnected
      && !drawerReturnFocus.closest("[inert]")
    ) {
      drawerReturnFocus.focus();
    }
    drawerReturnFocus = null;
  }
};

export const openCartDrawer = () => setDrawerState(true);
export const closeCartDrawer = () => setDrawerState(false);

const initCartDrawer = () => {
  const drawer = document.querySelector("#cart-drawer");
  if (!drawer) return;
  document.querySelector("#cart-drawer-close")?.addEventListener("click", closeCartDrawer);
  document.querySelector("#cart-drawer-backdrop")?.addEventListener("click", closeCartDrawer);
  drawer.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCartDrawer();
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(drawer);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
};

const initMobileNavigation = () => {
  const toggle = document.querySelector("#mobile-menu-toggle");
  const nav = document.querySelector("#mobile-nav");
  if (!toggle || !nav) return;

  const close = ({ restoreFocus = true } = {}) => {
    if (nav.hidden) return;
    setSiblingsInert(nav, false);
    toggle.setAttribute("aria-expanded", "false");
    nav.hidden = true;
    syncBodyScrollLock();
    if (
      restoreFocus
      && mobileNavReturnFocus instanceof HTMLElement
      && mobileNavReturnFocus.isConnected
      && !mobileNavReturnFocus.closest("[inert]")
    ) {
      mobileNavReturnFocus.focus();
    }
    mobileNavReturnFocus = null;
  };

  const open = () => {
    if (!nav.hidden) return;
    mobileNavReturnFocus = document.activeElement;
    toggle.setAttribute("aria-expanded", "true");
    nav.hidden = false;
    nav.querySelector("#mobile-menu-close, a[href]")?.focus();
    setSiblingsInert(nav, true);
    syncBodyScrollLock();
  };

  toggle.addEventListener("click", () => {
    if (nav.hidden) open();
    else close();
  });
  nav.querySelector("#mobile-menu-close")?.addEventListener("click", () => close());
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) close({ restoreFocus: false });
  });
  nav.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(nav);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !nav.hidden) {
      event.preventDefault();
      close();
    }
  });

  const desktopQuery = window.matchMedia("(min-width: 64rem)");
  const handleDesktopChange = (event) => {
    if (!event.matches || nav.hidden) return;
    const focusWasInNav = nav.contains(document.activeElement);
    close({ restoreFocus: false });
    if (focusWasInNav) document.querySelector(".brand")?.focus();
  };
  desktopQuery.addEventListener?.("change", handleDesktopChange);
};

const initGlobalSearch = () => {
  const form = document.querySelector("#global-search-form");
  const input = document.querySelector("#global-search-input");
  const suggestions = document.querySelector("#search-suggestions");
  if (!form || !input || !suggestions) return;
  const closeSuggestions = () => {
    suggestions.hidden = true;
  };
  const renderSuggestions = debounce(() => {
    const term = input.value.trim();
    if (term.length < 2) {
      closeSuggestions();
      return;
    }
    const matches = getSearchSuggestions(getProducts(), term, 6);
    suggestions.innerHTML = matches.length
      ? `<p class="search-suggestions__label">Suggested products</p><ul>${matches.map((product) => `
          <li><a href="product.html?id=${encodeURIComponent(product.id)}">
            <img src="${escapeHtml(safeImage(product.images?.[0], FALLBACK_IMAGE))}" width="48" height="60" alt="" data-image-fallback>
            <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.brand)} · ${formatCurrency(product.price)}</small></span>
          </a></li>`).join("")}</ul>
        <a class="search-suggestions__all" href="shop.html?q=${encodeURIComponent(term)}">View all results for “${escapeHtml(term)}”</a>`
      : `<div class="search-suggestions__empty"><p>No suggestions for “${escapeHtml(term)}”.</p><a href="shop.html?q=${encodeURIComponent(term)}">Search the full shop</a></div>`;
    suggestions.hidden = false;
  });
  input.addEventListener("input", renderSuggestions);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSuggestions();
  });
  form.addEventListener("focusout", (event) => {
    if (!form.contains(event.relatedTarget)) closeSuggestions();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const term = input.value.trim();
    window.location.href = term ? `shop.html?q=${encodeURIComponent(term)}` : "shop.html";
  });
  document.addEventListener("click", (event) => {
    if (!form.contains(event.target)) closeSuggestions();
  });
};

const initNewsletter = () => {
  document.querySelectorAll("[data-newsletter-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (!input?.checkValidity()) {
        input?.reportValidity();
        return;
      }
      showToast("Thanks — you’re on the Morrow list.");
      form.reset();
    });
  });
};

const handleGlobalActions = async (event) => {
  const wishlistButton = event.target.closest("[data-wishlist-id]");
  if (wishlistButton) {
    const product = getProductById(wishlistButton.dataset.wishlistId);
    if (!product) return;
    const added = toggleWishlist(product.id);
    document.querySelectorAll(`[data-wishlist-id="${CSS.escape(product.id)}"]`).forEach((button) => {
      button.setAttribute("aria-pressed", String(added));
      button.setAttribute("aria-label", `${added ? "Remove" : "Add"} ${product.name} ${added ? "from" : "to"} wishlist`);
      const icon = button.querySelector("span");
      if (icon) icon.textContent = added ? "♥" : "♡";
    });
    showToast(added ? "Saved to your wishlist" : "Removed from your wishlist");
    return;
  }

  const quickAddButton = event.target.closest("[data-quick-add]");
  if (quickAddButton) {
    const product = getProductById(quickAddButton.dataset.quickAdd);
    if (!product || product.stock <= 0) return;
    const options = {};
    if (product.colors?.length) options.color = typeof product.colors[0] === "string" ? product.colors[0] : product.colors[0].name;
    if (product.sizes?.length) options.size = product.sizes[0];
    const result = addToCart(product.id, 1, options);
    if (result?.addedQuantity > 0) {
      showToast(`${product.name} added to your bag`);
      openCartDrawer();
    } else {
      showToast(`All available stock for ${product.name} is already in your bag`, "error");
    }
    return;
  }

  const removeButton = event.target.closest("[data-cart-remove]");
  if (removeButton) {
    removeCartItem(removeButton.dataset.cartRemove);
    showToast("Item removed from your bag");
    window.requestAnimationFrame(() => document.querySelector("#cart-drawer-close")?.focus());
    return;
  }

  const increaseButton = event.target.closest("[data-cart-increase]");
  const decreaseButton = event.target.closest("[data-cart-decrease]");
  if (increaseButton || decreaseButton) {
    const button = increaseButton || decreaseButton;
    const itemKey = button.dataset.cartIncrease || button.dataset.cartDecrease;
    const item = getCart().find((entry) => entry.itemKey === itemKey);
    if (!item) return;
    updateCartItem(itemKey, item.quantity + (increaseButton ? 1 : -1));
    window.requestAnimationFrame(() => {
      const escapedKey = CSS.escape(itemKey);
      const preferred = document.querySelector(
        increaseButton
          ? `[data-cart-increase="${escapedKey}"]`
          : `[data-cart-decrease="${escapedKey}"]`,
      );
      const fallback = document.querySelector(`[data-cart-decrease="${escapedKey}"]`)
        || document.querySelector("#cart-drawer-close");
      (preferred?.disabled ? fallback : preferred || fallback)?.focus();
    });
  }
};

const initImageFallbacks = () => {
  document.addEventListener("error", (event) => {
    const image = event.target.closest?.("img[data-image-fallback]");
    if (!image || image.dataset.fallbackApplied) return;
    image.dataset.fallbackApplied = "true";
    image.src = FALLBACK_IMAGE;
  }, true);
};

export const initializeGlobalUI = () => {
  initMobileNavigation();
  initCartDrawer();
  initGlobalSearch();
  initNewsletter();
  initImageFallbacks();
  document.addEventListener("click", handleGlobalActions);
  window.addEventListener("ecommerce:cart-change", () => {
    updateHeaderCounts();
    renderCartDrawer();
  });
  window.addEventListener("ecommerce:wishlist-change", updateHeaderCounts);
  updateHeaderCounts();
  renderCartDrawer();

  const currentPage = document.body.dataset.page;
  document.querySelectorAll("[data-nav-page]").forEach((link) => {
    if (link.dataset.navPage === currentPage) link.setAttribute("aria-current", "page");
  });
};

export const createOrderReference = () => {
  const year = new Date().getFullYear();
  const token = uniqueId("").replaceAll("-", "").slice(-6).toUpperCase();
  return `ORD-${year}-${token}`;
};

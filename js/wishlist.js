import { getProductById } from "./services/product-service.js";
import {
  STORAGE_KEYS,
  getStorageKey,
  readStorage,
  writeStorage,
} from "./storage.js";
import { emit } from "./core/eventBus.js";
import { EVENT_NAMES } from "./core/constants.js";
import { patchState } from "./core/state.js";

export const WISHLIST_CHANGE_EVENT = "ecommerce:wishlist-change";

const WISHLIST_GUARD = Array.isArray;
let wishlistIds;

const sanitizeIds = (value) => {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((id) => String(id ?? "").trim())
        .filter((id) => id && getProductById(id)),
    ),
  ];
};

const ensureLoaded = () => {
  if (wishlistIds) return wishlistIds;

  const storedIds = readStorage(STORAGE_KEYS.WISHLIST, [], WISHLIST_GUARD);
  wishlistIds = sanitizeIds(storedIds);

  if (JSON.stringify(wishlistIds) !== JSON.stringify(storedIds)) {
    writeStorage(STORAGE_KEYS.WISHLIST, wishlistIds, WISHLIST_GUARD);
  }

  return wishlistIds;
};

export const getWishlist = () => [...ensureLoaded()];

export const getWishlistProducts = () =>
  ensureLoaded().map(getProductById).filter(Boolean);

export const isWishlisted = (id) =>
  ensureLoaded().includes(String(id ?? "").trim());

const dispatchWishlistChange = (reason, productId = null) => {
  const ids = getWishlist();
  patchState({ wishlist: ids });
  if (typeof globalThis.dispatchEvent === "function" && typeof globalThis.CustomEvent === "function") globalThis.dispatchEvent(
    new globalThis.CustomEvent(WISHLIST_CHANGE_EVENT, {
      detail: {
        reason,
        productId,
        ids,
        products: getWishlistProducts(),
        count: ids.length,
      },
    }),
  );
  emit(EVENT_NAMES.WISHLIST_UPDATED, { ids, productId, reason });
};

export const reloadWishlistFromStorage = () => {
  wishlistIds = null;
  return ensureLoaded();
};

const persist = (reason, productId = null) => {
  writeStorage(STORAGE_KEYS.WISHLIST, ensureLoaded(), WISHLIST_GUARD);
  dispatchWishlistChange(reason, productId);
};

/** Toggle a valid product ID and return its new selected state. */
export const toggleWishlist = (id) => {
  const product = getProductById(id);
  if (!product) return false;

  const ids = ensureLoaded();
  const index = ids.indexOf(product.id);
  if (index >= 0) {
    ids.splice(index, 1);
    persist("item-removed", product.id);
    return false;
  }

  ids.push(product.id);
  persist("item-added", product.id);
  return true;
};

export const removeFromWishlist = (id) => {
  const productId = String(id ?? "").trim();
  const ids = ensureLoaded();
  const index = ids.indexOf(productId);
  if (index < 0) return false;

  ids.splice(index, 1);
  persist("item-removed", productId);
  return true;
};

export const clearWishlist = () => {
  const ids = ensureLoaded();
  if (ids.length === 0) return false;

  ids.splice(0, ids.length);
  persist("wishlist-cleared");
  return true;
};

export const subscribeToWishlist = (listener) => {
  if (typeof globalThis.addEventListener !== "function") return () => {};
  globalThis.addEventListener(WISHLIST_CHANGE_EVENT, listener);
  return () => globalThis.removeEventListener(WISHLIST_CHANGE_EVENT, listener);
};

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("storage", (event) => {
    if (event.key !== getStorageKey(STORAGE_KEYS.WISHLIST)) return;
    wishlistIds = sanitizeIds(
      readStorage(STORAGE_KEYS.WISHLIST, [], WISHLIST_GUARD),
    );
    dispatchWishlistChange("external-storage-update");
  });
}

export default Object.freeze({
  getWishlist,
  isWishlisted,
  toggleWishlist,
  removeFromWishlist,
  clearWishlist,
  reloadWishlistFromStorage,
});

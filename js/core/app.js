import { openDatabase } from "../data/database.js";
import { seedDatabase } from "../data/seed.js";
import { hydrateCatalog } from "../services/product-service.js";
import { hydrateInventory } from "../services/inventoryService.js";
import { restoreSession } from "../services/authService.js";
import { hydrateReviewAggregates } from "../services/reviewService.js";
import { patchState } from "./state.js";
import { emit } from "./eventBus.js";
import { EVENT_NAMES } from "./constants.js";
import { getCart, reloadCartFromStorage } from "../cart.js";
import { getWishlist, reloadWishlistFromStorage } from "../wishlist.js";
import { getComparison, reloadComparisonFromStorage } from "../features/comparison/comparisonService.js";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analyticsService.js";
import { hydrateRecommendationSignals } from "../services/recommendationService.js";

let bootPromise;

const setBootStatus = (message) => {
  if (typeof document === "undefined") return;
  let node = document.getElementById("morrow-boot-status");
  if (!message) {
    node?.remove();
    return;
  }
  if (!node) {
    node = document.createElement("div");
    node.id = "morrow-boot-status";
    node.className = "boot-status";
    node.setAttribute("role", "status");
    document.body.prepend(node);
  }
  node.textContent = message;
};

const boot = async () => {
  setBootStatus("Opening Morrow catalog…");
  const database = await openDatabase();
  setBootStatus("Preparing demonstration data…");
  await seedDatabase();
  await hydrateCatalog();
  await hydrateReviewAggregates();
  await hydrateInventory();
  await hydrateRecommendationSignals();
  reloadCartFromStorage();
  reloadWishlistFromStorage();
  reloadComparisonFromStorage();
  const { setInventoryReady: markReady } = await import("../services/checkoutService.js");
  markReady(true);
  await restoreSession();
  patchState({
    ready: true,
    cart: getCart(),
    wishlist: getWishlist(),
    comparison: getComparison(),
  });
  emit(EVENT_NAMES.READY, { ready: true });
  const path = globalThis.location?.pathname || "";
  trackEvent(ANALYTICS_EVENTS.PAGE_VIEW, {
    entityId: path,
    metadata: { path, page: globalThis.document?.body?.dataset?.page || "" },
  }).catch(() => {});
  setBootStatus(database.persistent ? "" : "Temporary session: browser storage is unavailable. Changes will be lost on reload.");
  return true;
};

export const appReady = () => {
  if (!bootPromise) bootPromise = boot().catch((error) => {
    console.error("[Morrow] application bootstrap failed", error);
    patchState({ ready: false, error: error.message });
    setBootStatus("Morrow could not open its local data. Reload to try again. Your saved data has not been reset.");
    if (typeof document !== "undefined") {
      document.querySelectorAll("main button, main input, main select, main textarea").forEach((control) => { control.disabled = true; });
    }
    throw error;
  });
  return bootPromise;
};

export default appReady;

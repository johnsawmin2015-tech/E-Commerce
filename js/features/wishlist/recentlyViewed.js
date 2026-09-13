import { RECENTLY_VIEWED_LIMIT } from "../../core/config.js";
import { recentlyViewedRepository } from "../../data/repositories.js";
import { STORAGE_KEYS, readStorage, writeStorage } from "../../storage.js";
import { getProductById } from "../../services/product-service.js";
import { getActorId } from "../../services/authService.js";
import { createId } from "../../utils/helpers.js";
import { ANALYTICS_EVENTS, trackEvent } from "../../services/analyticsService.js";
import { emit } from "../../core/eventBus.js";
import { EVENT_NAMES } from "../../core/constants.js";

const GUARD = Array.isArray;

export const getRecentlyViewedIds = () => {
  const ids = readStorage(STORAGE_KEYS.RECENTLY_VIEWED, [], GUARD);
  return (Array.isArray(ids) ? ids : [])
    .map((id) => String(id ?? "").trim())
    .filter((id, index, list) => id && list.indexOf(id) === index && getProductById(id));
};

export const getRecentlyViewedProducts = (excludeId, limit = 4) =>
  getRecentlyViewedIds()
    .filter((id) => id !== excludeId)
    .map(getProductById)
    .filter(Boolean)
    .slice(0, limit);

export const recordProductView = async (productId) => {
  const product = getProductById(productId);
  if (!product) return [];
  const ids = [product.id, ...getRecentlyViewedIds().filter((id) => id !== product.id)].slice(
    0,
    RECENTLY_VIEWED_LIMIT,
  );
  writeStorage(STORAGE_KEYS.RECENTLY_VIEWED, ids, GUARD);
  emit(EVENT_NAMES.PRODUCT_VIEWED, { productId: product.id });
  try {
    const actor = getActorId();
    const existing = (await recentlyViewedRepository.getAll()).find(
      (row) => row.userId === actor && row.productId === product.id,
    );
    await recentlyViewedRepository.save({
      id: existing?.id || createId(),
      userId: actor,
      productId: product.id,
      timestamp: new Date().toISOString(),
      viewCount: (existing?.viewCount || 0) + 1,
    });
    await trackEvent(ANALYTICS_EVENTS.PRODUCT_VIEW, { entityId: product.id });
  } catch (error) {
    console.error("[Morrow] recently viewed persistence failed", error);
  }
  return ids;
};

export default Object.freeze({
  getRecentlyViewedIds,
  getRecentlyViewedProducts,
  recordProductView,
});

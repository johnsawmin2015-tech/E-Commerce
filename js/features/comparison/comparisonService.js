import { COMPARISON_MAX, COMPARISON_MIN } from "../../core/config.js";
import { EVENT_NAMES } from "../../core/constants.js";
import { emit } from "../../core/eventBus.js";
import { patchState } from "../../core/state.js";
import { STORAGE_KEYS, readStorage, writeStorage } from "../../storage.js";
import { getProductById } from "../../services/product-service.js";

const GUARD = (value) => Array.isArray(value) && value.every((id) => typeof id === "string");

const load = () => readStorage(STORAGE_KEYS.COMPARISON, [], GUARD).filter((id) => getProductById(id));

let ids = null;

const ensure = () => {
  if (!ids) ids = load();
  return ids;
};

const persist = () => {
  writeStorage(STORAGE_KEYS.COMPARISON, ensure(), GUARD);
  patchState({ comparison: [...ensure()] });
  emit(EVENT_NAMES.COMPARISON_UPDATED, { ids: getComparison() });
};

export const reloadComparisonFromStorage = () => {
  ids = null;
  return ensure();
};

export const getComparison = () => [...ensure()];

export const getComparisonProducts = () => getComparison().map(getProductById).filter(Boolean);

export const isCompared = (productId) => ensure().includes(productId);

export const addToComparison = (productId) => {
  const product = getProductById(productId);
  if (!product) return { ok: false, reason: "missing" };
  const list = ensure();
  if (list.includes(product.id)) return { ok: true, ids: getComparison(), reason: "duplicate" };
  if (list.length >= COMPARISON_MAX) return { ok: false, reason: "limit", max: COMPARISON_MAX };
  list.push(product.id);
  persist();
  return { ok: true, ids: getComparison() };
};

export const removeFromComparison = (productId) => {
  const list = ensure();
  const index = list.indexOf(productId);
  if (index < 0) return false;
  list.splice(index, 1);
  persist();
  return true;
};

export const toggleComparison = (productId) => {
  if (isCompared(productId)) {
    removeFromComparison(productId);
    return false;
  }
  const result = addToComparison(productId);
  return result.ok && result.reason !== "duplicate";
};

export const clearComparison = () => {
  ensure().splice(0, ensure().length);
  persist();
};

export const canCompare = () => getComparison().length >= COMPARISON_MIN;

export default Object.freeze({
  getComparison,
  getComparisonProducts,
  addToComparison,
  removeFromComparison,
  toggleComparison,
  clearComparison,
  canCompare,
  isCompared,
  reloadComparisonFromStorage,
});

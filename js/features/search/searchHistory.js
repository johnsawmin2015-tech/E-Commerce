import { SEARCH_HISTORY_LIMIT } from "../../core/config.js";
import { searchHistoryRepository } from "../../data/repositories.js";
import { STORAGE_KEYS, readStorage, writeStorage } from "../../storage.js";
import { createId } from "../../utils/helpers.js";
import { getActorId } from "../../services/authService.js";
import { ANALYTICS_EVENTS, trackEvent } from "../../services/analyticsService.js";

const GUARD = Array.isArray;

export const getLocalSearchHistory = () =>
  (readStorage(STORAGE_KEYS.SEARCH_HISTORY, [], GUARD) || [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.query))
    .filter(Boolean);

export const rememberSearch = async (query, { resultCount = 0 } = {}) => {
  const term = String(query ?? "").trim();
  if (!term) return getLocalSearchHistory();
  const next = [term, ...getLocalSearchHistory().filter((entry) => entry.toLowerCase() !== term.toLowerCase())]
    .slice(0, SEARCH_HISTORY_LIMIT);
  writeStorage(STORAGE_KEYS.SEARCH_HISTORY, next, GUARD);
  try {
    await searchHistoryRepository.save({
      id: createId(),
      userId: getActorId(),
      query: term,
      resultCount,
      timestamp: new Date().toISOString(),
    });
    await trackEvent(ANALYTICS_EVENTS.SEARCH, {
      entityId: term,
      metadata: { query: term, resultCount },
    });
  } catch (error) {
    console.error("[Morrow] search history was not stored", error);
  }
  return next;
};

export const popularSearches = async (limit = 6) => {
  const rows = await searchHistoryRepository.getAll();
  const counts = rows.reduce((map, row) => {
    const key = String(row.query || "").trim().toLowerCase();
    if (!key) return map;
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([query, count]) => ({ query, count }));
};

export const clearSearchHistory = () => {
  writeStorage(STORAGE_KEYS.SEARCH_HISTORY, [], GUARD);
};

export default Object.freeze({
  getLocalSearchHistory,
  rememberSearch,
  popularSearches,
  clearSearchHistory,
});

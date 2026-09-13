import { emit } from "./eventBus.js";
import { EVENT_NAMES } from "./constants.js";

const listeners = new Set();

const initialState = () => ({
  ready: false,
  currentUser: null,
  session: null,
  cart: [],
  wishlist: [],
  comparison: [],
  filters: {},
  searchQuery: "",
  notifications: [],
  ui: {
    theme: "light",
    reducedMotion: false,
  },
});

let state = initialState();

export const getState = () => structuredClone(state);

export const getCurrentUser = () => structuredClone(state.currentUser);

export const patchState = (partial) => {
  state = { ...state, ...structuredClone(partial) };
  listeners.forEach((listener) => {
    try { listener(getState(), structuredClone(partial)); }
    catch (error) { console.error("[Morrow state] subscriber failed", error); }
  });
  emit(EVENT_NAMES.STATE_CHANGED, { state: getState(), partial: structuredClone(partial) });
  return getState();
};

export const subscribe = (listener) => {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetState = () => {
  return patchState(initialState());
};

export default Object.freeze({
  getState,
  patchState,
  subscribe,
  resetState,
});

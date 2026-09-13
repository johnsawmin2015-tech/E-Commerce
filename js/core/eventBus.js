/**
 * Lightweight publish/subscribe bus.
 *
 * Modules should communicate through named events instead of importing
 * each other for side effects. Window CustomEvents are also dispatched so
 * existing page controllers can keep listening on `window`.
 */

const listeners = new Map();

const canUseWindow = () =>
  typeof globalThis.dispatchEvent === "function" &&
  typeof globalThis.CustomEvent === "function";

export const on = (eventName, handler) => {
  if (typeof handler !== "function") return () => {};
  const set = listeners.get(eventName) ?? new Set();
  set.add(handler);
  listeners.set(eventName, set);
  return () => off(eventName, handler);
};

export const off = (eventName, handler) => {
  listeners.get(eventName)?.delete(handler);
};

export const emit = (eventName, detail = {}) => {
  const snapshot = [...(listeners.get(eventName) ?? [])];
  snapshot.forEach((handler) => {
    try {
      handler(detail);
    } catch (error) {
      console.error(`[Morrow eventBus] handler failed for ${eventName}`, error);
    }
  });

  if (canUseWindow()) {
    globalThis.dispatchEvent(new globalThis.CustomEvent(eventName, { detail }));
  }

  return detail;
};

export const once = (eventName, handler) => {
  const wrapped = (detail) => {
    off(eventName, wrapped);
    handler(detail);
  };
  return on(eventName, wrapped);
};

export default Object.freeze({ on, off, emit, once });

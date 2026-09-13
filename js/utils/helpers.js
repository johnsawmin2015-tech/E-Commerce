export const debounce = (callback, delay = 180) => {
  let timeoutId;
  return (...args) => {
    if (typeof globalThis.clearTimeout === "function") {
      globalThis.clearTimeout(timeoutId);
      timeoutId = globalThis.setTimeout(() => callback(...args), delay);
      return;
    }
    callback(...args);
  };
};

export const throttle = (callback, interval = 120) => {
  let last = 0;
  let trailing;
  return (...args) => {
    const now = Date.now();
    const remaining = interval - (now - last);
    if (remaining <= 0) {
      last = now;
      callback(...args);
    } else {
      globalThis.clearTimeout(trailing);
      trailing = globalThis.setTimeout(() => {
        last = Date.now();
        callback(...args);
      }, remaining);
    }
  };
};

export const clamp = (value, min, max) =>
  Math.min(Math.max(Number(value) || min, min), max);

export const uniqueId = (prefix = "id") => {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? uniqueId("id").replace(/^id-/, "");

export const slugify = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

export const memoize = (fn, keyFn = (...args) => JSON.stringify(args)) => {
  const cache = new Map();
  const wrapped = (...args) => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
  wrapped.clear = () => cache.clear();
  return wrapped;
};

export default Object.freeze({
  debounce,
  throttle,
  clamp,
  uniqueId,
  createId,
  slugify,
  isPlainObject,
  memoize,
});

/**
 * Small, defensive persistence layer for the storefront.
 *
 * Values are namespaced and wrapped in a versioned envelope. When Web Storage
 * is unavailable (private browsing policies, SSR, tests), operations degrade to
 * an in-memory store instead of breaking the shopping experience.
 */

export const STORAGE_NAMESPACE = "ecommerce:v1";
export const STORAGE_SCHEMA_VERSION = 1;

export const STORAGE_KEYS = Object.freeze({
  CART: "cart",
  WISHLIST: "wishlist",
  RECENTLY_VIEWED: "recently-viewed",
  LAST_ORDER: "last-order",
  CHECKOUT_DRAFT: "checkout-draft",
});

const memoryStore = new Map();
let storageAvailability;

export const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

export const createArrayGuard = (itemGuard = () => true) => (value) =>
  Array.isArray(value) && value.every(itemGuard);

export const getStorageKey = (key) => {
  const safeKey = String(key ?? "").trim();
  if (!safeKey) {
    throw new TypeError("A non-empty storage key is required.");
  }

  return `${STORAGE_NAMESPACE}:${safeKey}`;
};

export const isStorageAvailable = () => {
  if (typeof storageAvailability === "boolean") {
    return storageAvailability;
  }

  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      storageAvailability = false;
      return storageAvailability;
    }

    const probeKey = `${STORAGE_NAMESPACE}:__probe__`;
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    storageAvailability = true;
  } catch {
    storageAvailability = false;
  }

  return storageAvailability;
};

const getRawValue = (key) => {
  const namespacedKey = getStorageKey(key);

  if (isStorageAvailable()) {
    try {
      return globalThis.localStorage.getItem(namespacedKey);
    } catch {
      storageAvailability = false;
    }
  }

  return memoryStore.get(namespacedKey) ?? null;
};

const setRawValue = (key, value) => {
  const namespacedKey = getStorageKey(key);

  if (isStorageAvailable()) {
    try {
      globalThis.localStorage.setItem(namespacedKey, value);
      return true;
    } catch {
      storageAvailability = false;
    }
  }

  memoryStore.set(namespacedKey, value);
  return true;
};

const removeRawValue = (key) => {
  const namespacedKey = getStorageKey(key);

  if (isStorageAvailable()) {
    try {
      globalThis.localStorage.removeItem(namespacedKey);
    } catch {
      storageAvailability = false;
    }
  }

  memoryStore.delete(namespacedKey);
};

const inferGuard = (fallback) => {
  if (Array.isArray(fallback)) return Array.isArray;
  if (isPlainObject(fallback)) return isPlainObject;
  if (fallback === null || fallback === undefined) return () => true;
  return (value) => typeof value === typeof fallback;
};

/**
 * Read a stored value.
 *
 * `guard` is optional and should return true only for a valid schema. Invalid,
 * malformed, or version-mismatched data is removed and the fallback returned.
 */
export const readStorage = (key, fallback = null, guard = inferGuard(fallback)) => {
  const rawValue = getRawValue(key);
  if (rawValue === null) return fallback;

  try {
    const envelope = JSON.parse(rawValue);
    const isEnvelope =
      isPlainObject(envelope) &&
      envelope.version === STORAGE_SCHEMA_VERSION &&
      Object.prototype.hasOwnProperty.call(envelope, "value");

    if (!isEnvelope || !guard(envelope.value)) {
      removeRawValue(key);
      return fallback;
    }

    return envelope.value;
  } catch {
    removeRawValue(key);
    return fallback;
  }
};

/** Persist a schema-checked value. Returns false without writing when invalid. */
export const writeStorage = (key, value, guard = () => true) => {
  try {
    if (!guard(value)) return false;
    return setRawValue(
      key,
      JSON.stringify({
        version: STORAGE_SCHEMA_VERSION,
        value,
      }),
    );
  } catch {
    return false;
  }
};

export const removeStorage = (key) => {
  removeRawValue(key);
};

/**
 * Session-scoped counterparts are used for short-lived, potentially personal
 * demo data such as a shipping confirmation. They intentionally do not fall
 * back to localStorage, so closing the tab clears the data.
 */
export const readSessionStorage = (key, fallback = null, guard = inferGuard(fallback)) => {
  try {
    const rawValue = globalThis.sessionStorage?.getItem(getStorageKey(key));
    if (rawValue === null || rawValue === undefined) return fallback;
    const envelope = JSON.parse(rawValue);
    const validEnvelope = isPlainObject(envelope)
      && envelope.version === STORAGE_SCHEMA_VERSION
      && Object.prototype.hasOwnProperty.call(envelope, "value")
      && guard(envelope.value);
    if (!validEnvelope) {
      globalThis.sessionStorage?.removeItem(getStorageKey(key));
      return fallback;
    }
    return envelope.value;
  } catch {
    return fallback;
  }
};

export const writeSessionStorage = (key, value, guard = () => true) => {
  if (!guard(value)) return false;
  try {
    globalThis.sessionStorage?.setItem(getStorageKey(key), JSON.stringify({
      version: STORAGE_SCHEMA_VERSION,
      value,
    }));
    return true;
  } catch {
    return false;
  }
};

export const removeSessionStorage = (key) => {
  try {
    globalThis.sessionStorage?.removeItem(getStorageKey(key));
  } catch {
    // Session storage can be unavailable under restrictive browser policies.
  }
};

/** Remove only values owned by this application namespace. */
export const clearStorageNamespace = () => {
  const prefix = `${STORAGE_NAMESPACE}:`;

  if (isStorageAvailable()) {
    try {
      const keysToRemove = [];
      for (let index = 0; index < globalThis.localStorage.length; index += 1) {
        const key = globalThis.localStorage.key(index);
        if (key?.startsWith(prefix)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => globalThis.localStorage.removeItem(key));
    } catch {
      storageAvailability = false;
    }
  }

  [...memoryStore.keys()]
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => memoryStore.delete(key));
};

// Compatibility aliases for consumers that prefer explicit value terminology.
export const getStoredValue = readStorage;
export const setStoredValue = writeStorage;
export const removeStoredValue = removeStorage;

import { OBJECT_STORES } from "../core/constants.js";

const ensureStore = (db, name, options = { keyPath: "id" }) => {
  if (!db.objectStoreNames.contains(name)) {
    return db.createObjectStore(name, options);
  }
  return null;
};

const ensureIndex = (store, name, keyPath, options = {}) => {
  if (store && !store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, options);
  }
};

/**
 * Version 1 — commerce primitives.
 * Version 2 — inventory, reviews, wishlists.
 * Version 3 — analytics, audit, coupons, search, variants.
 *
 * Migrations never delete user records. New stores are additive.
 */
export const applyMigrations = (db, oldVersion = 0, _newVersion, transaction) => {
  if (oldVersion < 1) {
    const products = ensureStore(db, OBJECT_STORES.PRODUCTS);
    ensureIndex(products, "sku", "sku", { unique: false });
    ensureIndex(products, "slug", "slug", { unique: false });
    ensureIndex(products, "category", "category");
    ensureIndex(products, "brand", "brand");
    ensureIndex(products, "status", "status");

    const users = ensureStore(db, OBJECT_STORES.USERS);
    ensureIndex(users, "email", "email", { unique: true });
    ensureIndex(users, "role", "role");

    ensureStore(db, OBJECT_STORES.CARTS);
    const orders = ensureStore(db, OBJECT_STORES.ORDERS);
    ensureIndex(orders, "userId", "userId");
    ensureIndex(orders, "status", "status");
    ensureIndex(orders, "createdAt", "createdAt");
    ensureStore(db, OBJECT_STORES.META, { keyPath: "key" });
  }

  if (oldVersion < 2) {
    const inventory = ensureStore(db, OBJECT_STORES.INVENTORY);
    ensureIndex(inventory, "productId", "productId");
    ensureIndex(inventory, "variantId", "variantId");
    ensureIndex(inventory, "sku", "sku");

    const reviews = ensureStore(db, OBJECT_STORES.REVIEWS);
    ensureIndex(reviews, "productId", "productId");
    ensureIndex(reviews, "userId", "userId");
    ensureIndex(reviews, "status", "status");

    ensureStore(db, OBJECT_STORES.WISHLISTS);
    const history = ensureStore(db, OBJECT_STORES.INVENTORY_HISTORY);
    ensureIndex(history, "inventoryId", "inventoryId");
    ensureIndex(history, "productId", "productId");
  }

  if (oldVersion < 3) {
    const events = ensureStore(db, OBJECT_STORES.ANALYTICS_EVENTS);
    ensureIndex(events, "type", "type");
    ensureIndex(events, "userId", "userId");
    ensureIndex(events, "entityId", "entityId");
    ensureIndex(events, "timestamp", "timestamp");

    const audit = ensureStore(db, OBJECT_STORES.AUDIT_LOGS);
    ensureIndex(audit, "action", "action");
    ensureIndex(audit, "entity", "entity");
    ensureIndex(audit, "actorId", "actorId");
    ensureIndex(audit, "timestamp", "timestamp");

    const coupons = ensureStore(db, OBJECT_STORES.COUPONS);
    ensureIndex(coupons, "code", "code", { unique: true });

    const searchHistory = ensureStore(db, OBJECT_STORES.SEARCH_HISTORY);
    ensureIndex(searchHistory, "userId", "userId");
    ensureIndex(searchHistory, "query", "query");

    const recentlyViewed = ensureStore(db, OBJECT_STORES.RECENTLY_VIEWED);
    ensureIndex(recentlyViewed, "userId", "userId");
    ensureIndex(recentlyViewed, "productId", "productId");

    const variants = ensureStore(db, OBJECT_STORES.VARIANTS);
    ensureIndex(variants, "productId", "productId");
    ensureIndex(variants, "sku", "sku");

    ensureStore(db, OBJECT_STORES.CATEGORIES);
    ensureStore(db, OBJECT_STORES.COMPARISONS);
    const addresses = ensureStore(db, OBJECT_STORES.ADDRESSES);
    ensureIndex(addresses, "userId", "userId");
  }
  if (oldVersion < 4 && transaction) {
    ensureIndex(transaction.objectStore(OBJECT_STORES.ORDERS), "sessionId", "sessionId");
    ensureIndex(transaction.objectStore(OBJECT_STORES.ORDERS), "checkoutKey", "checkoutKey");
    ensureIndex(transaction.objectStore(OBJECT_STORES.ANALYTICS_EVENTS), "sessionId", "sessionId");
  }
};

export default applyMigrations;

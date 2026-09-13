import { OBJECT_STORES } from "../core/constants.js";
import { createId } from "../utils/helpers.js";
import { getDatabase } from "./database.js";
export { atomic } from "./database.js";

export class Repository {
  constructor(storeName) {
    this.storeName = storeName;
  }

  async db() {
    return getDatabase();
  }

  async getById(id) {
    if (!id) return null;
    const db = await this.db();
    return db.get(this.storeName, id);
  }

  async getAll() {
    const db = await this.db();
    return db.getAll(this.storeName);
  }

  async findBy(indexName, value) {
    const db = await this.db();
    return db.getAllByIndex(this.storeName, indexName, value);
  }

  async save(record) {
    const db = await this.db();
    const next = {
      ...record,
      id: record.id || createId(),
      updatedAt: new Date().toISOString(),
    };
    if (!next.createdAt) next.createdAt = next.updatedAt;
    await db.put(this.storeName, next);
    return next;
  }

  async saveAll(records) {
    if (!records.length) return 0;
    const db = await this.db();
    const now = new Date().toISOString();
    const payload = records.map((record) => ({
      ...record,
      id: record.id || createId(),
      createdAt: record.createdAt || now,
      updatedAt: record.updatedAt || now,
    }));
    return db.putAll(this.storeName, payload);
  }

  async remove(id) {
    const db = await this.db();
    return db.delete(this.storeName, id);
  }

  async count() {
    const db = await this.db();
    return db.count(this.storeName);
  }
}

export const productRepository = new Repository(OBJECT_STORES.PRODUCTS);
export const variantRepository = new Repository(OBJECT_STORES.VARIANTS);
export const userRepository = new Repository(OBJECT_STORES.USERS);
export const cartRepository = new Repository(OBJECT_STORES.CARTS);
export const wishlistRepository = new Repository(OBJECT_STORES.WISHLISTS);
export const orderRepository = new Repository(OBJECT_STORES.ORDERS);
export const reviewRepository = new Repository(OBJECT_STORES.REVIEWS);
export const inventoryRepository = new Repository(OBJECT_STORES.INVENTORY);
export const inventoryHistoryRepository = new Repository(OBJECT_STORES.INVENTORY_HISTORY);
export const couponRepository = new Repository(OBJECT_STORES.COUPONS);
export const analyticsRepository = new Repository(OBJECT_STORES.ANALYTICS_EVENTS);
export const auditRepository = new Repository(OBJECT_STORES.AUDIT_LOGS);
export const searchHistoryRepository = new Repository(OBJECT_STORES.SEARCH_HISTORY);
export const recentlyViewedRepository = new Repository(OBJECT_STORES.RECENTLY_VIEWED);
export const categoryRepository = new Repository(OBJECT_STORES.CATEGORIES);
export const comparisonRepository = new Repository(OBJECT_STORES.COMPARISONS);
export const addressRepository = new Repository(OBJECT_STORES.ADDRESSES);
export const metaRepository = new Repository(OBJECT_STORES.META);

export const getMeta = async (key) => {
  const db = await getDatabase();
  return db.get(OBJECT_STORES.META, key);
};

export const setMeta = async (key, value) => {
  const db = await getDatabase();
  await db.put(OBJECT_STORES.META, { key, value, updatedAt: new Date().toISOString() });
};

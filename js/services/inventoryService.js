import { EVENT_NAMES, PERMISSIONS } from "../core/constants.js";
import { AppError, ErrorCodes } from "../core/errors.js";
import { emit } from "../core/eventBus.js";
import {
  applyReservation,
  availableStock,
  completeSale,
  isLowStock,
  isOutOfStock,
  releaseReservation,
  reverseSale,
} from "../domain/inventory.js";
import { inventoryHistoryRepository, inventoryRepository, productRepository } from "../data/repositories.js";
import { atomic } from "../data/database.js";
import { createId } from "../utils/helpers.js";
import { getActorId, requirePermission } from "./authService.js";
import { syncProductStock } from "./product-service.js";

const cache = new Map();

const productIdFrom = (record) => record.productId || record.id?.replace(/^inv-/, "");

export const hydrateInventory = async () => {
  const records = await inventoryRepository.getAll();
  cache.clear();
  records.forEach((record) => cache.set(record.productId, record));
  return records;
};

export const getInventoryRecord = (productId) => cache.get(productId) || null;

export const getAvailable = (productId) => {
  const record = cache.get(productId);
  return record ? availableStock(record) : null;
};

const persist = async (record, historyEntry) => {
  cache.set(record.productId, record);
  await inventoryRepository.save(record);
  if (historyEntry) await inventoryHistoryRepository.save(historyEntry);
  const product = await productRepository.getById(record.productId);
  if (product) {
    product.stock = availableStock(record);
    await productRepository.save(product);
  }
  syncProductStock(record.productId, availableStock(record));
  emit(EVENT_NAMES.INVENTORY_CHANGED, { productId: record.productId, record });
  return record;
};

const history = (record, action, delta, previousOnHand, reason) => ({
  id: createId(),
  inventoryId: record.id,
  productId: record.productId,
  variantId: record.variantId,
  action,
  delta,
  previousOnHand,
  newOnHand: record.onHand,
  reserved: record.reserved,
  reason,
  actorId: getActorId(),
  createdAt: new Date().toISOString(),
});

export const reserveStock = async (productId, quantity) => {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError(ErrorCodes.INVALID_INPUT, "Quantity must be a positive whole number.");
  let saved;
  await atomic(["inventory", "products", "inventoryHistory"], (tx) => {
    const record = tx.getAll("inventory").find((entry) => entry.productId === productId);
    if (!record) throw new AppError(ErrorCodes.MISSING_PRODUCT, "Inventory was not found for that product.");
    const result = applyReservation(record, quantity);
    if (!result.ok) throw new AppError(ErrorCodes.INSUFFICIENT_STOCK, "There is not enough available stock for that quantity.");
    saved = result.record;
    tx.put("inventory", saved);
    tx.put("products", { ...(tx.get("products", productId) || {}), stock: availableStock(saved) });
    tx.put("inventoryHistory", history(saved, "reserve", quantity, record.onHand, "Checkout reservation"));
  });
  await hydrateInventory();
  syncProductStock(productId, availableStock(saved));
  emit(EVENT_NAMES.INVENTORY_CHANGED, { productId, record: saved });
  return saved;
};

export const releaseStock = async (productId, quantity) => {
  if (!Number.isInteger(quantity) || quantity <= 0) return null;
  let saved = null;
  await atomic(["inventory", "products", "inventoryHistory"], (tx) => {
    const record = tx.getAll("inventory").find((entry) => entry.productId === productId);
    if (!record) return;
    saved = releaseReservation(record, quantity);
    tx.put("inventory", saved);
    tx.put("products", { ...(tx.get("products", productId) || {}), stock: availableStock(saved) });
    tx.put("inventoryHistory", history(saved, "release", -quantity, record.onHand, "Reservation released"));
  });
  if (saved) { await hydrateInventory(); syncProductStock(productId, availableStock(saved)); emit(EVENT_NAMES.INVENTORY_CHANGED, { productId, record: saved }); }
  return saved;
};

export const completeSaleForProduct = async (productId, quantity) => {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError(ErrorCodes.INVALID_INPUT, "Quantity must be a positive whole number.");
  let saved;
  await atomic(["inventory", "products", "inventoryHistory"], (tx) => {
    const record = tx.getAll("inventory").find((entry) => entry.productId === productId);
    if (!record) throw new AppError(ErrorCodes.MISSING_PRODUCT, "Inventory was not found for that product.");
    if (quantity > Number(record.onHand || 0) || quantity > Number(record.reserved || 0)) throw new AppError(ErrorCodes.INSUFFICIENT_STOCK, "A sale cannot exceed the reserved inventory.");
    saved = completeSale(record, quantity);
    tx.put("inventory", saved);
    tx.put("products", { ...(tx.get("products", productId) || {}), stock: availableStock(saved) });
    tx.put("inventoryHistory", history(saved, "sale", -quantity, record.onHand, "Sale completed"));
  });
  await hydrateInventory();
  syncProductStock(productId, availableStock(saved));
  emit(EVENT_NAMES.INVENTORY_CHANGED, { productId, record: saved });
  return saved;
};

export const restockSoldUnits = async (productId, quantity) => {
  const record = cache.get(productId);
  if (!record) return null;
  const qty = Math.max(0, Math.trunc(Number(quantity) || 0));
  if (!qty) return record;
  const next = reverseSale(record, qty);
  return persist(next, history(next, "restock", qty, record.onHand, "Order cancelled"));
};

/**
 * Undo checkout units: release a reservation if one is still held, otherwise
 * put sold quantity back on the shelf.
 */
export const revertCheckoutUnits = async (productId, quantity) => {
  const record = cache.get(productId);
  if (!record) return null;
  const qty = Math.max(0, Math.trunc(Number(quantity) || 0));
  if ((Number(record.reserved) || 0) >= qty) {
    return releaseStock(productId, qty);
  }
  return restockSoldUnits(productId, qty);
};

export const ensureInventoryRecord = async (product, { onHand } = {}) => {
  const productId = product?.id || product;
  const existing = cache.get(productId);
  if (existing) return existing;
  const stock = Number.isFinite(onHand) ? onHand : Number(product?.stock) || 0;
  const record = {
    id: `inv-${productId}`,
    productId,
    variantId: null,
    sku: product?.sku || productId,
    onHand: Math.max(0, stock),
    reserved: 0,
    reorderLevel: 2,
  };
  return persist(record, history(record, "create", record.onHand, 0, "Inventory record created"));
};

export const adjustStock = async (productId, delta, reason = "Manual adjustment") => {
  requirePermission(PERMISSIONS.INVENTORY_UPDATE);
  const record = cache.get(productId);
  if (!record) throw new AppError(ErrorCodes.MISSING_PRODUCT, "Inventory was not found for that product.");
  const amount = Number(delta);
  if (!Number.isInteger(amount)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Enter a numeric stock adjustment.");
  }
  const previous = record.onHand;
  if (amount < 0 && (Number(record.onHand) || 0) + amount < (Number(record.reserved) || 0)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "On-hand stock cannot fall below reserved units.");
  }
  const next = {
    ...record,
    onHand: Math.max(0, (Number(record.onHand) || 0) + amount),
  };
  return persist(next, history(next, "adjust", amount, previous, reason));
};

export const listLowStock = () =>
  [...cache.values()].filter((record) => isLowStock(record) || isOutOfStock(record));

export const getInventoryHistory = async (productId) => {
  const rows = await inventoryHistoryRepository.getAll();
  return rows
    .filter((row) => !productId || row.productId === productId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
};

export { availableStock, isLowStock, isOutOfStock };

export default Object.freeze({
  hydrateInventory,
  getInventoryRecord,
  getAvailable,
  reserveStock,
  releaseStock,
  completeSaleForProduct,
  restockSoldUnits,
  revertCheckoutUnits,
  ensureInventoryRecord,
  adjustStock,
  listLowStock,
  getInventoryHistory,
});

import { ORDER_STATUS, PERMISSIONS } from "../core/constants.js";
import { AppError, ErrorCodes } from "../core/errors.js";
import { assertTransition, nextStatuses } from "../domain/orderMachine.js";
import { orderRepository } from "../data/repositories.js";
import { atomic } from "../data/database.js";
import { requirePermission, getSession } from "./authService.js";
import { hydrateInventory } from "./inventoryService.js";
import { createId } from "../utils/helpers.js";

export const listOrders = async ({ userId } = {}) => {
  const session = getSession();
  if (!userId || !session?.userId || session.userId !== userId) requirePermission(PERMISSIONS.ORDERS_READ);
  const orders = await orderRepository.getAll();
  return orders
    .filter((order) => !userId || order.userId === userId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
};

export const getOrderById = async (id) => {
  const order = await orderRepository.getById(id);
  if (!order) return null;
  const session = getSession();
  const isOwner = Boolean(session?.userId && order.userId === session.userId);
  if (!isOwner) requirePermission(PERMISSIONS.ORDERS_READ);
  return order;
};

export const getOrderByReference = async (reference) => {
  const orders = await orderRepository.getAll();
  const order = orders.find((entry) => entry.reference === reference) || null;
  if (!order) return null;
  const session = getSession();
  if (!session?.userId || order.userId !== session.userId) requirePermission(PERMISSIONS.ORDERS_READ);
  return order;
};

export const saveOrder = (order) => {
  requirePermission(PERMISSIONS.ORDERS_UPDATE);
  return orderRepository.save(order);
};

const applyTransition = async (orderId, nextStatus, { actorId, note } = {}) => {
  const actor = actorId || getSession()?.userId || "guest";
  let saved;
  await atomic(["orders", "inventory", "inventoryHistory", "products", "auditLogs"], (tx) => {
    const order = tx.get("orders", orderId);
    if (!order) throw new AppError(ErrorCodes.NOT_FOUND, "That order was not found.");
    assertTransition(order.status, nextStatus);
    const now = new Date().toISOString();
    if (nextStatus === ORDER_STATUS.CANCELLED) {
      const quantities = (order.items || []).reduce((map, item) => map.set(item.productId, (map.get(item.productId) || 0) + item.quantity), new Map());
      if (order.inventoryCommitted !== false) quantities.forEach((quantity, productId) => {
        const record = tx.getAll("inventory").find((entry) => entry.productId === productId);
        if (!record) throw new AppError(ErrorCodes.MISSING_PRODUCT, "Inventory was not found for this order.");
        const next = { ...record, onHand: Number(record.onHand) + quantity, updatedAt: now };
        tx.put("inventory", next);
        tx.put("products", { ...(tx.get("products", productId) || {}), stock: Math.max(0, next.onHand - next.reserved), updatedAt: now });
        tx.put("inventoryHistory", { id: createId(), inventoryId: record.id, productId, variantId: record.variantId || null, action: "cancel-restock", delta: quantity, previousOnHand: record.onHand, newOnHand: next.onHand, reserved: next.reserved, reason: "Order cancelled", actorId: actor, createdAt: now });
      });
    }
    saved = { ...order, status: nextStatus, updatedAt: now, timeline: [...(order.timeline || []), { status: nextStatus, at: now, note: note || "", actorId: actor }] };
    tx.put("orders", saved);
    tx.put("auditLogs", { id: createId(), actor: actor, actorId: actor, action: "ORDER_STATUS_CHANGED", entity: "order", entityId: order.id, previousValue: { status: order.status }, newValue: { status: nextStatus }, timestamp: now });
  });
  await hydrateInventory();
  return saved;
};

export const transitionOrder = async (orderId, nextStatus, options = {}) => {
  requirePermission(PERMISSIONS.ORDERS_UPDATE);
  return applyTransition(orderId, nextStatus, options);
};

/** Customer-owned cancellation/return request. Admin transitions remain permission-gated above. */
export const requestOrderChange = async (orderId, nextStatus) => {
  const session = getSession();
  if (!session?.userId) throw new AppError(ErrorCodes.UNAUTHENTICATED, "Sign in to update your order.");
  const order = await orderRepository.getById(orderId);
  if (!order || order.userId !== session.userId) throw new AppError(ErrorCodes.NOT_FOUND, "That order was not found.");
  const allowed = order.status === ORDER_STATUS.DELIVERED
    ? [ORDER_STATUS.RETURN_REQUESTED]
    : [ORDER_STATUS.CANCELLED];
  if (!allowed.includes(nextStatus)) throw new AppError(ErrorCodes.INVALID_TRANSITION, "That order cannot be changed at this stage.");
  return applyTransition(orderId, nextStatus, { actorId: session.userId, note: nextStatus === ORDER_STATUS.CANCELLED ? "Customer cancellation request" : "Customer return request" });
};

export const allowedTransitions = (status) => nextStatuses(status);

export default Object.freeze({
  listOrders,
  getOrderById,
  getOrderByReference,
  saveOrder,
  transitionOrder,
  requestOrderChange,
  allowedTransitions,
});

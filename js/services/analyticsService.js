import { ANALYTICS_EVENTS, PERMISSIONS } from "../core/constants.js";
import {
  averageOrderValue,
  cartAbandonmentRate,
  conversionRate,
  repeatPurchaseRate,
} from "../domain/analytics.js";
import { analyticsRepository, orderRepository, productRepository } from "../data/repositories.js";
import { createId } from "../utils/helpers.js";
import { getActorId, getGuestSessionId, getSession, requirePermission } from "./authService.js";

export const trackEvent = async (type, { entityId = null, metadata = {} } = {}) => {
  const session = getSession();
  const event = {
    id: createId(),
    type,
    userId: session?.userId || getActorId(),
    sessionId: getGuestSessionId(),
    entityId,
    metadata,
    timestamp: new Date().toISOString(),
  };
  try {
    await analyticsRepository.save(event);
  } catch (error) {
    console.error("[Morrow] analytics event was not stored", error);
  }
  return event;
};

export const getEvents = async () => analyticsRepository.getAll();

export const calculateMetrics = async () => {
  requirePermission(PERMISSIONS.ANALYTICS_READ);
  const [storedEvents, orders, products] = await Promise.all([
    analyticsRepository.getAll(),
    orderRepository.getAll(),
    productRepository.getAll(),
  ]);
  const events = storedEvents.filter((event) => !event.isFixture);

  const purchases = events.filter((event) => event.type === ANALYTICS_EVENTS.PURCHASE && !event.isFixture);
  const checkoutsStarted = events.filter((event) => event.type === ANALYTICS_EVENTS.CHECKOUT_STARTED);
  const productViews = events.filter((event) => event.type === ANALYTICS_EVENTS.PRODUCT_VIEW);
  const searches = events.filter((event) => event.type === ANALYTICS_EVENTS.SEARCH);
  const sessions = new Set(events.map((event) => event.sessionId).filter(Boolean));
  const purchasingSessions = new Set(purchases.map((event) => event.sessionId).filter(Boolean));

  const realOrders = orders.filter((order) => !order.isFixture);
  const paidOrders = realOrders.filter((order) => order.status !== "cancelled" && order.status !== "refunded");
  const revenue = paidOrders.reduce((sum, order) => sum + (Number(order.totals?.total) || 0), 0);
  const cancelled = realOrders.filter((order) => order.status === "cancelled").length;
  const ordersByUser = paidOrders.reduce((map, order) => {
    const key = order.userId || "guest";
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});

  const viewsByProduct = productViews.reduce((map, event) => {
    if (!event.entityId) return map;
    map.set(event.entityId, (map.get(event.entityId) || 0) + 1);
    return map;
  }, new Map());

  const soldByProduct = paidOrders.reduce((map, order) => {
    (order.items || []).forEach((item) => {
      map.set(item.productId, (map.get(item.productId) || 0) + (item.quantity || 0));
    });
    return map;
  }, new Map());

  const searchCounts = searches.reduce((map, event) => {
    const query = event.metadata?.query || event.entityId;
    if (!query) return map;
    map.set(query, (map.get(query) || 0) + 1);
    return map;
  }, new Map());

  const categoryRevenue = paidOrders.reduce((map, order) => {
    (order.items || []).forEach((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      const category = product?.category || "Unassigned";
      map.set(category, (map.get(category) || 0) + (Number(item.subtotal) || 0));
    });
    return map;
  }, new Map());

  const couponUsage = events.filter((event) => event.metadata?.couponCode).length;

  const ranked = (map) =>
    [...map.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([id, count]) => ({ id, count, product: products.find((product) => product.id === id) || null }));

  return {
    totalRevenue: revenue,
    totalPurchases: paidOrders.length,
    totalOrders: realOrders.length,
    totalCustomers: new Set(paidOrders.map((order) => order.userId).filter(Boolean)).size,
    averageOrderValue: averageOrderValue(revenue, paidOrders.length),
    conversionRate: conversionRate(purchasingSessions.size || purchases.length, sessions.size || productViews.length),
    productViews: productViews.length,
    bestSellers: ranked(soldByProduct),
    mostViewed: ranked(viewsByProduct),
    searchPopularity: [...searchCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([query, count]) => ({ query, count })),
    cartAbandonment: cartAbandonmentRate(checkoutsStarted.length, purchases.length),
    repeatPurchaseRate: repeatPurchaseRate(ordersByUser),
    categoryPerformance: [...categoryRevenue.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([category, total]) => ({ category, total })),
    couponUsage,
    cancelledOrders: cancelled,
    sessions: sessions.size,
    events,
  };
};

export { ANALYTICS_EVENTS };

export default Object.freeze({
  trackEvent,
  getEvents,
  calculateMetrics,
});

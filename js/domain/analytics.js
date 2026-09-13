import { ANALYTICS_EVENTS } from "../core/constants.js";

export const conversionRate = (purchases, sessionsOrViews) => {
  const denom = Number(sessionsOrViews) || 0;
  if (denom <= 0) return 0;
  return Math.min(1, Math.max(0, Number(purchases) / denom));
};

export const averageOrderValue = (revenue, purchaseCount) => {
  const count = Number(purchaseCount) || 0;
  if (count <= 0) return 0;
  return Number(revenue) / count;
};

export const cartAbandonmentRate = (checkoutsStarted, purchases) => {
  const started = Number(checkoutsStarted) || 0;
  if (started <= 0) return 0;
  return Math.max(0, (started - (Number(purchases) || 0)) / started);
};

export const repeatPurchaseRate = (ordersByUser = {}) => {
  const users = Object.values(ordersByUser);
  if (!users.length) return 0;
  const repeaters = users.filter((count) => count >= 2).length;
  return repeaters / users.length;
};

export const countEvents = (events, type) =>
  events.filter((event) => event.type === type).length;

export const sumPurchaseRevenue = (events) =>
  events
    .filter((event) => event.type === ANALYTICS_EVENTS.PURCHASE)
    .reduce((sum, event) => sum + (Number(event.metadata?.total) || 0), 0);

export default Object.freeze({
  conversionRate,
  averageOrderValue,
  cartAbandonmentRate,
  repeatPurchaseRate,
  countEvents,
  sumPurchaseRevenue,
});

import assert from "node:assert/strict";
import test from "node:test";
import { ANALYTICS_EVENTS } from "../js/core/constants.js";
import {
  averageOrderValue,
  cartAbandonmentRate,
  conversionRate,
  sumPurchaseRevenue,
} from "../js/domain/analytics.js";

test("analytics: revenue, AOV, and conversion", () => {
  const events = [
    { type: ANALYTICS_EVENTS.PURCHASE, metadata: { total: 120 } },
    { type: ANALYTICS_EVENTS.PURCHASE, metadata: { total: 80 } },
    { type: ANALYTICS_EVENTS.CHECKOUT_STARTED, metadata: {} },
    { type: ANALYTICS_EVENTS.CHECKOUT_STARTED, metadata: {} },
    { type: ANALYTICS_EVENTS.CHECKOUT_STARTED, metadata: {} },
  ];
  assert.equal(sumPurchaseRevenue(events), 200);
  assert.equal(averageOrderValue(200, 2), 100);
  assert.equal(conversionRate(2, 10), 0.2);
  assert.equal(cartAbandonmentRate(3, 2), 1 / 3);
});

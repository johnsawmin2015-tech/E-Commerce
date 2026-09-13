import assert from "node:assert/strict";
import test from "node:test";
import { ORDER_STATUS } from "../js/core/constants.js";
import { assertTransition, canTransition } from "../js/domain/orderMachine.js";

test("orders: valid transitions are allowed", () => {
  assert.equal(canTransition(ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED), true);
  assert.equal(canTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING), true);
  assert.equal(canTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.RETURN_REQUESTED), true);
  assert.doesNotThrow(() => assertTransition(ORDER_STATUS.PACKED, ORDER_STATUS.SHIPPED));
});

test("orders: invalid transitions are rejected", () => {
  assert.equal(canTransition(ORDER_STATUS.PENDING, ORDER_STATUS.SHIPPED), false);
  assert.equal(canTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED), false);
  assert.throws(() => assertTransition(ORDER_STATUS.PENDING, ORDER_STATUS.REFUNDED));
});

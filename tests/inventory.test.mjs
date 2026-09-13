import assert from "node:assert/strict";
import test from "node:test";
import {
  applyReservation,
  availableStock,
  completeSale,
  isLowStock,
  releaseReservation,
  reverseSale,
} from "../js/domain/inventory.js";

test("inventory: available = onHand - reserved", () => {
  assert.equal(availableStock({ onHand: 10, reserved: 3 }), 7);
});

test("inventory: reservation succeeds and fails at the cap", () => {
  const ok = applyReservation({ onHand: 5, reserved: 2 }, 3);
  assert.equal(ok.ok, true);
  assert.equal(ok.record.reserved, 5);
  const blocked = applyReservation({ onHand: 5, reserved: 2 }, 4);
  assert.equal(blocked.ok, false);
});

test("inventory: release and sale completion", () => {
  const released = releaseReservation({ onHand: 8, reserved: 3 }, 2);
  assert.equal(released.reserved, 1);
  const sold = completeSale({ onHand: 8, reserved: 3 }, 3);
  assert.equal(sold.onHand, 5);
  assert.equal(sold.reserved, 0);
});

test("inventory: reverse sale restores on-hand stock", () => {
  const sold = completeSale({ onHand: 8, reserved: 3 }, 3);
  const restored = reverseSale(sold, 3);
  assert.equal(restored.onHand, 8);
  assert.equal(restored.reserved, 0);
});

test("inventory: low stock warning", () => {
  assert.equal(isLowStock({ onHand: 2, reserved: 0, reorderLevel: 3 }), true);
  assert.equal(isLowStock({ onHand: 0, reserved: 0, reorderLevel: 3 }), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { COUPON_TYPE } from "../js/core/constants.js";
import { calculateCouponDiscount, validateCoupon } from "../js/services/couponService.js";

const base = {
  code: "SAVE10",
  type: COUPON_TYPE.PERCENTAGE,
  value: 10,
  active: true,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  usageLimit: 5,
  usageCount: 1,
  minimumOrder: 50,
};

test("coupon: valid percentage discount", () => {
  const result = validateCoupon(base, { items: [{ productId: "p1" }], subtotal: 80 });
  assert.equal(result.ok, true);
  assert.equal(calculateCouponDiscount(base, 80), 8);
});

test("coupon: expired is rejected", () => {
  const result = validateCoupon({ ...base, expiresAt: "2020-01-01T00:00:00.000Z" }, { subtotal: 80 });
  assert.equal(result.ok, false);
});

test("coupon: restricted category is rejected", () => {
  const result = validateCoupon(
    { ...base, minimumOrder: 0, categories: ["Home"] },
    { items: [{ productId: "p1", category: "Apparel" }], subtotal: 80 },
  );
  assert.equal(result.ok, false);
});

test("coupon: minimum purchase is enforced", () => {
  const result = validateCoupon(base, { items: [], subtotal: 20 });
  assert.equal(result.ok, false);
});

test("coupon: usage limit is enforced", () => {
  const result = validateCoupon({ ...base, usageCount: 5, usageLimit: 5 }, { subtotal: 80 });
  assert.equal(result.ok, false);
});

test("coupon: fixed discount does not exceed subtotal", () => {
  assert.equal(calculateCouponDiscount({ type: COUPON_TYPE.FIXED, value: 40 }, 25), 25);
});


test("coupon: restricted discounts use each line total once", () => {
  const coupon = { ...base, categories: ["Home"] };
  const items = [
    { category: "Home", unitPrice: 20, quantity: 3, lineSubtotal: 60 },
    { category: "Apparel", unitPrice: 50, quantity: 2, lineSubtotal: 100 },
  ];
  assert.equal(calculateCouponDiscount(coupon, 160, items), 6);
  assert.equal(calculateCouponDiscount(coupon, 160, items.map(({ lineSubtotal, ...item }) => item)), 6);
});

import assert from "node:assert/strict";
import test from "node:test";
import { calculatePricing, calculateShipping, calculateTax, calculateSubtotal } from "../js/services/pricingService.js";

test("pricing: subtotal, discount, shipping, tax, and total", () => {
  const items = [
    { unitPrice: 100, quantity: 2 },
    { unitPrice: 50, quantity: 1 },
  ];
  const subtotal = calculateSubtotal(items);
  assert.equal(subtotal, 250);
  const shipping = calculateShipping(100, "standard");
  assert.equal(shipping, 12);
  const free = calculateShipping(150, "standard");
  assert.equal(free, 0);
  const tax = calculateTax(100, 0.08);
  assert.equal(tax, 8);
  const priced = calculatePricing({ items, discount: 25, shippingMethod: "standard", taxRate: 0.08, includeTax: true });
  assert.equal(priced.subtotal, 250);
  assert.equal(priced.discount, 25);
  assert.equal(priced.shipping, 0);
  assert.equal(priced.tax, 18);
  assert.equal(priced.total, 243);
});

test("pricing: discount cannot exceed subtotal", () => {
  const priced = calculatePricing({ items: [{ unitPrice: 10, quantity: 1 }], discount: 40, includeTax: false });
  assert.equal(priced.discount, 10);
  assert.equal(priced.total, 0);
});

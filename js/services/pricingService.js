import { roundCurrency } from "../utils/currency.js";
import {
  EXPRESS_SHIPPING_COST,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_COST,
  TAX_RATE,
} from "../core/config.js";

export const SHIPPING_METHODS = Object.freeze({
  standard: {
    id: "standard",
    label: "Standard delivery",
    description: "Arrives in 4–6 business days",
    price: STANDARD_SHIPPING_COST,
    freeThreshold: FREE_SHIPPING_THRESHOLD,
  },
  express: {
    id: "express",
    label: "Express delivery",
    description: "Arrives in 1–2 business days",
    price: EXPRESS_SHIPPING_COST,
    freeThreshold: Infinity,
  },
});

export const lineSubtotal = (unitPrice, quantity) =>
  roundCurrency((Number(unitPrice) || 0) * (Number(quantity) || 0));

export const calculateSubtotal = (items = []) =>
  roundCurrency(items.reduce((sum, item) => {
    const unit = Number(item.unitPrice ?? item.price ?? item.product?.price) || 0;
    return sum + unit * (Number(item.quantity) || 0);
  }, 0));

export const calculateShipping = (merchandiseTotal, shippingMethod = "standard") => {
  const method = SHIPPING_METHODS[shippingMethod] || SHIPPING_METHODS.standard;
  if (merchandiseTotal <= 0) return 0;
  return merchandiseTotal >= method.freeThreshold ? 0 : method.price;
};

export const calculateTax = (taxableAmount, taxRate = TAX_RATE) =>
  roundCurrency(Math.max(0, Number(taxableAmount) || 0) * taxRate);

/**
 * Central pricing pipeline:
 * subtotal − discount + shipping + tax = total
 *
 * Tax is applied to discounted merchandise only, not shipping.
 * This is a demonstration rule, not a jurisdiction-accurate tax engine.
 */
export const calculatePricing = ({
  items = [],
  discount = 0,
  shippingMethod = "standard",
  taxRate = TAX_RATE,
  includeTax = true,
} = {}) => {
  const subtotal = calculateSubtotal(items);
  const safeDiscount = roundCurrency(Math.min(Math.max(0, Number(discount) || 0), subtotal));
  const merchandise = roundCurrency(Math.max(0, subtotal - safeDiscount));
  const shipping = calculateShipping(merchandise, shippingMethod);
  const tax = includeTax ? calculateTax(merchandise, taxRate) : 0;
  const total = roundCurrency(merchandise + shipping + tax);
  const method = SHIPPING_METHODS[shippingMethod] || SHIPPING_METHODS.standard;

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    subtotal,
    discount: safeDiscount,
    shipping,
    tax,
    taxRate: includeTax ? taxRate : 0,
    total,
    shippingMethod: method,
    currency: "USD",
  };
};

export default Object.freeze({
  SHIPPING_METHODS,
  calculateSubtotal,
  calculateShipping,
  calculateTax,
  calculatePricing,
  lineSubtotal,
});

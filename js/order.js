import { getCart } from "./cart.js";
import { getProductById } from "./services/product-service.js";

export const SHIPPING_METHODS = Object.freeze({
  standard: {
    id: "standard",
    label: "Standard delivery",
    description: "Arrives in 4–6 business days",
    price: 12,
    freeThreshold: 150,
  },
  express: {
    id: "express",
    label: "Express delivery",
    description: "Arrives in 1–2 business days",
    price: 24,
    freeThreshold: Infinity,
  },
});

export const PROMOTION = Object.freeze({
  code: "MORROW10",
  rate: 0.1,
  label: "Welcome offer",
});

const PROMOTION_SESSION_KEY = "ecommerce.promotion";

export const getPromotionCode = () => {
  try {
    return window.sessionStorage.getItem(PROMOTION_SESSION_KEY) || "";
  } catch {
    return "";
  }
};

export const setPromotionCode = (code = "") => {
  const normalized = String(code).trim().toUpperCase();
  try {
    if (normalized === PROMOTION.code) window.sessionStorage.setItem(PROMOTION_SESSION_KEY, normalized);
    else window.sessionStorage.removeItem(PROMOTION_SESSION_KEY);
  } catch {
    // The pricing flow remains usable when storage is unavailable.
  }
  return normalized === PROMOTION.code;
};

export const getDetailedCart = () =>
  getCart()
    .map((item) => ({ ...item, product: getProductById(item.productId) }))
    .filter((item) => item.product && item.quantity > 0);

export const calculateOrder = ({
  items = getDetailedCart(),
  shippingMethod = "standard",
  discountCode = "",
} = {}) => {
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const method = SHIPPING_METHODS[shippingMethod] || SHIPPING_METHODS.standard;
  const shipping = subtotal >= method.freeThreshold ? 0 : method.price;
  const validDiscount = discountCode.trim().toUpperCase() === PROMOTION.code;
  const discount = validDiscount ? Math.round(subtotal * PROMOTION.rate * 100) / 100 : 0;
  const total = Math.max(0, subtotal + shipping - discount);
  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    shipping,
    discount,
    total,
    shippingMethod: method,
    discountCode: validDiscount ? PROMOTION.code : "",
  };
};

export const getEstimatedDelivery = (shippingMethod = "standard", from = new Date()) => {
  const addBusinessDays = (date, days) => {
    const result = new Date(date);
    let remaining = days;
    while (remaining > 0) {
      result.setDate(result.getDate() + 1);
      if (![0, 6].includes(result.getDay())) remaining -= 1;
    }
    return result;
  };
  const range = shippingMethod === "express" ? [1, 2] : [4, 6];
  return {
    start: addBusinessDays(from, range[0]).toISOString(),
    end: addBusinessDays(from, range[1]).toISOString(),
  };
};

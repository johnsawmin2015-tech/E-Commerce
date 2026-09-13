import { getCart } from "./cart.js";
import { getProductById } from "./services/product-service.js";
import { calculatePricing, SHIPPING_METHODS } from "./services/pricingService.js";

export { SHIPPING_METHODS };

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

export const setPromotionCode = (code = "", { validated = false } = {}) => {
  const normalized = String(code).trim().toUpperCase();
  const accepted = normalized === PROMOTION.code || (validated && /^[A-Z0-9][A-Z0-9-]{1,22}$/.test(normalized));
  try {
    if (accepted) window.sessionStorage.setItem(PROMOTION_SESSION_KEY, normalized);
    else window.sessionStorage.removeItem(PROMOTION_SESSION_KEY);
  } catch {
    // The pricing flow remains usable when storage is unavailable.
  }
  return accepted;
};

export const getDetailedCart = () =>
  getCart()
    .map((item) => ({ ...item, product: getProductById(item.productId) }))
    .filter((item) => item.product && item.quantity > 0);

export const calculateOrder = ({
  items = getDetailedCart(),
  shippingMethod = "standard",
  discountCode = "",
  includeTax = false,
} = {}) => {
  const detailed = items;
  const subtotalItems = detailed.map((item) => ({
    ...item,
    unitPrice: item.unitPrice ?? item.product?.price ?? 0,
    quantity: item.quantity,
  }));
  const validDiscount = String(discountCode).trim().toUpperCase() === PROMOTION.code;
  const provisional = calculatePricing({
    items: subtotalItems,
    discount: 0,
    shippingMethod,
    includeTax: false,
  });
  const discount = validDiscount ? Math.round(provisional.subtotal * PROMOTION.rate * 100) / 100 : 0;
  const priced = calculatePricing({
    items: subtotalItems,
    discount,
    shippingMethod,
    includeTax,
  });
  return {
    ...priced,
    items: detailed,
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

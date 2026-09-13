import { COUPON_TYPE, PERMISSIONS } from "../core/constants.js";
import { AppError, ErrorCodes } from "../core/errors.js";
import { couponRepository } from "../data/repositories.js";
import { requirePermission } from "./authService.js";
import { createId } from "../utils/helpers.js";
import { roundCurrency } from "../utils/currency.js";

const normalizeCode = (code) => String(code ?? "").trim().toUpperCase();

export const isCouponExpired = (coupon, now = new Date()) => {
  if (!coupon?.expiresAt) return false;
  return new Date(coupon.expiresAt).getTime() < new Date(now).getTime();
};

export const isCouponActive = (coupon, now = new Date()) =>
  Boolean(coupon) && coupon.active !== false && !isCouponExpired(coupon, now);

export const hasReachedUsageLimit = (coupon) =>
  coupon?.usageLimit !== null && coupon?.usageLimit !== undefined &&
  Number.isFinite(Number(coupon.usageLimit)) &&
  Number(coupon.usageCount || 0) >= Number(coupon.usageLimit);

export const matchesRestrictions = (coupon, items = []) => {
  const productIds = new Set((coupon.productIds || []).filter(Boolean));
  const categories = new Set((coupon.categoryIds || coupon.categories || []).filter(Boolean));
  if (!productIds.size && !categories.size) return true;

  return items.some((item) => {
    const productId = item.productId || item.product?.id;
    const category = item.category || item.product?.category;
    if (productIds.size && productIds.has(productId)) return true;
    if (categories.size && categories.has(category)) return true;
    return false;
  });
};

/**
 * Validate a coupon against an order snapshot. Returns `{ ok, reason, coupon }`.
 */
export const validateCoupon = (coupon, { items = [], subtotal = 0, now = new Date() } = {}) => {
  if (!coupon) return { ok: false, reason: "That demonstration code isn’t recognized." };
  if (coupon.active === false) return { ok: false, reason: "This promotion is not active." };
  if (isCouponExpired(coupon, now)) return { ok: false, reason: "This promotion has expired." };
  if (hasReachedUsageLimit(coupon)) return { ok: false, reason: "This promotion has reached its usage limit." };
  const minimum = Number(coupon.minimumOrder || coupon.minSubtotal || 0);
  if (minimum > 0 && subtotal < minimum) {
    return { ok: false, reason: `This promotion requires a subtotal of at least ${minimum}.` };
  }
  if (!matchesRestrictions(coupon, items)) {
    return { ok: false, reason: "This promotion does not apply to the items in your bag." };
  }
  return { ok: true, coupon };
};

export const calculateCouponDiscount = (coupon, subtotal, items = []) => {
  if (!coupon) return 0;
  const restricted = Boolean((coupon.productIds || []).length || (coupon.categoryIds || coupon.categories || []).length);
  const amount = restricted
    ? items.filter((item) => matchesRestrictions(coupon, [item])).reduce((sum, item) => sum + (Number(item.lineSubtotal ?? ((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0))) || 0), 0)
    : Number(subtotal) || 0;
  if (coupon.type === COUPON_TYPE.PERCENTAGE) {
    return roundCurrency(amount * (Number(coupon.value) || 0) / 100);
  }
  if (coupon.type === COUPON_TYPE.FIXED) {
    return roundCurrency(Math.min(amount, Number(coupon.value) || 0));
  }
  if (coupon.rate) return roundCurrency(amount * Number(coupon.rate));
  return 0;
};

export const normalizeCouponCode = normalizeCode;

export const listCoupons = async () => {
  requirePermission(PERMISSIONS.COUPONS_MANAGE);
  return couponRepository.getAll();
};

export const createCoupon = async (input = {}) => {
  requirePermission(PERMISSIONS.COUPONS_MANAGE);
  const code = normalizeCode(input.code);
  if (!code || !Object.values(COUPON_TYPE).includes(input.type)) throw new AppError(ErrorCodes.INVALID_INPUT, "Enter a valid coupon code and type.");
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) throw new AppError(ErrorCodes.INVALID_INPUT, "Coupon value must be greater than zero.");
  return couponRepository.save({
    id: input.id || createId("coupon"),
    code,
    type: input.type,
    value,
    minimumOrder: Math.max(0, Number(input.minimumOrder) || 0),
    usageLimit: input.usageLimit === null || input.usageLimit === "" || input.usageLimit === undefined ? null : Math.max(1, Number(input.usageLimit) || 1),
    usageCount: 0,
    active: input.active !== false,
    expiresAt: input.expiresAt || null,
    productIds: Array.isArray(input.productIds) ? input.productIds : [],
    categories: Array.isArray(input.categories) ? input.categories : [],
  });
};

export const toggleCoupon = async (id) => {
  requirePermission(PERMISSIONS.COUPONS_MANAGE);
  const coupon = await couponRepository.getById(id);
  if (!coupon) return null;
  return couponRepository.save({ ...coupon, active: !coupon.active, updatedAt: new Date().toISOString() });
};

export default Object.freeze({
  validateCoupon,
  calculateCouponDiscount,
  isCouponExpired,
  normalizeCouponCode,
  listCoupons,
  createCoupon,
  toggleCoupon,
});

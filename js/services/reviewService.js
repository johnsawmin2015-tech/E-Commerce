import { PERMISSIONS, REVIEW_STATUS } from "../core/constants.js";
import { AppError, ErrorCodes } from "../core/errors.js";
import { productRepository, reviewRepository } from "../data/repositories.js";
import { createId } from "../utils/helpers.js";
import { sanitizeText } from "../utils/sanitizer.js";
import { getAllProducts, getProductById, setCatalogRecords, upsertProductRecord } from "./product-service.js";
import { getSession, requirePermission } from "./authService.js";
import { ANALYTICS_EVENTS, trackEvent } from "./analyticsService.js";

export const listReviews = async (productId, { includePending = false } = {}) => {
  if (includePending) requirePermission(PERMISSIONS.REVIEWS_MODERATE);
  const rows = await reviewRepository.getAll();
  return rows
    .filter((review) => {
      if (productId && review.productId !== productId) return false;
      if (!includePending && review.status !== REVIEW_STATUS.APPROVED) return false;
      return true;
    })
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
};

export const averageRating = (reviews = []) => {
  if (!reviews.length) return 0;
  const total = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
  return Math.round((total / reviews.length) * 10) / 10;
};

export const hydrateReviewAggregates = async () => {
  const reviews = await reviewRepository.getAll();
  const approved = reviews.filter((review) => review.status === REVIEW_STATUS.APPROVED);
  if (!approved.length) return getAllProducts();
  const grouped = new Map();
  approved.forEach((review) => {
    const list = grouped.get(review.productId) || [];
    list.push(review);
    grouped.set(review.productId, list);
  });
  const next = getAllProducts().map((product) => {
    const list = grouped.get(product.id);
    if (!list?.length) return { ...product, rating: 0, reviewCount: 0 };
    return {
      ...product,
      rating: averageRating(list),
      reviewCount: list.length,
    };
  });
  return setCatalogRecords(next);
};

export const refreshProductRating = async (productId) => {
  const approved = await listReviews(productId);
  const product = getProductById(productId) || await productRepository.getById(productId);
  if (!product) return null;
  const next = {
    ...product,
    rating: approved.length ? averageRating(approved) : 0,
    reviewCount: approved.length,
  };
  return upsertProductRecord(next, { skipPermission: true });
};

export const createReview = async ({ productId, rating, text }) => {
  const product = getProductById(productId);
  if (!product) throw new AppError(ErrorCodes.MISSING_PRODUCT, "That product is no longer available.");
  const stars = Math.trunc(Number(rating));
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Choose a rating between 1 and 5 stars.");
  }
  const body = sanitizeText(text, { maxLength: 2000 }).trim();
  if (body.length < 10) throw new AppError(ErrorCodes.INVALID_INPUT, "Share at least 10 characters about the product.");
  const session = getSession();
  const review = await reviewRepository.save({
    id: createId(),
    productId,
    userId: session?.userId || "guest",
    authorName: session?.email || "Guest shopper",
    rating: stars,
    text: body,
    helpfulVotes: 0,
    verifiedPurchase: false,
    status: REVIEW_STATUS.PENDING,
  });
  await trackEvent(ANALYTICS_EVENTS.REVIEW_CREATED, { entityId: productId, metadata: { rating: stars } });
  return review;
};

export const moderateReview = async (reviewId, status) => {
  requirePermission(PERMISSIONS.REVIEWS_MODERATE);
  const review = await reviewRepository.getById(reviewId);
  if (!review) throw new AppError(ErrorCodes.NOT_FOUND, "That review was not found.");
  if (![REVIEW_STATUS.APPROVED, REVIEW_STATUS.REJECTED, REVIEW_STATUS.PENDING].includes(status)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "That review status is not valid.");
  }
  const saved = await reviewRepository.save({ ...review, status });
  await refreshProductRating(review.productId);
  return saved;
};

export const voteHelpful = async (reviewId) => {
  const review = await reviewRepository.getById(reviewId);
  if (!review) return null;
  return reviewRepository.save({ ...review, helpfulVotes: (review.helpfulVotes || 0) + 1 });
};

export default Object.freeze({
  listReviews,
  averageRating,
  hydrateReviewAggregates,
  createReview,
  moderateReview,
  voteHelpful,
});

import { RECOMMENDATION_WEIGHTS } from "../core/constants.js";
import { getProductById, getProducts } from "./productService.js";
import { analyticsRepository, orderRepository } from "../data/repositories.js";

let behaviorSignals = new Map();
let pairSignals = new Map();
let viewPairs = new Map();

export const hydrateRecommendationSignals = async () => {
  const [events, orders] = await Promise.all([analyticsRepository.getAll(), orderRepository.getAll()]);
  behaviorSignals = new Map();
  events.filter((event) => !event.isFixture && event.entityId).forEach((event) => {
    const weight = event.type === "purchase" ? 5 : event.type === "add_to_cart" ? 3 : event.type === "product_view" ? 1 : 0;
    if (weight) behaviorSignals.set(event.entityId, (behaviorSignals.get(event.entityId) || 0) + weight);
  });
  pairSignals = new Map();
  orders.filter((order) => !order.isFixture).forEach((order) => {
    const ids = [...new Set((order.items || []).map((item) => item.productId))];
    ids.forEach((id) => ids.forEach((other) => { if (id !== other) pairSignals.set(`${id}::${other}`, (pairSignals.get(`${id}::${other}`) || 0) + 1); }));
  });
  viewPairs = new Map();
  const bySession = new Map();
  events.filter((event) => !event.isFixture && event.type === "product_view" && event.sessionId).forEach((event) => {
    const ids = bySession.get(event.sessionId) || new Set(); ids.add(event.entityId); bySession.set(event.sessionId, ids);
  });
  bySession.forEach((ids) => ids.forEach((id) => ids.forEach((other) => { if (id !== other) viewPairs.set(`${id}::${other}`, (viewPairs.get(`${id}::${other}`) || 0) + 1); })));
};

const overlap = (left = [], right = []) => {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];
  const set = new Set(leftList.map((value) => String(value).toLowerCase()));
  return rightList.filter((value) => set.has(String(value).toLowerCase())).length;
};

const priceSimilarity = (left, right) => {
  const a = Number(left) || 0;
  const b = Number(right) || 0;
  if (!a || !b) return 0;
  const delta = Math.abs(a - b) / Math.max(a, b);
  return Math.max(0, 1 - delta);
};

/**
 * Transparent weighted recommendation engine (not machine learning).
 * Scores live catalog products from explicit heuristic weights.
 */
export const scoreRecommendations = (
  sourceProduct,
  catalog,
  {
    viewedIds = [],
    wishlistIds = [],
    purchasedIds = [],
  } = {},
) => {
  const source = sourceProduct;
  if (!source) return [];
  const viewed = new Set(viewedIds);
  const wished = new Set(wishlistIds);
  const purchased = new Set(purchasedIds);

  return catalog
    .filter((candidate) => candidate.id !== source.id && (candidate.status ?? "active") === "active")
    .map((candidate) => {
      const categoryScore = candidate.category === source.category ? 1 : 0;
      const brandScore = candidate.brand === source.brand ? 1 : 0;
      const browsingScore = viewed.has(candidate.id) ? 1 : overlap(source.tags, candidate.tags) / Math.max(source.tags?.length || 1, 1);
      const wishlistScore = wished.has(candidate.id) ? 1 : 0;
      const purchaseScore = purchased.has(candidate.id) ? 1 : 0;
      const ratingScore = (Number(candidate.rating) || 0) / 5;
      const popularityScore = Math.min(1, (behaviorSignals.get(candidate.id) || 0) / 20);
      const priceScore = priceSimilarity(source.price, candidate.price);
      const score =
        categoryScore * RECOMMENDATION_WEIGHTS.category +
        brandScore * RECOMMENDATION_WEIGHTS.brand +
        browsingScore * RECOMMENDATION_WEIGHTS.browsing +
        wishlistScore * RECOMMENDATION_WEIGHTS.wishlist +
        purchaseScore * RECOMMENDATION_WEIGHTS.purchase +
        ratingScore * RECOMMENDATION_WEIGHTS.rating +
        popularityScore * RECOMMENDATION_WEIGHTS.popularity +
        priceScore * RECOMMENDATION_WEIGHTS.price;
      return { product: candidate, score };
    })
    .sort((left, right) => right.score - left.score || right.product.popularity - left.product.popularity);
};

export const getSimilarProducts = (productId, limit = 4, context = {}) => {
  const product = getProductById(productId);
  if (!product) return [];
  return scoreRecommendations(product, getProducts(), context)
    .slice(0, limit)
    .map(({ product: entry }) => entry);
};

export const getBecauseYouViewed = (viewedIds = [], limit = 4) => {
  const latest = viewedIds.map(getProductById).find(Boolean);
  if (!latest) return [];
  return getSimilarProducts(latest.id, limit, { viewedIds });
};

export const getTrending = (limit = 8) =>
  [...getProducts()]
    .filter((product) => (product.status ?? "active") === "active" && product.stock > 0)
    .sort((left, right) => (behaviorSignals.get(right.id) || 0) - (behaviorSignals.get(left.id) || 0) || (right.rating || 0) - (left.rating || 0))
    .slice(0, limit);

export const getFrequentlyBoughtTogether = (productId, limit = 2) =>
  getProducts().filter((product) => product.id !== productId).sort((a, b) => (pairSignals.get(`${productId}::${b.id}`) || 0) - (pairSignals.get(`${productId}::${a.id}`) || 0)).slice(0, limit);

export const getCustomersAlsoViewed = (productId, limit = 4, viewedIds = []) =>
  getProducts().filter((product) => product.id !== productId).sort((a, b) => (viewPairs.get(`${productId}::${b.id}`) || 0) - (viewPairs.get(`${productId}::${a.id}`) || 0)).slice(0, limit);

export const getRecommendedForYou = ({ viewedIds = [], wishlistIds = [], purchasedIds = [] } = {}, limit = 8) => {
  const products = getProducts();
  const seedId = viewedIds[0] || wishlistIds[0] || purchasedIds[0] || products.find((product) => product.featured)?.id;
  if (!seedId) return getTrending(limit);
  return getSimilarProducts(seedId, limit, { viewedIds, wishlistIds, purchasedIds });
};

export default Object.freeze({
  scoreRecommendations,
  getSimilarProducts,
  getBecauseYouViewed,
  getTrending,
  getFrequentlyBoughtTogether,
  getCustomersAlsoViewed,
  getRecommendedForYou,
  hydrateRecommendationSignals,
});

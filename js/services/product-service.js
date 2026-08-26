import PRODUCTS from "../data/products.js";

const byId = new Map(PRODUCTS.map((product) => [product.id, product]));
const bySlug = new Map(PRODUCTS.map((product) => [product.slug, product]));

const normalizeLookup = (value) => String(value ?? "").trim();

/** Return a new catalog array; the canonical product records are immutable. */
export const getProducts = () => [...PRODUCTS];

export const getProductById = (id) => byId.get(normalizeLookup(id)) ?? null;

export const getProductBySlug = (slug) =>
  bySlug.get(normalizeLookup(slug).toLowerCase()) ?? null;

/** Category names in curated catalog order. */
export const getCategories = () => [
  ...new Set(PRODUCTS.map((product) => product.category)),
];

/** Brand names in locale-aware alphabetical order. */
export const getBrands = () =>
  [...new Set(PRODUCTS.map((product) => product.brand))].sort((left, right) =>
    left.localeCompare(right),
  );

export const getCategorySummaries = () =>
  getCategories().map((name) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    count: PRODUCTS.filter((product) => product.category === name).length,
  }));

export const getBrandSummaries = () =>
  getBrands().map((name) => ({
    name,
    count: PRODUCTS.filter((product) => product.brand === name).length,
  }));

const resolveProduct = (productOrId) => {
  if (productOrId && typeof productOrId === "object") {
    return getProductById(productOrId.id);
  }

  return getProductById(productOrId) ?? getProductBySlug(productOrId);
};

/**
 * Return deterministic, in-stock recommendations based on category, brand,
 * shared tags, editorial status, and popularity.
 */
export const getRelatedProducts = (productOrId, limit = 4) => {
  const product = resolveProduct(productOrId);
  const safeLimit = Math.max(0, Math.trunc(Number(limit) || 0));
  if (!product || safeLimit === 0) return [];

  const sourceTags = new Set(product.tags.map((tag) => tag.toLowerCase()));

  return PRODUCTS.filter(
    (candidate) => candidate.id !== product.id && candidate.stock > 0,
  )
    .map((candidate, catalogIndex) => {
      const sharedTags = candidate.tags.reduce(
        (count, tag) => count + (sourceTags.has(tag.toLowerCase()) ? 1 : 0),
        0,
      );
      const score =
        (candidate.category === product.category ? 10 : 0) +
        (candidate.brand === product.brand ? 4 : 0) +
        sharedTags * 2 +
        (candidate.featured ? 1 : 0) +
        candidate.popularity / 100;

      return { candidate, catalogIndex, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.candidate.rating - left.candidate.rating ||
        right.candidate.popularity - left.candidate.popularity ||
        left.catalogIndex - right.catalogIndex,
    )
    .slice(0, safeLimit)
    .map(({ candidate }) => candidate);
};

export default Object.freeze({
  getProducts,
  getProductById,
  getProductBySlug,
  getCategories,
  getBrands,
  getRelatedProducts,
});

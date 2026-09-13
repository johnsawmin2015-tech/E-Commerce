import EDITORIAL from "../data/products.js";
import { PRODUCT_STATUS } from "../core/constants.js";
import { generateExtendedCatalog, getEditorialCatalog } from "../data/catalogGenerator.js";
import { productRepository, variantRepository } from "../data/repositories.js";
import { requirePermission } from "./authService.js";
import { PERMISSIONS } from "../core/constants.js";

let catalog = getEditorialCatalog();
let byId = new Map(catalog.map((product) => [product.id, product]));
let bySlug = new Map(catalog.map((product) => [product.slug, product]));
let hydrated = false;

const rebuildIndexes = () => {
  byId = new Map(catalog.map((product) => [product.id, product]));
  bySlug = new Map(catalog.map((product) => [product.slug, product]));
};

const normalizeLookup = (value) => String(value ?? "").trim();

const isStorefrontVisible = (product) =>
  product && (product.status ?? PRODUCT_STATUS.ACTIVE) === PRODUCT_STATUS.ACTIVE;

export const isCatalogHydrated = () => hydrated;

export const setCatalogRecords = (records) => {
  catalog = Array.isArray(records) ? records : [];
  rebuildIndexes();
  hydrated = true;
  return catalog;
};

export const hydrateCatalog = async () => {
  const records = await productRepository.getAll();
  if (!records.length) {
    catalog = getEditorialCatalog();
    rebuildIndexes();
    hydrated = false;
    return catalog;
  }
  const variants = await variantRepository.getAll();
  const variantsByProduct = variants.reduce((map, variant) => {
    const list = map.get(variant.productId) || [];
    list.push(variant);
    map.set(variant.productId, list);
    return map;
  }, new Map());
  catalog = records.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) || product.variants || [],
  }));
  rebuildIndexes();
  hydrated = true;
  return catalog;
};

/** Storefront catalog: active products only. */
export const getProducts = () => catalog.filter(isStorefrontVisible);

export const getAllProducts = () => [...catalog];

export const getProductById = (id) => byId.get(normalizeLookup(id)) ?? null;

export const getProductBySlug = (slug) =>
  bySlug.get(normalizeLookup(slug).toLowerCase()) ?? null;

export const getCategories = () => [
  ...new Set(getProducts().map((product) => product.category)),
];

export const getSubcategories = (category) => [
  ...new Set(
    getProducts()
      .filter((product) => !category || product.category === category)
      .map((product) => product.subcategory)
      .filter(Boolean),
  ),
];

export const getBrands = () =>
  [...new Set(getProducts().map((product) => product.brand))].sort((left, right) =>
    left.localeCompare(right),
  );

export const getCategorySummaries = () =>
  getCategories().map((name) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    count: getProducts().filter((product) => product.category === name).length,
  }));

export const getBrandSummaries = () =>
  getBrands().map((name) => ({
    name,
    count: getProducts().filter((product) => product.brand === name).length,
  }));

const resolveProduct = (productOrId) => {
  if (productOrId && typeof productOrId === "object") {
    return getProductById(productOrId.id);
  }
  return getProductById(productOrId) ?? getProductBySlug(productOrId);
};

export const getRelatedProducts = (productOrId, limit = 4) => {
  const product = resolveProduct(productOrId);
  const safeLimit = Math.max(0, Math.trunc(Number(limit) || 0));
  if (!product || safeLimit === 0) return [];

  const sourceTags = new Set((product.tags || []).map((tag) => tag.toLowerCase()));

  return getProducts()
    .filter((candidate) => candidate.id !== product.id && candidate.stock > 0)
    .map((candidate, catalogIndex) => {
      const sharedTags = (candidate.tags || []).reduce(
        (count, tag) => count + (sourceTags.has(String(tag).toLowerCase()) ? 1 : 0),
        0,
      );
      const score =
        (candidate.category === product.category ? 10 : 0) +
        (candidate.brand === product.brand ? 4 : 0) +
        sharedTags * 2 +
        (candidate.featured ? 1 : 0) +
        (candidate.popularity || 0) / 100;
      return { candidate, catalogIndex, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.candidate.rating || 0) - (left.candidate.rating || 0) ||
        (right.candidate.popularity || 0) - (left.candidate.popularity || 0) ||
        left.catalogIndex - right.catalogIndex,
    )
    .slice(0, safeLimit)
    .map(({ candidate }) => candidate);
};

export const syncProductStock = (productId, stock) => {
  const product = byId.get(productId);
  if (product) product.stock = stock;
};

export const upsertProductRecord = async (product, { skipPermission = false } = {}) => {
  if (!skipPermission) requirePermission(catalog.some((entry) => entry.id === product?.id) ? PERMISSIONS.PRODUCTS_UPDATE : PERMISSIONS.PRODUCTS_CREATE);
  const saved = await productRepository.save(product);
  const index = catalog.findIndex((entry) => entry.id === saved.id);
  if (index >= 0) catalog[index] = { ...catalog[index], ...saved };
  else catalog.push(saved);
  rebuildIndexes();
  return saved;
};

export const removeProductRecord = async (id) => {
  requirePermission(PERMISSIONS.PRODUCTS_DELETE);
  await productRepository.remove(id);
  catalog = catalog.filter((product) => product.id !== id);
  rebuildIndexes();
};

export { EDITORIAL, generateExtendedCatalog };

export default Object.freeze({
  getProducts,
  getProductById,
  getProductBySlug,
  getCategories,
  getBrands,
  getRelatedProducts,
  hydrateCatalog,
});

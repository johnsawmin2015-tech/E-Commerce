import { normalizeSearchTerm, searchProducts } from "./search.js";

export const DEFAULT_FILTER_STATE = Object.freeze({
  q: "",
  categories: Object.freeze([]),
  brands: Object.freeze([]),
  availability: "all",
  minPrice: "",
  maxPrice: "",
  sort: "featured",
  page: 1,
});

export const SORT_OPTIONS = Object.freeze([
  "featured",
  "newest",
  "price-asc",
  "price-desc",
  "rating",
  "popularity",
  "name",
  "relevance",
]);

const AVAILABILITY_OPTIONS = new Set(["all", "in-stock", "out-of-stock"]);
const SHOP_PARAM_KEYS = [
  "q",
  "category",
  "brand",
  "availability",
  "minPrice",
  "maxPrice",
  "sort",
  "page",
];

const toStringArray = (value) => {
  const values =
    value instanceof Set ? [...value] : Array.isArray(value) ? value : [value];

  return [
    ...new Set(
      values
        .flatMap((item) => String(item ?? "").split(","))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
};

const normalizeSort = (value) => {
  const aliases = {
    "price-low": "price-asc",
    "price-low-high": "price-asc",
    "price-high": "price-desc",
    "price-high-low": "price-desc",
    "best-selling": "popularity",
    alphabetical: "name",
  };
  const candidate = aliases[value] ?? value;
  return SORT_OPTIONS.includes(candidate) ? candidate : DEFAULT_FILTER_STATE.sort;
};

const normalizePriceState = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? String(number) : "";
};

export const normalizeFilterState = (state = {}) => {
  const source = state && typeof state === "object" ? state : {};

  return {
    q: String(source.q ?? source.query ?? "").trim(),
    categories: toStringArray(source.categories ?? source.category ?? []),
    brands: toStringArray(source.brands ?? source.brand ?? []),
    availability: AVAILABILITY_OPTIONS.has(source.availability)
      ? source.availability
      : source.inStock === true
        ? "in-stock"
        : DEFAULT_FILTER_STATE.availability,
    minPrice: normalizePriceState(source.minPrice),
    maxPrice: normalizePriceState(source.maxPrice),
    sort: normalizeSort(source.sort),
    page: Math.max(1, Math.trunc(Number(source.page) || 1)),
  };
};

const normalizedSet = (values) => new Set(values.map(normalizeSearchTerm));

const compareText = (left, right) =>
  String(left ?? "").localeCompare(String(right ?? ""), "en", {
    sensitivity: "base",
  });

const catalogTieBreak = (left, right) =>
  (Number(right.popularity) || 0) - (Number(left.popularity) || 0) ||
  (Number(right.rating) || 0) - (Number(left.rating) || 0) ||
  compareText(left.id, right.id);

const sortProducts = (products, sort) => {
  if (sort === "relevance") return [...products];

  const comparators = {
    featured: (left, right) =>
      Number(Boolean(right.featured)) - Number(Boolean(left.featured)) ||
      catalogTieBreak(left, right),
    newest: (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
      catalogTieBreak(left, right),
    "price-asc": (left, right) =>
      (Number(left.price) || 0) - (Number(right.price) || 0) ||
      catalogTieBreak(left, right),
    "price-desc": (left, right) =>
      (Number(right.price) || 0) - (Number(left.price) || 0) ||
      catalogTieBreak(left, right),
    rating: (left, right) =>
      (Number(right.rating) || 0) - (Number(left.rating) || 0) ||
      (Number(right.reviewCount) || 0) - (Number(left.reviewCount) || 0) ||
      catalogTieBreak(left, right),
    popularity: catalogTieBreak,
    name: (left, right) => compareText(left.name, right.name) || catalogTieBreak(left, right),
  };

  return [...products].sort(comparators[sort] ?? comparators.featured);
};

/**
 * Pure product pipeline: search → facets → price → availability → sort.
 * It never mutates the source array and deliberately leaves pagination to the
 * rendering layer so callers can retain the total filtered result count.
 */
export const applyProductPipeline = (products, state = DEFAULT_FILTER_STATE) => {
  const collection = Array.isArray(products) ? products : [];
  const source = state && typeof state === "object" ? state : {};
  const normalizedState = normalizeFilterState(source);
  const categories = normalizedSet(normalizedState.categories);
  const brands = normalizedSet(normalizedState.brands);
  const colors = normalizedSet(toStringArray(source.colors ?? source.color ?? []));
  const sizes = normalizedSet(toStringArray(source.sizes ?? source.size ?? []));
  const minimumRating = Math.max(0, Number(source.minRating) || 0);

  let minimumPrice = normalizedState.minPrice === "" ? null : Number(normalizedState.minPrice);
  let maximumPrice = normalizedState.maxPrice === "" ? null : Number(normalizedState.maxPrice);
  if (minimumPrice !== null && maximumPrice !== null && minimumPrice > maximumPrice) {
    [minimumPrice, maximumPrice] = [maximumPrice, minimumPrice];
  }

  const searched = searchProducts(collection, normalizedState.q);
  const filtered = searched.filter((product) => {
    const price = Number(product?.price);
    const productColors = (product?.colors ?? []).map(normalizeSearchTerm);
    const productSizes = (product?.sizes ?? []).map(normalizeSearchTerm);

    if (categories.size && !categories.has(normalizeSearchTerm(product?.category))) {
      return false;
    }
    if (brands.size && !brands.has(normalizeSearchTerm(product?.brand))) return false;
    if (colors.size && !productColors.some((color) => colors.has(color))) return false;
    if (sizes.size && !productSizes.some((size) => sizes.has(size))) return false;
    if (minimumPrice !== null && price < minimumPrice) return false;
    if (maximumPrice !== null && price > maximumPrice) return false;
    if ((Number(product?.rating) || 0) < minimumRating) return false;
    if (normalizedState.availability === "in-stock" && !(product?.stock > 0)) {
      return false;
    }
    if (normalizedState.availability === "out-of-stock" && product?.stock > 0) {
      return false;
    }

    return true;
  });

  return sortProducts(filtered, normalizedState.sort);
};

const toSearchParams = (value) => {
  if (value instanceof URLSearchParams) return new URLSearchParams(value);
  if (typeof value === "string") return new URLSearchParams(value.replace(/^\?/, ""));
  if (value && typeof value === "object") return new URLSearchParams(value);
  if (typeof globalThis.location?.search === "string") {
    return new URLSearchParams(globalThis.location.search);
  }
  return new URLSearchParams();
};

export const readShopState = (searchParams) => {
  const params = toSearchParams(searchParams);
  const readMany = (key) => params.getAll(key).flatMap((value) => value.split(","));
  const query = params.get("q") ?? "";

  // Searches are relevance-ranked unless the URL names another sort. Featured is
  // only the default when the catalog is browsed without a query.
  return normalizeFilterState({
    q: query,
    categories: readMany("category"),
    brands: readMany("brand"),
    availability: params.get("availability") ?? "all",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    sort: params.get("sort") ?? (query.trim() ? "relevance" : DEFAULT_FILTER_STATE.sort),
    page: params.get("page") ?? 1,
  });
};

export const serializeShopState = (state, sourceParams) => {
  const normalizedState = normalizeFilterState(state);
  const params = toSearchParams(sourceParams);
  SHOP_PARAM_KEYS.forEach((key) => params.delete(key));

  if (normalizedState.q) params.set("q", normalizedState.q);
  normalizedState.categories.forEach((value) => params.append("category", value));
  normalizedState.brands.forEach((value) => params.append("brand", value));
  if (normalizedState.availability !== DEFAULT_FILTER_STATE.availability) {
    params.set("availability", normalizedState.availability);
  }
  if (normalizedState.minPrice !== "") params.set("minPrice", normalizedState.minPrice);
  if (normalizedState.maxPrice !== "") params.set("maxPrice", normalizedState.maxPrice);
  if (normalizedState.sort !== DEFAULT_FILTER_STATE.sort) {
    params.set("sort", normalizedState.sort);
  }
  if (normalizedState.page > 1) params.set("page", String(normalizedState.page));

  return params;
};

/**
 * Serialize state, update browser history when available, and return the new
 * URLSearchParams for non-browser callers and tests.
 */
export const writeShopState = (state, { replace = false } = {}) => {
  const params = serializeShopState(state);

  if (
    typeof globalThis.history?.pushState === "function" &&
    typeof globalThis.location?.pathname === "string"
  ) {
    const query = params.toString();
    const url = `${globalThis.location.pathname}${query ? `?${query}` : ""}${
      globalThis.location.hash ?? ""
    }`;
    const method = replace ? "replaceState" : "pushState";
    globalThis.history[method]({}, "", url);
  }

  return params;
};

export default Object.freeze({
  DEFAULT_FILTER_STATE,
  applyProductPipeline,
  readShopState,
  writeShopState,
});

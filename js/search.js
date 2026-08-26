/** Normalize user input for case- and diacritic-insensitive matching. */
export const normalizeSearchTerm = (term) =>
  String(term ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const normalizeSearchText = normalizeSearchTerm;

const normalizedFields = (product) => ({
  name: normalizeSearchTerm(product?.name),
  brand: normalizeSearchTerm(product?.brand),
  category: normalizeSearchTerm(product?.category),
  description: normalizeSearchTerm(product?.description),
  tags: Array.isArray(product?.tags)
    ? product.tags.map(normalizeSearchTerm).filter(Boolean)
    : [],
});

const getMatchScore = (product, normalizedTerm) => {
  const fields = normalizedFields(product);
  const tokens = normalizedTerm.split(" ").filter(Boolean);
  const haystack = [
    fields.name,
    fields.brand,
    fields.category,
    fields.description,
    ...fields.tags,
  ].join(" ");

  if (!tokens.every((token) => haystack.includes(token))) return -1;

  let score = 0;
  if (fields.name === normalizedTerm) score += 140;
  else if (fields.name.startsWith(normalizedTerm)) score += 100;
  else if (fields.name.includes(normalizedTerm)) score += 70;

  if (fields.brand === normalizedTerm) score += 65;
  else if (fields.brand.includes(normalizedTerm)) score += 30;

  if (fields.category === normalizedTerm) score += 55;
  else if (fields.category.includes(normalizedTerm)) score += 22;

  if (fields.tags.includes(normalizedTerm)) score += 50;

  tokens.forEach((token) => {
    if (fields.name.split(" ").includes(token)) score += 20;
    else if (fields.name.includes(token)) score += 12;
    if (fields.brand.includes(token)) score += 8;
    if (fields.category.includes(token)) score += 7;
    if (fields.tags.some((tag) => tag.includes(token))) score += 6;
    if (fields.description.includes(token)) score += 2;
  });

  return score;
};

/**
 * Search products without mutating the supplied collection. A blank query
 * returns a shallow copy in its original order; matches are relevance-ranked.
 */
export const searchProducts = (products, term) => {
  const collection = Array.isArray(products) ? products : [];
  const normalizedTerm = normalizeSearchTerm(term);
  if (!normalizedTerm) return [...collection];

  return collection
    .map((product, index) => ({
      product,
      index,
      score: getMatchScore(product, normalizedTerm),
    }))
    .filter(({ score }) => score >= 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (Number(right.product?.popularity) || 0) -
          (Number(left.product?.popularity) || 0) ||
        (Number(right.product?.rating) || 0) -
          (Number(left.product?.rating) || 0) ||
        left.index - right.index,
    )
    .map(({ product }) => product);
};

/** Return the highest quality matching product records for a typeahead UI. */
export const getSearchSuggestions = (products, term, limit = 6) => {
  const normalizedTerm = normalizeSearchTerm(term);
  const safeLimit = Math.max(0, Math.trunc(Number(limit) || 0));
  if (!normalizedTerm || safeLimit === 0) return [];

  return searchProducts(products, normalizedTerm).slice(0, safeLimit);
};

export const productMatchesSearch = (product, term) => {
  const normalizedTerm = normalizeSearchTerm(term);
  return !normalizedTerm || getMatchScore(product, normalizedTerm) >= 0;
};

export default Object.freeze({
  normalizeSearchTerm,
  searchProducts,
  getSearchSuggestions,
});

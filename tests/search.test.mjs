import assert from "node:assert/strict";
import test from "node:test";
import { generateExtendedCatalog } from "../js/data/catalogGenerator.js";
import { searchProducts } from "../js/search.js";
import { getEditorialCatalog } from "../js/data/catalogGenerator.js";

test("search: ranking prefers name matches over tag-only matches", () => {
  const products = [
    { id: "a", name: "Linen Shell", brand: "X", category: "Home", tags: ["soft"], popularity: 10, rating: 4 },
    { id: "b", name: "Wool Throw", brand: "X", category: "Home", tags: ["linen"], popularity: 99, rating: 5 },
  ];
  const ranked = searchProducts(products, "linen");
  assert.equal(ranked[0].id, "a");
});

test("search: empty queries return the original collection", () => {
  const products = getEditorialCatalog();
  assert.equal(searchProducts(products, "").length, products.length);
  assert.equal(searchProducts(products, "   ").length, products.length);
});

test("search: name relevance keeps Atelier Linen Overshirt first for linen", () => {
  const results = searchProducts(getEditorialCatalog(), "linen");
  assert.equal(results[0]?.name, "Atelier Linen Overshirt");
});

test("search: editorial linen overshirt outranks catalog extensions", () => {
  const results = searchProducts(generateExtendedCatalog(), "linen");
  assert.equal(results[0]?.name, "Atelier Linen Overshirt");
});

test("catalog generator produces at least 1,000 products", () => {
  const catalog = generateExtendedCatalog();
  assert.ok(catalog.length >= 1000);
  assert.equal(new Set(catalog.map((product) => product.id)).size, catalog.length);
});

test("search over 1,000 products completes quickly", () => {
  const catalog = generateExtendedCatalog();
  const start = performance.now();
  const results = searchProducts(catalog, "merino");
  const elapsed = performance.now() - start;
  assert.ok(results.length > 0);
  assert.ok(elapsed < 150, `search took ${elapsed}ms`);
});

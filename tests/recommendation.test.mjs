import assert from "node:assert/strict";
import test from "node:test";
import { scoreRecommendations } from "../js/services/recommendationService.js";

test("recommendations tolerate products with missing tags", () => {
  const source = { id: "a", category: "Apparel", brand: "Morrow", price: 40 };
  const catalog = [
    { id: "b", category: "Apparel", brand: "Morrow", price: 42, status: "active", popularity: 80, rating: 4.5 },
  ];
  const ranked = scoreRecommendations(source, catalog);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].product.id, "b");
});

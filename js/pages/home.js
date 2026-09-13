import { getProducts } from "../services/product-service.js";
import { renderProductGrid } from "../ui.js";
import { appReady } from "../core/app.js";
import { getRecommendedForYou, getTrending } from "../services/recommendationService.js";
import { getRecentlyViewedIds } from "../features/wishlist/recentlyViewed.js";
import { getWishlist } from "../wishlist.js";

await appReady().catch(() => {});

const products = getProducts();

renderProductGrid(
  document.querySelector("#featured-products"),
  products.filter((product) => product.featured && product.stock > 0).slice(0, 4),
);

renderProductGrid(
  document.querySelector("#new-arrivals"),
  [...products]
    .filter((product) => product.isNew && product.stock > 0)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4),
);

const recommended = getRecommendedForYou({
  viewedIds: getRecentlyViewedIds(),
  wishlistIds: getWishlist(),
}, 4);
const recommendedMount = document.querySelector("#recommended-products");
if (recommendedMount && recommended.length) {
  renderProductGrid(recommendedMount, recommended);
} else if (recommendedMount) {
  renderProductGrid(recommendedMount, getTrending(4));
}

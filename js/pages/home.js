import { getProducts } from "../services/product-service.js";
import { renderProductGrid } from "../ui.js";

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

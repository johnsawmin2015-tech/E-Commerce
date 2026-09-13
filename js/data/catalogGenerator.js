import { CATALOG_SEED_SIZE } from "../core/config.js";
import { PRODUCT_STATUS } from "../core/constants.js";
import PRODUCTS from "./products.js";

const SUBCATEGORIES = Object.freeze({
  Apparel: ["Tops", "Knitwear", "Outerwear", "Dresses", "Bottoms"],
  Footwear: ["Sneakers", "Boots", "Sandals", "Formal"],
  Accessories: ["Bags", "Watches", "Eyewear", "Soft Accessories"],
  Home: ["Lighting", "Textiles", "Tableware", "Furniture", "Fragrance"],
});

const SUBCATEGORY_BY_ID = Object.freeze({
  "prod-001": "Tops",
  "prod-002": "Knitwear",
  "prod-003": "Tops",
  "prod-004": "Dresses",
  "prod-005": "Bottoms",
  "prod-006": "Outerwear",
  "prod-007": "Sneakers",
  "prod-008": "Formal",
  "prod-009": "Sneakers",
  "prod-010": "Boots",
  "prod-011": "Sandals",
  "prod-012": "Formal",
  "prod-013": "Watches",
  "prod-014": "Bags",
  "prod-015": "Bags",
  "prod-016": "Eyewear",
  "prod-017": "Soft Accessories",
  "prod-018": "Soft Accessories",
  "prod-019": "Lighting",
  "prod-020": "Textiles",
  "prod-021": "Tableware",
  "prod-022": "Fragrance",
  "prod-023": "Furniture",
  "prod-024": "Textiles",
});

const EDITIONS = Object.freeze([
  "Studio",
  "Archive",
  "Seasonal",
  "Heritage",
  "Capsule",
  "Travel",
  "Weekend",
  "City",
  "Coast",
  "Highland",
  "Edition",
  "Reserve",
  "Classic",
  "Modern",
  "Utility",
  "Quiet",
  "Daily",
  "Evening",
  "Field",
  "House",
  "Port",
  "Atelier Line",
  "Workshop",
  "North",
  "South",
  "East",
  "West",
  "First Light",
  "Late Hour",
  "Open Air",
  "Indoor",
  "Compact",
  "Grand",
  "Refined",
  "Raw",
  "Soft",
  "Structured",
  "Lightweight",
  "Year-Round",
  "Limited Run",
]);

const colorName = (color) => (typeof color === "string" ? color : color?.name || "Default");

export const defaultSubcategory = (category, index = 0) => {
  const options = SUBCATEGORIES[category] || ["General"];
  return options[index % options.length];
};

export const buildVariants = (product) => {
  const colors = product.colors?.length ? product.colors : [null];
  const sizes = product.sizes?.length ? product.sizes : [null];
  const variants = [];
  colors.forEach((color, colorIndex) => {
    sizes.forEach((size, sizeIndex) => {
      const colorLabel = color ? colorName(color) : "";
      const sizeLabel = size || "";
      const key = [colorLabel || "default", sizeLabel || "default"].join("::");
      variants.push({
        id: `${product.id}::${key}`,
        sku: `${product.sku}-${String(colorIndex * sizes.length + sizeIndex + 1).padStart(2, "0")}`,
        productId: product.id,
        size: sizeLabel || null,
        color: colorLabel || null,
        priceOverride: null,
        image: product.images?.[colorIndex % (product.images?.length || 1)] || product.images?.[0] || "",
        availability: product.stock > 0 ? "in_stock" : "out_of_stock",
      });
    });
  });
  return variants;
};

export const enrichEditorialProduct = (product) => {
  const sku = `MRW-${product.id.replace("prod-", "")}`;
  const salePrice = product.originalPrice ? product.price : null;
  const enriched = {
    ...product,
    sku,
    subcategory: SUBCATEGORY_BY_ID[product.id] || defaultSubcategory(product.category),
    status: PRODUCT_STATUS.ACTIVE,
    salePrice,
    normalPrice: product.originalPrice || product.price,
    bestSeller: product.badge === "BEST SELLER" || product.popularity >= 90,
    featured: Boolean(product.featured),
    reviewCount: product.reviewCount || 0,
    rating: product.rating || 0,
  };
  return { ...enriched, variants: buildVariants(enriched) };
};

const padId = (value) => String(value).padStart(4, "0");

/**
 * Expand the 24 editorial products into a deterministic demonstration catalog.
 * Generated names never copy an editorial name exactly, so search ranking tests
 * against the editorial set remain stable.
 */
export const generateExtendedCatalog = (editorial = PRODUCTS, targetCount = CATALOG_SEED_SIZE) => {
  const source = Array.isArray(editorial) ? editorial : [];
  const catalog = source.map(enrichEditorialProduct);
  if (source.length === 0) return catalog;

  let serial = 25;
  let editionCursor = 0;
  while (catalog.length < targetCount) {
    const base = source[(serial - 25) % source.length];
    const edition = EDITIONS[editionCursor % EDITIONS.length];
    editionCursor += 1;
    const cycle = Math.floor((serial - 25) / source.length) + 2;
    const id = `prod-${padId(serial)}`;
    const priceFactor = 0.86 + ((serial * 7) % 19) / 100;
    const price = Math.round(base.price * priceFactor);
    const onSale = serial % 11 === 0;
    const originalPrice = onSale ? Math.round(price / 0.82) : undefined;
    const stock = Math.max(0, (base.stock + ((serial * 3) % 17) - 4) % 48);
    const created = new Date(Date.UTC(2024, 0, 1 + (serial % 600)));
    const status =
      serial % 97 === 0
        ? PRODUCT_STATUS.ARCHIVED
        : serial % 89 === 0
          ? PRODUCT_STATUS.DRAFT
          : PRODUCT_STATUS.ACTIVE;
    const product = enrichEditorialProduct({
      ...base,
      id,
      sku: `MRW-${padId(serial)}`,
      slug: `${base.slug}-${edition.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${cycle}`,
      name: `${base.name} — ${edition} ${cycle}`,
      price,
      originalPrice,
      rating: Math.round((Math.min(5, Math.max(3.6, base.rating - 0.2 + ((serial % 9) * 0.05)))) * 10) / 10,
      reviewCount: Math.max(0, Math.round(base.reviewCount * (0.2 + (serial % 8) / 10))),
      stock,
      featured: serial % 23 === 0,
      isNew: serial % 19 === 0,
      popularity: Math.max(20, Math.min(99, base.popularity - 8 + (serial % 14))),
      badge: onSale ? "SALE" : serial % 19 === 0 ? "NEW" : serial % 29 === 0 ? "BEST SELLER" : null,
      createdAt: created.toISOString(),
      tags: [...(base.tags || []), edition.toLowerCase(), "extended-catalog"],
      description: `${base.description} ${edition} ${cycle} is a catalog extension for demonstration search, filtering, and pagination.`,
    });
    product.status = status;
    product.sku = `MRW-${padId(serial)}`;
    catalog.push(product);
    serial += 1;
  }

  return catalog;
};

export const getEditorialCatalog = () => PRODUCTS.map(enrichEditorialProduct);

export default generateExtendedCatalog;

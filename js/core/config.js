/**
 * Application configuration.
 *
 * Morrow is an enterprise-*inspired* browser-only storefront. Values here
 * describe the demonstration environment, not a production backend.
 */

export const APP_NAME = "Morrow";
export const APP_POSITIONING =
  "An enterprise-inspired Vanilla JavaScript e-commerce platform built entirely with browser technologies.";

export const DB_NAME = "MorrowDB";
export const DB_VERSION = 4;

export const STORAGE_NAMESPACE = "morrow:v2";
export const LEGACY_STORAGE_NAMESPACE = "ecommerce:v1";

export const CURRENCY = "USD";
export const LOCALE = "en-US";
export const TAX_RATE = 0.08;
export const FREE_SHIPPING_THRESHOLD = 150;
export const STANDARD_SHIPPING_COST = 12;
export const EXPRESS_SHIPPING_COST = 24;

export const CATALOG_SEED_SIZE = 1024;
export const SEARCH_DEBOUNCE_MS = 180;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_SUGGESTION_LIMIT = 8;
export const SHOP_PAGE_SIZE = 12;
export const COMPARISON_MIN = 2;
export const COMPARISON_MAX = 4;
export const RECENTLY_VIEWED_LIMIT = 12;
export const SEARCH_HISTORY_LIMIT = 12;

export const DEMO_PASSWORD = "MorrowDemo!1";
export const DEMO_PASSWORD_SALT = "morrow-demo-v1";
export const DEMO_PASSWORD_SHA256 =
  "16c30ff4577f4faf84ddd79e1837ba5ca0088a40f5d757931211a0e129c4655f";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export const CONFIG = Object.freeze({
  APP_NAME,
  APP_POSITIONING,
  DB_NAME,
  DB_VERSION,
  CURRENCY,
  LOCALE,
  TAX_RATE,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_COST,
  EXPRESS_SHIPPING_COST,
  CATALOG_SEED_SIZE,
  SEARCH_DEBOUNCE_MS,
});

export default CONFIG;

export const ROLES = Object.freeze({
  CUSTOMER: "customer",
  SUPPORT_AGENT: "support_agent",
  INVENTORY_MANAGER: "inventory_manager",
  STORE_MANAGER: "store_manager",
  ADMINISTRATOR: "administrator",
  SUPER_ADMIN: "super_admin",
});

export const PERMISSIONS = Object.freeze({
  PRODUCTS_READ: "products.read",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_DELETE: "products.delete",
  CATEGORIES_MANAGE: "categories.manage",
  INVENTORY_READ: "inventory.read",
  INVENTORY_UPDATE: "inventory.update",
  ORDERS_READ: "orders.read",
  ORDERS_UPDATE: "orders.update",
  CUSTOMERS_READ: "customers.read",
  REVIEWS_MODERATE: "reviews.moderate",
  ANALYTICS_READ: "analytics.read",
  COUPONS_MANAGE: "coupons.manage",
  AUDIT_READ: "audit.read",
  USERS_MANAGE: "users.manage",
  SETTINGS_MANAGE: "settings.manage",
});

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.CUSTOMER]: Object.freeze([]),
  [ROLES.SUPPORT_AGENT]: Object.freeze([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.REVIEWS_MODERATE,
  ]),
  [ROLES.INVENTORY_MANAGER]: Object.freeze([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.ORDERS_READ,
  ]),
  [ROLES.STORE_MANAGER]: Object.freeze([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.REVIEWS_MODERATE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.COUPONS_MANAGE,
  ]),
  [ROLES.ADMINISTRATOR]: Object.freeze([
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.REVIEWS_MODERATE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.COUPONS_MANAGE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.SETTINGS_MANAGE,
  ]),
  [ROLES.SUPER_ADMIN]: Object.freeze(Object.values(PERMISSIONS)),
});

export const PRODUCT_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
  UNAVAILABLE: "unavailable",
});

export const ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  PACKED: "packed",
  SHIPPED: "shipped",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURN_REQUESTED: "return_requested",
  RETURNED: "returned",
  REFUNDED: "refunded",
});

export const ORDER_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: Object.freeze([ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.CONFIRMED]: Object.freeze([ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.PROCESSING]: Object.freeze([ORDER_STATUS.PACKED]),
  [ORDER_STATUS.PACKED]: Object.freeze([ORDER_STATUS.SHIPPED]),
  [ORDER_STATUS.SHIPPED]: Object.freeze([ORDER_STATUS.OUT_FOR_DELIVERY]),
  [ORDER_STATUS.OUT_FOR_DELIVERY]: Object.freeze([ORDER_STATUS.DELIVERED]),
  [ORDER_STATUS.DELIVERED]: Object.freeze([ORDER_STATUS.RETURN_REQUESTED]),
  [ORDER_STATUS.RETURN_REQUESTED]: Object.freeze([ORDER_STATUS.RETURNED]),
  [ORDER_STATUS.RETURNED]: Object.freeze([ORDER_STATUS.REFUNDED]),
  [ORDER_STATUS.CANCELLED]: Object.freeze([]),
  [ORDER_STATUS.REFUNDED]: Object.freeze([]),
});

export const REVIEW_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

export const COUPON_TYPE = Object.freeze({
  PERCENTAGE: "percentage",
  FIXED: "fixed",
});

export const PAYMENT_METHODS = Object.freeze({
  CARD: "card",
  KBZPAY: "kbzpay",
  WAVEPAY: "wavepay",
  COD: "cod",
});

export const ANALYTICS_EVENTS = Object.freeze({
  PAGE_VIEW: "page_view",
  PRODUCT_VIEW: "product_view",
  SEARCH: "search",
  ADD_TO_CART: "add_to_cart",
  REMOVE_FROM_CART: "remove_from_cart",
  WISHLIST_ADD: "wishlist_add",
  WISHLIST_REMOVE: "wishlist_remove",
  CHECKOUT_STARTED: "checkout_started",
  CHECKOUT_COMPLETED: "checkout_completed",
  ORDER_CREATED: "order_created",
  PURCHASE: "purchase",
  REVIEW_CREATED: "review_created",
});

export const AUDIT_ACTIONS = Object.freeze({
  PRODUCT_CREATED: "PRODUCT_CREATED",
  PRODUCT_UPDATED: "PRODUCT_UPDATED",
  PRODUCT_ARCHIVED: "PRODUCT_ARCHIVED",
  PRODUCT_RESTORED: "PRODUCT_RESTORED",
  PRODUCT_DELETED: "PRODUCT_DELETED",
  PRICE_CHANGED: "PRICE_CHANGED",
  INVENTORY_ADJUSTED: "INVENTORY_ADJUSTED",
  ORDER_STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  COUPON_CREATED: "COUPON_CREATED",
  COUPON_UPDATED: "COUPON_UPDATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  REVIEW_MODERATED: "REVIEW_MODERATED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
});

export const EVENT_NAMES = Object.freeze({
  READY: "morrow:ready",
  AUTH_LOGIN: "auth:login",
  AUTH_LOGOUT: "auth:logout",
  CART_UPDATED: "cart:updated",
  WISHLIST_UPDATED: "wishlist:updated",
  COMPARISON_UPDATED: "comparison:updated",
  INVENTORY_CHANGED: "inventory:changed",
  ORDER_CREATED: "order:created",
  ORDER_UPDATED: "order:updated",
  PRODUCT_VIEWED: "product:viewed",
  STATE_CHANGED: "state:changed",
  ERROR: "app:error",
});

export const OBJECT_STORES = Object.freeze({
  PRODUCTS: "products",
  VARIANTS: "variants",
  USERS: "users",
  CARTS: "carts",
  WISHLISTS: "wishlists",
  ORDERS: "orders",
  REVIEWS: "reviews",
  INVENTORY: "inventory",
  INVENTORY_HISTORY: "inventoryHistory",
  COUPONS: "coupons",
  ANALYTICS_EVENTS: "analyticsEvents",
  AUDIT_LOGS: "auditLogs",
  SEARCH_HISTORY: "searchHistory",
  RECENTLY_VIEWED: "recentlyViewed",
  CATEGORIES: "categories",
  COMPARISONS: "comparisons",
  ADDRESSES: "addresses",
  META: "meta",
});

export const RECOMMENDATION_WEIGHTS = Object.freeze({
  category: 0.3,
  brand: 0.2,
  browsing: 0.15,
  wishlist: 0.1,
  purchase: 0.1,
  rating: 0.05,
  popularity: 0.05,
  price: 0.05,
});

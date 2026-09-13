import { PERMISSIONS } from "../core/constants.js";
import { hasPermission } from "./rbac.js";

export const ADMIN_LINKS = Object.freeze([
  {
    href: "dashboard.html",
    label: "Overview",
    permission: PERMISSIONS.ANALYTICS_READ,
  },
  {
    href: "products.html",
    label: "Products",
    permission: PERMISSIONS.PRODUCTS_READ,
  },
  {
    href: "categories.html",
    label: "Categories",
    permission: PERMISSIONS.PRODUCTS_READ,
  },
  {
    href: "inventory.html",
    label: "Inventory",
    permission: PERMISSIONS.INVENTORY_READ,
  },
  { href: "orders.html", label: "Orders", permission: PERMISSIONS.ORDERS_READ },
  {
    href: "customers.html",
    label: "Customers",
    permission: PERMISSIONS.CUSTOMERS_READ,
  },
  {
    href: "reviews.html",
    label: "Reviews",
    permission: PERMISSIONS.REVIEWS_MODERATE,
  },
  {
    href: "coupons.html",
    label: "Coupons",
    permission: PERMISSIONS.COUPONS_MANAGE,
  },
  {
    href: "analytics.html",
    label: "Analytics",
    permission: PERMISSIONS.ANALYTICS_READ,
  },
  {
    href: "audit-logs.html",
    label: "Audit logs",
    permission: PERMISSIONS.AUDIT_READ,
  },
  {
    href: "settings.html",
    label: "Settings",
    permission: PERMISSIONS.SETTINGS_MANAGE,
  },
]);

// Only known, permitted local pages may be used as a post-login destination.
export const getAdminDestination = (requested, role) => {
  const permitted = ADMIN_LINKS.filter((link) =>
    hasPermission(role, link.permission),
  );
  return (
    permitted.find((link) => link.href === requested)?.href ||
    permitted[0]?.href ||
    null
  );
};

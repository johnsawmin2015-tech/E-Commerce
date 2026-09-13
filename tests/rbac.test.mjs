import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSIONS, ROLES } from "../js/core/constants.js";
import { hasPermission, requirePermission } from "../js/domain/rbac.js";

test("rbac: allowed actions", () => {
  assert.equal(hasPermission(ROLES.INVENTORY_MANAGER, PERMISSIONS.INVENTORY_UPDATE), true);
  assert.equal(hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.USERS_MANAGE), true);
  assert.equal(hasPermission(ROLES.STORE_MANAGER, PERMISSIONS.COUPONS_MANAGE), true);
});

test("rbac: denied actions", () => {
  assert.equal(hasPermission(ROLES.CUSTOMER, PERMISSIONS.PRODUCTS_DELETE), false);
  assert.equal(hasPermission(ROLES.SUPPORT_AGENT, PERMISSIONS.INVENTORY_UPDATE), false);
  assert.throws(() => requirePermission(ROLES.CUSTOMER, PERMISSIONS.AUDIT_READ));
});

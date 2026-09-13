import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../core/constants.js";

export const getPermissionsForRole = (role) =>
  ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];

export const hasPermission = (role, permission) => {
  if (!permission) return false;
  if (role === ROLES.SUPER_ADMIN) return true;
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
};

export const hasAnyPermission = (role, permissions = []) =>
  permissions.some((permission) => hasPermission(role, permission));

export const canAccessAdmin = (role) =>
  hasAnyPermission(role, Object.values(PERMISSIONS));

export const requirePermission = (role, permission) => {
  if (hasPermission(role, permission)) return true;
  const error = new Error("You do not have permission to perform this action.");
  error.code = "UNAUTHORIZED";
  error.permission = permission;
  error.role = role;
  throw error;
};

export default Object.freeze({
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  canAccessAdmin,
  requirePermission,
});

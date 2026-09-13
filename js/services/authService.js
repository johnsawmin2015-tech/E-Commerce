import { DEMO_PASSWORD_SALT, SESSION_TTL_MS } from "../core/config.js";
import { EVENT_NAMES, ROLES } from "../core/constants.js";
import { AppError, ErrorCodes } from "../core/errors.js";
import { emit } from "../core/eventBus.js";
import { patchState } from "../core/state.js";
import { hasPermission as roleHasPermission, canAccessAdmin } from "../domain/rbac.js";
import { userRepository } from "../data/repositories.js";
import { sanitizeEmail } from "../utils/sanitizer.js";
import { createId } from "../utils/helpers.js";
import { STORAGE_KEYS, readSessionStorage, writeSessionStorage, removeSessionStorage } from "../storage.js";

const SESSION_KEY = STORAGE_KEYS.SESSION;

const hashPassword = async (password, salt = DEMO_PASSWORD_SALT) => {
  const payload = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  if (typeof process !== "undefined" && process.versions?.node) {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(payload).digest("hex");
  }
  throw new AppError(ErrorCodes.DATABASE_FAILURE, "Password hashing is unavailable in this environment.");
};

const publicUser = (user) => {
  if (!user) return null;
  const { passwordHash, passwordSalt, ...safe } = user;
  return safe;
};

const sessionGuard = (value) =>
  Boolean(value && typeof value === "object" && typeof value.userId === "string"
    && value.userId && Object.values(ROLES).includes(value.role)
    && Number.isFinite(Date.parse(value.issuedAt))
    && Number.isFinite(Date.parse(value.expiresAt))
    && Date.parse(value.expiresAt) > Date.parse(value.issuedAt));

export const getGuestSessionId = () => {
  try {
    const existing = globalThis.sessionStorage?.getItem("morrow:guest-session");
    if (existing) return existing;
    const id = `guest-${createId()}`;
    globalThis.sessionStorage?.setItem("morrow:guest-session", id);
    return id;
  } catch {
    return "guest-memory";
  }
};

export const getActorId = () => getSession()?.userId || getGuestSessionId();

export const getSession = () => {
  const session = readSessionStorage(SESSION_KEY, null, sessionGuard);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    removeSessionStorage(SESSION_KEY);
    return null;
  }
  return session;
};

export const getCurrentUser = async () => {
  const session = getSession();
  if (!session) return null;
  const user = await userRepository.getById(session.userId);
  if (!user) logout();
  return publicUser(user);
};

export const restoreSession = async () => {
  const user = await getCurrentUser();
  const stored = getSession();
  if (user && stored && stored.role !== user.role) {
    if (!writeSessionStorage(SESSION_KEY, { ...stored, role: user.role }, sessionGuard)) {
      logout();
      return null;
    }
  }
  patchState({
    currentUser: user,
    session: getSession(),
  });
  return user;
};

/**
 * Demonstration-only sign-in. There is no trusted backend, so this is an
 * architectural simulation of authentication rather than production security.
 */
const signIn = async (email, password, { adminOnly = false } = {}) => {
  const normalized = sanitizeEmail(email);
  const users = await userRepository.getAll();
  const user = users.find((candidate) => candidate.email === normalized);
  if (!user) {
    throw new AppError(ErrorCodes.UNAUTHENTICATED, "Incorrect email or password.");
  }
  const hash = await hashPassword(password, user.passwordSalt || DEMO_PASSWORD_SALT);
  if (hash !== user.passwordHash) {
    throw new AppError(ErrorCodes.UNAUTHENTICATED, "Incorrect email or password.");
  }
  if (adminOnly && !canAccessAdmin(user.role)) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "This account does not have access to the admin portal. Use customer sign-in or an operations account.");
  }
  const session = {
    userId: user.id,
    role: user.role || ROLES.CUSTOMER,
    email: user.email,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  if (!writeSessionStorage(SESSION_KEY, session, sessionGuard)) {
    throw new AppError(ErrorCodes.DATABASE_FAILURE, "Unable to save your session. Allow browser session storage, then try again.");
  }
  const safe = publicUser(user);
  patchState({ currentUser: safe, session });
  emit(EVENT_NAMES.AUTH_LOGIN, { user: safe });
  return safe;
};

export const login = (email, password) => signIn(email, password);
export const authenticateAdmin = (email, password) => signIn(email, password, { adminOnly: true });

export const register = async ({ name, email, password }) => {
  const normalized = sanitizeEmail(email);
  const { validateName, validateEmail, validatePassword } = await import("../utils/validators.js");
  for (const result of [validateName(name), validateEmail(normalized), validatePassword(password)]) {
    if (result !== true) throw new AppError(ErrorCodes.INVALID_INPUT, result);
  }
  const users = await userRepository.getAll();
  if (users.some((user) => user.email === normalized)) {
    throw new AppError(ErrorCodes.DUPLICATE_RECORD, "An account with that email already exists in this browser.");
  }
  const passwordHash = await hashPassword(password);
  await userRepository.save({
    email: normalized,
    name: String(name || "").trim(),
    role: ROLES.CUSTOMER,
    passwordSalt: DEMO_PASSWORD_SALT,
    passwordHash,
    addresses: [],
  });
  return login(normalized, password);
};

/**
 * Merge profile fields onto the stored user. Credential and role fields stay
 * on the IndexedDB record even when the caller only has a public user object.
 */
export const updateCurrentUser = async (patch = {}) => {
  const session = getSession();
  if (!session?.userId) {
    throw new AppError(ErrorCodes.UNAUTHENTICATED, "Sign in to update this demonstration account.");
  }
  const stored = await userRepository.getById(session.userId);
  if (!stored) {
    throw new AppError(ErrorCodes.NOT_FOUND, "That demonstration account was not found.");
  }
  const blocked = new Set(["passwordHash", "passwordSalt", "id", "email", "role"]);
  const safePatch = Object.fromEntries(
    Object.entries(patch && typeof patch === "object" ? patch : {}).filter(([key]) => !blocked.has(key)),
  );
  const saved = await userRepository.save({
    ...stored,
    ...safePatch,
    id: stored.id,
    email: stored.email,
    role: stored.role,
    passwordHash: stored.passwordHash,
    passwordSalt: stored.passwordSalt,
  });
  const safe = publicUser(saved);
  patchState({ currentUser: safe });
  return safe;
};

export const logout = () => {
  removeSessionStorage(SESSION_KEY);
  patchState({ currentUser: null, session: null });
  emit(EVENT_NAMES.AUTH_LOGOUT, {});
};

export const hasPermission = (permission, user) => {
  const session = getSession();
  const role = user?.role || session?.role || ROLES.CUSTOMER;
  return roleHasPermission(role, permission);
};

export const requirePermission = (permission) => {
  if (hasPermission(permission)) return true;
  throw new AppError(
    ErrorCodes.UNAUTHORIZED,
    "You do not have permission to perform this action in this demonstration.",
    { details: { permission } },
  );
};

export const userCanAccessAdmin = (user) => canAccessAdmin(user?.role || getSession()?.role);

export { hashPassword };

export default Object.freeze({
  login,
  logout,
  register,
  updateCurrentUser,
  getSession,
  getCurrentUser,
  restoreSession,
  hasPermission,
  requirePermission,
});

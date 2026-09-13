import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key) { return this.#values.has(String(key)) ? this.#values.get(String(key)) : null; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  removeItem(key) { this.#values.delete(String(key)); }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
}

const eventBus = new EventTarget();
globalThis.window = globalThis;
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.addEventListener = eventBus.addEventListener.bind(eventBus);
globalThis.removeEventListener = eventBus.removeEventListener.bind(eventBus);
globalThis.dispatchEvent = eventBus.dispatchEvent.bind(eventBus);

const { resetDatabaseForTests } = await import("../js/data/database.js");
const { userRepository } = await import("../js/data/repositories.js");
const auth = await import("../js/services/authService.js");

test("saving a profile does not strip the stored password hash", async () => {
  await resetDatabaseForTests();
  const created = await auth.register({
    name: "Avery Chen",
    email: "profile@morrow.demo",
    password: "MorrowDemo!1",
  });
  const before = await userRepository.getById(created.id);
  assert.ok(before.passwordHash);

  await auth.updateCurrentUser({
    passwordHash: "should-not-stick",
    addresses: [{ id: "addr-1", label: "Home", address: "18 Harbor Lane", city: "San Francisco" }],
  });

  const after = await userRepository.getById(created.id);
  assert.equal(after.passwordHash, before.passwordHash);
  assert.equal(after.addresses.length, 1);
  const signedIn = await auth.login("profile@morrow.demo", "MorrowDemo!1");
  assert.equal(signedIn.id, created.id);
});

test("admin sign-in checks the role before creating a session", async () => {
  const { ROLES } = await import("../js/core/constants.js");
  const customer = await auth.register({ name: "Demo Customer", email: "customer-test@example.com", password: "SamplePass9" });
  auth.logout();
  await assert.rejects(auth.authenticateAdmin(customer.email, "SamplePass9"), { code: "UNAUTHORIZED" });
  assert.equal(auth.getSession(), null);
  const stored = await userRepository.getById(customer.id);
  await userRepository.save({ ...stored, role: ROLES.ADMINISTRATOR });
  const admin = await auth.authenticateAdmin(customer.email, "SamplePass9");
  assert.equal(admin.role, ROLES.ADMINISTRATOR);
  assert.equal(auth.getSession().userId, customer.id);
});

test("authentication fails without reporting a session when storage is blocked", async () => {
  auth.logout();
  const storage = globalThis.sessionStorage;
  globalThis.sessionStorage = { setItem() { throw new Error("Storage blocked"); }, getItem() { return null; } };
  try {
    await assert.rejects(auth.login("customer-test@example.com", "SamplePass9"), { code: "DATABASE_FAILURE" });
    assert.equal(auth.getSession(), null);
    globalThis.sessionStorage = undefined;
    await assert.rejects(auth.login("customer-test@example.com", "SamplePass9"), { code: "DATABASE_FAILURE" });
  } finally { globalThis.sessionStorage = storage; }
});

test("malformed, missing-expiry and expired sessions are rejected", async () => {
  const { getStorageKey, STORAGE_KEYS } = await import("../js/storage.js");
  const key = getStorageKey(STORAGE_KEYS.SESSION);
  for (const value of [
    { userId: "x", role: "administrator" },
    { userId: "x", role: "administrator", issuedAt: "invalid", expiresAt: "invalid" },
    { userId: "x", role: "administrator", issuedAt: "2020-01-01", expiresAt: "2020-01-02" },
  ]) {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, value }));
    assert.equal(auth.getSession(), null);
  }
});

test("deleted accounts cannot restore a stale session", async () => {
  const user = await auth.login("customer-test@example.com", "SamplePass9");
  await userRepository.remove(user.id);
  assert.equal(await auth.restoreSession(), null);
  assert.equal(auth.getSession(), null);
});

test("admin return destinations are local, known and allowed for the role", async () => {
  const { getAdminDestination } = await import("../js/domain/adminRoutes.js");
  const { ROLES } = await import("../js/core/constants.js");
  assert.equal(getAdminDestination("inventory.html", ROLES.ADMINISTRATOR), "inventory.html");
  assert.equal(getAdminDestination("https://example.com", ROLES.ADMINISTRATOR), "dashboard.html");
  assert.equal(getAdminDestination("../account.html", ROLES.ADMINISTRATOR), "dashboard.html");
  assert.equal(getAdminDestination("dashboard.html", ROLES.CUSTOMER), null);
  const { ADMIN_LINKS } = await import("../js/domain/adminRoutes.js");
  for (const role of Object.values(ROLES).filter((role) => role !== ROLES.CUSTOMER)) {
    const destination = getAdminDestination("settings.html", role);
    assert.ok(ADMIN_LINKS.some((link) => link.href === destination && auth.hasPermission(link.permission, { role })));
  }
});

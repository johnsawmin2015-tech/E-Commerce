import test from "node:test";
import assert from "node:assert/strict";
import { resetDatabaseForTests } from "../js/data/database.js";
import { seedDatabase } from "../js/data/seed.js";

test("atomic writes roll back every store on failure and detach references", async () => {
  const db = await resetDatabaseForTests();
  await db.put("inventory", { id: "i", onHand: 2 });
  await assert.rejects(db.atomic(["inventory", "orders"], (tx) => {
    tx.put("inventory", { id: "i", onHand: 0 });
    tx.put("orders", { id: "o" });
    throw new Error("Injected write failure");
  }));
  assert.equal((await db.get("inventory", "i")).onHand, 2);
  assert.equal(await db.get("orders", "o"), null);
  const detached = await db.get("inventory", "i");
  detached.onHand = 900;
  assert.equal((await db.get("inventory", "i")).onHand, 2);
});

test("concurrent units of work see the latest committed stock", async () => {
  const db = await resetDatabaseForTests();
  await db.put("inventory", { id: "i", onHand: 1 });
  const buy = () => db.atomic(["inventory"], (tx) => {
    const row = tx.get("inventory", "i");
    if (!row.onHand) throw new Error("Sold out");
    tx.put("inventory", { ...row, onHand: row.onHand - 1 });
  });
  const results = await Promise.allSettled([buy(), buy()]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await db.get("inventory", "i")).onHand, 0);
});

test("seed replay preserves edits and deliberately removed products", async () => {
  const db = await resetDatabaseForTests();
  await seedDatabase();
  await db.put("users", { id: "user-admin", email: "admin@morrow.demo", role: "customer", passwordHash: "changed" });
  await db.put("inventory", { id: "inv-prod-001", productId: "prod-001", onHand: 7, reserved: 0 });
  const rows = await db.getAll("products");
  for (const row of rows.slice(0, 30)) await db.delete("products", row.id);
  await seedDatabase();
  assert.equal(await db.count("products"), 994);
  assert.equal((await db.get("users", "user-admin")).passwordHash, "changed");
  assert.equal((await db.get("inventory", "inv-prod-001")).onHand, 7);
  assert.equal(await db.count("analyticsEvents"), 0);
});

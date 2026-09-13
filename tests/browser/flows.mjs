import { chromium, axePath, baseUrl, qaPath } from "./runtime.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const base = baseUrl;
const passed = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const check = (name) => {
  passed.push(name);
  console.log("PASS", name);
};
const go = async (route) => {
  await page.goto(base + route);
  await page.evaluate(
    async () => await (await import("/js/core/app.js")).appReady(),
  );
};
const creds = async (email, password = "MorrowDemo!1") => {
  await page.locator("#admin-email:enabled").fill(email);
  await page.locator("#admin-password").fill(password);
};
const adminSubmit = () =>
  page.getByRole("button", { name: "Sign in to admin" }).click();
const axeCheck = async (name) => {
  await page.addScriptTag({ path: axePath });
  const a = await page.evaluate(async () =>
    (
      await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      })
    ).violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  );
  assert.deepEqual(a, [], name);
  check(name + " accessibility");
};
try {
  await go("admin/inventory.html");
  await page.waitForURL("**/login.html?**");
  assert.ok(page.url().includes("next=inventory.html"));
  check("protected route redirects to login with local return path");
  await page.locator("#admin-email:enabled").waitFor();
  await adminSubmit();
  assert.equal(
    await page.locator("#admin-email-error").textContent(),
    "Please enter your email address.",
  );
  assert.equal(
    await page.locator("#admin-password-error").textContent(),
    "Please enter your password.",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "admin-email",
  );
  check("empty fields show associated inline errors and focus");
  await page.locator("#admin-email").fill("invalid");
  await adminSubmit();
  assert.equal(
    await page.locator("#admin-email").getAttribute("aria-invalid"),
    "true",
  );
  check("invalid email rejected");
  await creds("admin@morrow.demo", "wrong");
  await adminSubmit();
  await page.locator("[data-form-feedback]:not([hidden])").waitFor();
  assert.match(
    await page.locator("[data-form-feedback]").textContent(),
    /Incorrect email or password/,
  );
  assert.equal(await page.locator("[type=submit]").isEnabled(), true);
  check("invalid credentials preserve input and restore CTA");
  await creds("customer@morrow.demo");
  await adminSubmit();
  await page.locator("[data-form-feedback]:not([hidden])").waitFor();
  assert.match(
    await page.locator("[data-form-feedback]").textContent(),
    /does not have access/,
  );
  assert.equal(
    await page.evaluate(async () =>
      (await import("/js/services/authService.js")).getSession(),
    ),
    null,
  );
  check("non-admin sign-in rejected without creating session");
  await page.getByRole("button", { name: "Show password" }).click();
  assert.equal(
    await page.locator("#admin-password").getAttribute("type"),
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  assert.equal(
    await page.locator("#admin-password").getAttribute("type"),
    "password",
  );
  check("password toggle changes input and accessible label");
  await page.locator(".auth-help summary").click();
  assert.equal(await page.locator(".auth-help").getAttribute("open"), "");
  await page.locator(".auth-help summary").click();
  check("access help disclosure works without fake recovery");
  await page.setViewportSize({ width: 320, height: 800 });
  await axeCheck("admin login errors at 320px");
  await page.screenshot({
    path: qaPath("morrow-login-mobile.png"),
    fullPage: true,
  });
  // Delay the browser hash only in this isolated QA context to inspect in-flight state.
  await page.evaluate(() => {
    const native = crypto.subtle.digest.bind(crypto.subtle);
    window.digestCalls = 0;
    window.realDigest = native;
    crypto.subtle.digest = async (...a) => {
      window.digestCalls++;
      await new Promise((r) => setTimeout(r, 300));
      return native(...a);
    };
  });
  await creds("admin@morrow.demo");
  await page.locator("#admin-password").press("Enter");
  assert.equal(await page.locator("[type=submit]").isDisabled(), true);
  assert.match(await page.locator("[type=submit]").textContent(), /Signing in/);
  await page.locator("form").evaluate((f) => {
    f.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    f.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  });
  await page.waitForFunction(() => window.digestCalls === 1);
  assert.equal(await page.evaluate(() => window.digestCalls), 1);
  await page.waitForURL("**/inventory.html");
  check(
    "Enter submits, loading is visible, duplicate submissions blocked, return redirect works",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(
    await page.locator(".admin-navigation").getAttribute("open"),
    "",
  );
  await go("admin/products.html");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/login.html?reason=signedout");
  await page.locator("#admin-email:enabled").waitFor();
  assert.match(await page.locator("#auth-status").textContent(), /signed out/);
  await page.goBack();
  await page.waitForURL("**/login.html?**");
  assert.equal(await page.locator(".admin-shell").count(), 0);
  check("logout and back navigation do not reveal protected content");
  await creds("inventory@morrow.demo");
  await adminSubmit();
  await page.waitForURL(/\/(products|inventory)\.html$/);
  check("restricted operations role receives an allowed landing page");
  await go("admin/settings.html");
  await page.getByRole("heading", { name: "Permission required" }).waitFor();
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await page.waitForURL("**/products.html");
  check("denied page offers an allowed destination instead of a redirect loop");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/login.html?**");
  await creds("admin@morrow.demo");
  await adminSubmit();
  await page.waitForURL("**/dashboard.html");
  await page.evaluate(async () => {
    const { getStorageKey, STORAGE_KEYS } = await import("/js/storage.js");
    const k = getStorageKey(STORAGE_KEYS.SESSION),
      e = JSON.parse(sessionStorage.getItem(k));
    e.value.issuedAt = new Date(Date.now() - 10000).toISOString();
    e.value.expiresAt = new Date(Date.now() + 1200).toISOString();
    sessionStorage.setItem(k, JSON.stringify(e));
  });
  await go("admin/products.html");
  await page.waitForURL("**/login.html?**");
  assert.ok(page.url().includes("expired"));
  check("live session expiry hides workspace and asks for sign-in");
  await go("account.html");
  await page.locator("#register-name").fill("QA Local");
  await page.locator("#register-email").fill("qa-local@example.com");
  await page.locator("#register-password").fill("LocalTest9");
  await page.locator("#register-form [type=submit]").click();
  await page.locator("#account-profile-title").waitFor();
  assert.equal(
    await page.locator('.desktop-nav a[href="./account.html"]').textContent(),
    "Account",
  );
  check("registration and header session state update");
  for (const [id, value] of Object.entries({
    "addr-label": "Home",
    "addr-line": "18 Harbor Lane",
    "addr-city": "Portland",
    "addr-region": "Oregon",
    "addr-postal": "97201",
  }))
    await page.locator("#" + id).fill(value);
  await page.locator("#address-form [type=submit]").click();
  await page.getByText("18 Harbor Lane, Portland").waitFor();
  await page.reload();
  await page.getByText("18 Harbor Lane, Portland").waitFor();
  await page.locator("[data-address-remove]").click();
  await page.getByText("No saved addresses yet.").waitFor();
  check("saved address create, reload and removal preserve credentials");
  await page.locator("#logout-button").click();
  await page.locator("#login-email").fill("qa-local@example.com");
  await page.locator("#login-password").fill("LocalTest9");
  await page.locator("#login-form [type=submit]").click();
  await page.locator("#account-profile-title").waitFor();
  check("customer login still works after profile updates");
  await go("shop.html");
  await page.setViewportSize({ width: 320, height: 800 });
  await page.locator("#mobile-menu-toggle").click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#mobile-menu-toggle").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "mobile-menu-toggle",
  );
  check("mobile menu Escape restores focus");
  await page.locator("[data-wishlist-id]").first().click();
  await page.locator("[data-compare-id]").nth(0).click();
  await go("compare.html");
  await page.locator(".compare-table").waitFor();
  await page.locator("[data-remove]").click();
  await page
    .getByRole("heading", { name: "Add at least two products" })
    .waitFor();
  check("single comparison entry remains removable");
  await go("shop.html");
  await page.locator("[data-quick-add]:enabled").first().click();
  await page.locator("#cart-drawer:not([hidden])").waitFor();
  await page.keyboard.press("Escape");
  await go("cart.html");
  await page.locator(".cart-item").first().waitFor();
  await axeCheck("populated cart");
  check("wishlist, quick add and cart drawer preserve commerce");
  await go("checkout.html");
  for (const [name, value] of Object.entries({
    name: "QA Local",
    email: "qa-local@example.com",
    phone: "2025550123",
  }))
    await page.locator(`#checkout-form [name="${name}"]`).fill(value);
  await page.locator("[name=phone]").press("Enter");
  await page.locator("[data-checkout-step=shipping]:not([hidden])").waitFor();
  check("checkout Enter advances the current step");
  for (const [name, value] of Object.entries({
    address: "18 Harbor Lane",
    city: "Portland",
    region: "Oregon",
    postalCode: "97201",
  }))
    await page.locator(`#checkout-form [name="${name}"]`).fill(value);
  await page.locator("[name=country]").selectOption("US");
  await page.locator("#checkout-next").click();
  await page.locator("#checkout-next").click();
  await page.locator("#checkout-next").click();
  await page.locator("#place-order-button").click();
  await page.waitForURL("**/order-success.html");
  await page.locator(".order-success__reference").waitFor();
  check("complete simulated checkout reaches confirmation");
  await go("orders.html");
  await page.locator("[data-order-change]").first().click();
  await page.getByText("cancelled", { exact: false }).first().waitFor();
  check("customer order cancellation works");
  await go("admin/login.html");
  await creds("admin@morrow.demo");
  await adminSubmit();
  await page.waitForURL("**/dashboard.html");
  await go("admin/categories.html");
  await page.locator("#category-form [name=name]").fill("QA category");
  await page
    .locator("#category-form [name=subcategories]")
    .fill("QA subcategory");
  await page.locator("#category-form [type=submit]").click();
  await page.getByRole("cell", { name: "QA category", exact: true }).waitFor();
  await page
    .getByRole("row")
    .filter({ hasText: "QA category" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  assert.equal(
    await page.locator("#category-form h2").textContent(),
    "Edit category",
  );
  await page.locator("#category-form [name=name]").fill("QA renamed");
  await page.locator("#category-form [type=submit]").click();
  await page.getByRole("cell", { name: "QA renamed", exact: true }).waitFor();
  await page
    .getByRole("row")
    .filter({ hasText: "QA renamed" })
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await page
    .getByRole("cell", { name: "QA renamed", exact: true })
    .waitFor({ state: "detached" });
  check("admin categories create, edit and remove");
  await go("admin/products.html");
  await page.getByRole("button", { name: "New product", exact: true }).click();
  await page.locator("#product-form [name=name]").fill("QA Product");
  await page.locator("#product-form [name=brand]").fill("QA");
  await page.locator("#product-form [name=price]").fill("20");
  await page.locator("#product-form [name=stock]").fill("4");
  await page.locator("#product-form [type=submit]").click();
  await page.locator("#product-form").waitFor({ state: "hidden" });
  assert.equal(new URL(page.url()).search, "");
  assert.equal(
    await page.evaluate(async () =>
      Boolean(
        (await import("/js/services/product-service.js"))
          .getAllProducts()
          .find((p) => p.name === "QA Product"),
      ),
    ),
    true,
  );
  check(
    "admin product form persists a new record without native GET submission",
  );
  await go("admin/inventory.html");
  const adjust = page.locator("[data-adjust]").first();
  await adjust.locator("input").fill("-99999");
  await adjust.locator("button").click();
  await page
    .locator(".toast--error")
    .filter({ hasText: "On-hand stock cannot fall below reserved units." })
    .waitFor();
  assert.equal(await adjust.locator("button").isEnabled(), true);
  check(
    "invalid inventory adjustment returns control without uncaught rejection",
  );
  await go("tests/index.html");
  await page
    .getByText(/12.*12|12 passed/)
    .first()
    .waitFor();
  check("native browser domain suite");
  assert.deepEqual(errors, []);
  check("no console errors or unhandled exceptions");
} catch (e) {
  console.error(e);
  await page.screenshot({
    path: qaPath("morrow-flow-failure.png"),
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    qaPath("morrow-flows.json"),
    JSON.stringify({ passed, errors, url: page.url() }, null, 2),
  );
  await browser.close();
}

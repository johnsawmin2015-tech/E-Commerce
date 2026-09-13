import { chromium, axePath, baseUrl, qaPath } from "./runtime.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const b = await chromium.launch({ channel: "chrome" }),
  p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.setDefaultTimeout(12000);
const errors = [],
  passed = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const go = async (r) => {
  await p.goto(baseUrl + r);
  await p.evaluate(
    async () => await (await import("/js/core/app.js")).appReady(),
  );
};
const check = (n) => {
  passed.push(n);
  console.log("PASS", n);
};
try {
  await go("shop.html");
  await p.locator("#shop-search").fill("linen");
  await p.locator("#shop-search").press("Enter");
  await p.waitForURL("**/*q=linen*");
  await p.locator("#sort-select").selectOption("price-asc");
  assert.ok((await p.locator(".product-card").count()) > 0);
  await p.setViewportSize({ width: 375, height: 850 });
  await p.locator("#filter-drawer-toggle").click();
  await p.keyboard.press("Escape");
  assert.equal(
    await p.locator("#filter-drawer-toggle").getAttribute("aria-expanded"),
    "false",
  );
  check("search, sort and mobile filter drawer");
  await go("product.html?id=prod-001");
  await p.locator("[data-option=color]").first().click();
  await p.locator("[data-option=size]").first().click();
  await p.locator("#product-add-to-cart").click();
  await p.locator("#cart-drawer:not([hidden])").waitFor();
  await p.locator("#cart-drawer-close").click();
  check("product options and add to bag");
  await p.evaluate(async () => {
    const cart = await import("/js/cart.js");
    const item = cart.getCart()[0];
    cart.updateCartItem(item.itemKey, 3);
  });
  await go("cart.html");
  await p.locator("#promotion-code").fill("SAVE25");
  await p.locator("#promotion-form [type=submit]").click();
  await p.getByText("Discount (SAVE25)", { exact: true }).waitFor();
  const cartTotal = await p.locator(".summary-card__total dd").textContent();
  await go("checkout.html");
  assert.equal(
    await p.locator(".summary-card__total dd").textContent(),
    cartTotal,
  );
  check("SAVE25 promotion totals match between cart and checkout");
  await go("cart.html");
  await p.locator("#promotion-code").fill("EXPIRED10");
  await p.locator("#promotion-form [type=submit]").click();
  await p
    .locator("#promotion-message")
    .filter({ hasText: "expired" })
    .waitFor();
  assert.equal(
    await p.locator("#promotion-code").getAttribute("aria-invalid"),
    "true",
  );
  await p.locator("#promotion-code").fill("");
  await p.locator("#promotion-form [type=submit]").click();
  await p.locator(".summary-card__discount").waitFor({ state: "detached" });
  check("expired code feedback and promotion removal");
  await go("admin/login.html");
  await p.locator("#admin-email:enabled").fill("admin@morrow.demo");
  await p.locator("#admin-password").fill("MorrowDemo!1");
  await p.locator("[type=submit]").click();
  await p.waitForURL("**/dashboard.html");
  await go("admin/coupons.html");
  await p.locator("[name=code]").fill("QAUI10");
  await p.locator("[name=value]").fill("10");
  await p.locator("#coupon-form [type=submit]").click();
  const row = p.getByRole("row").filter({ hasText: "QAUI10" });
  await row.waitFor();
  await row.getByRole("button", { name: "Pause" }).click();
  await row.getByRole("button", { name: "Activate" }).waitFor();
  await row.getByRole("button", { name: "Activate" }).click();
  await row.getByRole("button", { name: "Pause" }).waitFor();
  check("coupon create, pause and activate persist");
  await go("admin/inventory.html");
  const first = p.locator(".admin-table tbody tr").first();
  const before = Number(await first.locator("td").nth(1).textContent());
  await first.locator("input").fill("1");
  await first.getByRole("button", { name: "Apply" }).click();
  await p.waitForFunction(
    (n) =>
      Number(
        document.querySelector(".admin-table tbody tr td:nth-child(2)")
          .textContent,
      ) === n,
    before + 1,
  );
  await p.reload();
  await p.waitForFunction(
    (n) =>
      Number(
        document.querySelector(".admin-table tbody tr td:nth-child(2)")
          ?.textContent,
      ) === n,
    before + 1,
  );
  check("inventory adjustment persists and remains on current page");
  await go("admin/products.html");
  await p
    .locator(".admin-pagination")
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await p.getByText("Page 2 of 21", { exact: false }).waitFor();
  check("admin product pagination");
  assert.deepEqual(errors, []);
  check("no console errors");
} catch (e) {
  console.error(e);
  await p.screenshot({
    path: qaPath("morrow-extras-failure.png"),
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    qaPath("morrow-extras.json"),
    JSON.stringify({ passed, errors }, null, 2),
  );
  await b.close();
}

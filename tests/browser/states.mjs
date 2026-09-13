import { chromium, axePath, baseUrl, qaPath } from "./runtime.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const b = await chromium.launch({ channel: "chrome" }),
  c = await b.newContext(),
  p = await c.newPage();
p.setDefaultTimeout(12000);
const base = baseUrl,
  results = [],
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const go = async (url) => {
  await p.goto(base + url);
  await p.evaluate(
    async () => await (await import("/js/core/app.js")).appReady(),
  );
};
const scan = async (name) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await p.setViewportSize({ width, height: 900 });
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      name + width,
    );
  }
  for (const width of [320, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    await p.addScriptTag({ path: axePath });
    const v = await p.evaluate(async () =>
      (
        await axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        })
      ).violations.map((x) => ({ id: x.id, n: x.nodes.map((n) => n.target) })),
    );
    assert.deepEqual(v, [], name + width);
    await p.screenshot({
      path: qaPath(`morrow-${name}-${width}.png`),
      fullPage: true,
    });
  }
  results.push(name);
  console.log("PASS", name);
};
try {
  await go("admin/login.html");
  await p.locator("#admin-email:enabled").waitFor();
  await scan("login");
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p
    .locator("[type=submit]")
    .evaluate((e) => e.classList.add("is-loading"));
  assert.equal(
    await p
      .locator("[type=submit]")
      .evaluate((e) => getComputedStyle(e, "::before").animationName),
    "none",
  );
  await p
    .locator("[type=submit]")
    .evaluate((e) => e.classList.remove("is-loading"));
  await p.emulateMedia({ reducedMotion: "no-preference" });
  await p.locator("#admin-email").focus();
  assert.notEqual(
    await p
      .locator("#admin-email")
      .evaluate((e) => getComputedStyle(e).outlineStyle),
    "none",
  );
  await p.keyboard.press("Tab");
  assert.equal(
    await p.evaluate(() => document.activeElement.id),
    "admin-password",
  );
  await p.keyboard.press("Tab");
  assert.equal(
    await p
      .locator("[data-password-toggle]")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  console.log("PASS keyboard order and reduced motion");
  await go("account.html");
  await p.locator("#login-form").waitFor();
  await scan("customer-auth");
  await go("shop.html");
  await p.evaluate(async () => {
    const products = (
      await import("/js/services/product-service.js")
    ).getProducts();
    const { addToCart } = await import("/js/cart.js");
    const { toggleWishlist } = await import("/js/wishlist.js");
    const { toggleComparison } =
      await import("/js/features/comparison/comparisonService.js");
    for (const pr of products.slice(0, 2)) {
      toggleWishlist(pr.id);
      toggleComparison(pr.id);
    }
    const pr = products[0];
    addToCart(pr.id, 1, {
      color:
        typeof pr.colors[0] === "string" ? pr.colors[0] : pr.colors[0].name,
      size: pr.sizes[0],
    });
  });
  for (const [url, name] of [
    ["cart.html", "populated-cart"],
    ["wishlist.html", "populated-wishlist"],
    ["compare.html", "populated-compare"],
    ["checkout.html", "checkout-contact"],
  ]) {
    await go(url);
    await scan(name);
  }
  await p.setViewportSize({ width: 320, height: 900 });
  await p.locator("#checkout-next").click();
  await scan("checkout-errors");
  const blocked = await b.newContext();
  await blocked.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (this === sessionStorage && k === "ecommerce:v1:session")
        throw new DOMException("Blocked", "SecurityError");
      return original.call(this, k, v);
    };
  });
  const q = await blocked.newPage();
  await q.goto(base + "admin/login.html");
  await q.locator("#admin-email:enabled").fill("admin@morrow.demo");
  await q.locator("#admin-password").fill("MorrowDemo!1");
  await q.locator("[type=submit]").click();
  await q.locator("[data-form-feedback]:not([hidden])").waitFor();
  assert.match(
    await q.locator("[data-form-feedback]").textContent(),
    /Unable to save your session/,
  );
  assert.equal(await q.locator("[type=submit]").isEnabled(), true);
  console.log("PASS blocked session storage recovery");
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log("PASS no exceptions");
} catch (e) {
  console.error(e);
  console.log(
    await p.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width &&
            r.height &&
            (r.right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 1)
          );
        })
        .slice(0, 30)
        .map((e) => ({
          tag: e.tagName,
          c: e.className,
          id: e.id,
          r: e.getBoundingClientRect().toJSON(),
          scroll: e.scrollWidth,
          client: e.clientWidth,
        })),
    ),
  );
  await p.screenshot({
    path: qaPath("morrow-state-failure.png"),
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    qaPath("morrow-states.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  await b.close();
}

import { chromium, axePath, baseUrl, qaPath } from "./runtime.mjs";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const base = baseUrl;
const report = [];
await page.goto(base + "admin/login.html");
await page.locator("#admin-email:enabled").waitFor();
await page.screenshot({
  path: qaPath("morrow-login-desktop.png"),
  fullPage: true,
});
await page.locator("#admin-email").fill("admin@morrow.demo");
await page.locator("#admin-password").fill("MorrowDemo!1");
await page.getByRole("button", { name: "Sign in to admin" }).click();
await page.waitForURL("**/dashboard.html");
const productId = await page.evaluate(
  async () =>
    (await import("/js/services/product-service.js")).getProducts()[0].id,
);
const routes = [
  "index.html",
  "shop.html",
  `product.html?id=${productId}`,
  "product.html?id=missing",
  "cart.html",
  "checkout.html",
  "wishlist.html",
  "compare.html",
  "orders.html",
  "order-success.html",
  "account.html",
  ...[
    "dashboard",
    "products",
    "categories",
    "inventory",
    "orders",
    "customers",
    "reviews",
    "coupons",
    "analytics",
    "audit-logs",
    "settings",
  ].map((x) => `admin/${x}.html`),
];
for (const route of routes) {
  await page.goto(base + route);
  await page.evaluate(
    async () => await (await import("/js/core/app.js")).appReady(),
  );
  await page.waitForTimeout(80);
  const result = { route, widths: [], axe: [] };
  for (const width of [
    320, 375, 390, 430, 768, 1024, 1117, 1279, 1280, 1440, 1920,
  ]) {
    await page.setViewportSize({ width, height: 900 });
    const problems = await page.evaluate(() => {
      const visible = (e) => {
        const r = e.getBoundingClientRect();
        const c = getComputedStyle(e);
        return (
          r.width &&
          r.height &&
          c.visibility !== "hidden" &&
          c.display !== "none"
        );
      };
      const overflow = [...document.querySelectorAll("body *")]
        .filter(
          (e) =>
            visible(e) &&
            !e.closest(
              ".admin-table-wrap,.compare-table-wrap,.product-gallery__thumbnails,.sr-only,.skip-link",
            ),
        )
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.left < -1 || r.right > innerWidth + 1;
        })
        .slice(0, 12)
        .map((e) => ({
          tag: e.tagName,
          cls: e.className,
          id: e.id,
          x: e.getBoundingClientRect().x,
          w: e.getBoundingClientRect().width,
        }));
      const header = document.querySelector(".site-header__inner");
      let collisions = [];
      if (header) {
        const els = [...header.children].filter(visible);
        for (let i = 0; i < els.length; i++)
          for (let j = i + 1; j < els.length; j++) {
            let a = els[i].getBoundingClientRect(),
              b = els[j].getBoundingClientRect();
            if (
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
            )
              collisions.push([els[i].className, els[j].className]);
          }
      }
      return {
        scroll: document.documentElement.scrollWidth,
        overflow,
        collisions,
        busy: [...document.querySelectorAll('[aria-busy="true"]')]
          .filter(visible)
          .map((e) => e.id),
      };
    });
    if (
      problems.overflow.length ||
      problems.collisions.length ||
      problems.busy.length ||
      problems.scroll > width
    )
      result.widths.push({ width, ...problems });
  }
  await page.addScriptTag({ path: axePath });
  const axe = await page.evaluate(async () =>
    (
      await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      })
    ).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target).slice(0, 5),
    })),
  );
  result.axe = axe;
  report.push(result);
  console.log(JSON.stringify(result));
}
await fs.writeFile(
  qaPath("morrow-audit.json"),
  JSON.stringify({ report, errors }, null, 2),
);
console.log("ERRORS", errors);
await browser.close();

if (errors.length || report.some((row) => row.axe.length || row.widths.length))
  process.exitCode = 1;

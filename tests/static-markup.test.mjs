import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "index.html",
  "shop.html",
  "product.html",
  "cart.html",
  "wishlist.html",
  "checkout.html",
  "order-success.html",
];

const readPage = (page) => readFileSync(resolve(root, page), "utf8");

test("all storefront pages expose core semantic landmarks", () => {
  pages.forEach((page) => {
    const html = readPage(page);
    assert.match(html, /<title>[^<]+<\/title>/i, `${page} needs a title`);
    assert.match(html, /<main\b/i, `${page} needs a main landmark`);
    if (page === "product.html") {
      assert.match(html, /id="product-view"/i, `${page} needs its dynamic product landmark`);
    } else {
      assert.match(html, /<h1\b/i, `${page} needs a primary heading`);
    }
    assert.match(html, /<script\b[^>]*type="module"/i, `${page} needs a module entry point`);
  });
});

test("static IDs are unique within every page", () => {
  pages.forEach((page) => {
    const ids = [...readPage(page).matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${page} contains a duplicate id`);
  });
});

test("local HTML asset and navigation targets exist", () => {
  pages.forEach((page) => {
    const references = [...readPage(page).matchAll(/\s(?:href|src)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((value) => !/^(?:#|https?:|mailto:|tel:|data:|javascript:)/i.test(value));

    references.forEach((reference) => {
      const localPath = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
      assert.ok(
        existsSync(resolve(root, localPath)),
        `${page} references missing local target ${reference}`,
      );
    });
  });
});

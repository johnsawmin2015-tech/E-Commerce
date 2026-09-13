import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

// Browser tools are optional QA dependencies, never storefront dependencies.
const modules = process.env.MORROW_QA_MODULES;
const playwright = modules
  ? pathToFileURL(resolve(modules, "playwright/index.mjs")).href
  : "playwright";
export const { chromium } = await import(playwright);
const require = createRequire(import.meta.url);
export const axePath = modules
  ? resolve(modules, "axe-core/axe.min.js")
  : require.resolve("axe-core/axe.min.js");
export const baseUrl =
  (process.env.MORROW_QA_URL || "http://127.0.0.1:8765").replace(/\/$/, "") +
  "/";
const output = process.env.MORROW_QA_OUTPUT || join(tmpdir(), "morrow-ui-qa");
await mkdir(output, { recursive: true });
export const qaPath = (name) => join(output, name);

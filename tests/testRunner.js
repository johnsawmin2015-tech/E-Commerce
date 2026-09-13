/**
 * Lightweight browser test runner for Morrow domain tests.
 * Open tests/index.html through a local HTTP server.
 */
const results = [];

export const test = async (name, fn) => {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message || String(error) });
  }
};

export const assertEqual = (actual, expected, message = "") => {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, received ${actual}`);
  }
};

export const assertOk = (value, message) => {
  if (!value) throw new Error(message || "Expected a truthy value");
};

export const renderResults = (mount) => {
  if (!mount) return results;
  mount.innerHTML = `
    <p>${results.filter((row) => row.ok).length} passed · ${results.filter((row) => !row.ok).length} failed</p>
    <ol>${results.map((row) => `<li>${row.ok ? "pass" : "fail"} — ${row.name}${row.error ? `: ${row.error}` : ""}</li>`).join("")}</ol>
  `;
  return results;
};

export default { test, assertEqual, assertOk, renderResults };

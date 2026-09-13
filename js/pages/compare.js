import { appReady } from "../core/app.js";
import { escapeHtml, formatCurrency } from "../utils.js";
import {
  getComparisonProducts,
  removeFromComparison,
  clearComparison,
  canCompare,
} from "../features/comparison/comparisonService.js";
import { showToast } from "../ui.js";

await appReady().catch(() => {});

const mount = document.querySelector("#compare-page");

const rows = [
  ["Brand", (product) => product.brand],
  ["Category", (product) => product.category],
  ["Subcategory", (product) => product.subcategory || "—"],
  ["Price", (product) => formatCurrency(product.price)],
  ["Rating", (product) => `${product.rating} (${product.reviewCount})`],
  ["Stock", (product) => (product.stock > 0 ? `${product.stock} available` : "Out of stock")],
  ["Colors", (product) => (product.colors || []).map((color) => (typeof color === "string" ? color : color.name)).filter(Boolean).join(", ") || "—"],
  ["Sizes", (product) => (product.sizes || []).join(", ") || "—"],
  ["Material", (product) => product.specifications?.material || "—"],
];

const render = () => {
  if (!mount) return;
  mount.setAttribute("aria-busy", "true");
  const products = getComparisonProducts();
  if (!products.length) {
    mount.innerHTML = `<div class="empty-state empty-state--page"><h2>Add at least two products</h2><p>Use the compare control on a product card, then return here.</p><a class="btn btn--primary" href="shop.html">Browse products</a></div>`;
    mount.setAttribute("aria-busy", "false");
    return;
  }
  mount.innerHTML = `
    <p>${products.length} of 4 slots used. ${products.length < 2 ? "Add another product to compare." : ""}</p>
    <div class="compare-table-wrap" tabindex="0" role="region" aria-label="Product comparison, scroll for more columns">
      <table class="compare-table">
        <thead>
          <tr>
            <th scope="col">Attribute</th>
            ${products.map((product) => `<th scope="col">
              <img src="${escapeHtml(product.images?.[0] || "")}" alt="" width="120" height="150">
              <a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a>
              <button type="button" class="text-button" data-remove="${escapeHtml(product.id)}">Remove</button>
            </th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map(([label, getter]) => `<tr><th scope="row">${escapeHtml(label)}</th>${products.map((product) => `<td>${escapeHtml(String(getter(product)))}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
    <p><button class="btn btn--secondary" type="button" id="clear-compare">Clear comparison</button></p>
  `;
  mount.setAttribute("aria-busy", "false");
};

mount?.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    removeFromComparison(remove.dataset.remove);
    (mount.querySelector("[data-remove]") || mount.querySelector("a"))?.focus();
    return;
  }
  if (event.target.closest("#clear-compare")) {
    clearComparison();
    showToast("Comparison cleared");
    mount.querySelector("a")?.focus();
  }
});

window.addEventListener("comparison:updated", render);
render();

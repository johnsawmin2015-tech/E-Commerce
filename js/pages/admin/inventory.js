import { withAsyncAction } from "../../components/asyncAction.js";
import { appReady } from "../../core/app.js";
import { AUDIT_ACTIONS, PERMISSIONS } from "../../core/constants.js";
import { getAllProducts } from "../../services/product-service.js";
import { adjustStock, getInventoryHistory, getInventoryRecord, listLowStock } from "../../services/inventoryService.js";
import { recordAudit } from "../../services/auditService.js";
import { requirePermission } from "../../services/authService.js";
import { availableStock } from "../../domain/inventory.js";
import { escapeHtml } from "../../utils.js";
import { showToast } from "../../ui.js";
import { beginAdminPage } from "./shell.js";
import { paginate } from "../../components/pagination.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.INVENTORY_READ, "inventory.html")) {
  // Sign-in or permission screen already rendered.
} else {

const mount = document.querySelector("#admin-content");
const products = getAllProducts();
let page = 1;
const PAGE_SIZE = 50;

const render = () => {
  const low = listLowStock();
  const paged = paginate(products, page, PAGE_SIZE);
  page = paged.page;
  mount.innerHTML = `
  <p>${low.length} products are at or below reorder level. ${products.length} inventory records are available.</p>
  <div class="admin-table-wrap" role="region" aria-label="Inventory table, scroll for more columns" tabindex="0"><table class="admin-table">
    <caption class="sr-only">Inventory records</caption>
    <thead><tr><th scope="col">Product</th><th scope="col">On hand</th><th scope="col">Reserved</th><th scope="col">Available</th><th scope="col">Reorder</th><th scope="col">Adjust</th></tr></thead>
    <tbody>
      ${paged.items.map((product) => {
        const record = getInventoryRecord(product.id) || { onHand: product.stock, reserved: 0, reorderLevel: 4 };
        return `<tr>
          <td>${escapeHtml(product.name)}</td>
          <td>${record.onHand}</td>
          <td>${record.reserved}</td>
          <td>${availableStock(record)}</td>
          <td>${record.reorderLevel}</td>
          <td>
            <form data-adjust="${product.id}">
              <label class="sr-only" for="adj-${product.id}">Adjustment</label>
              <input id="adj-${product.id}" name="delta" type="number" value="0">
              <button type="submit">Apply</button>
            </form>
          </td>
        </tr>`;
      }).join("")}
    </tbody>
  </table></div>
  <nav class="admin-pagination" aria-label="Inventory pages">
    <button type="button" data-page="${Math.max(1, page - 1)}" ${page === 1 ? "disabled" : ""}>Previous</button>
    <span>Page ${page} of ${paged.totalPages}</span>
    <button type="button" data-page="${Math.min(paged.totalPages, page + 1)}" ${page === paged.totalPages ? "disabled" : ""}>Next</button>
  </nav>
  <h2>History</h2>
  <div id="inventory-history"></div>
  `;

  getInventoryHistory().then((rows) => {
  const history = document.querySelector("#inventory-history");
  if (!history) return;
  history.innerHTML = `<ol>${rows.slice(0, 20).map((row) => `<li>${escapeHtml(row.action)} ${escapeHtml(row.productId)} Δ${row.delta} · ${escapeHtml(row.reason || "")}</li>`).join("")}</ol>`;
  }).catch((error) => showToast(error.message || "Unable to load inventory history", "error"));
};

render();

mount.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button) return;
  page = Number(button.dataset.page) || 1;
  render();
});

mount.addEventListener("submit", withAsyncAction(async (event) => {
  const form = event.target.closest("[data-adjust]");
  if (!form) return;
  event.preventDefault();
  try { requirePermission(PERMISSIONS.INVENTORY_UPDATE); } catch (error) { showToast(error.message, "error"); return; }
  const delta = Number(new FormData(form).get("delta"));
  const previous = getInventoryRecord(form.dataset.adjust);
  await adjustStock(form.dataset.adjust, delta, "Manual admin adjustment");
  await recordAudit({
    action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
    entity: "inventory",
    entityId: form.dataset.adjust,
    previousValue: { onHand: previous?.onHand },
    newValue: { delta },
  });
  showToast("Inventory updated");
  await render();
}));

}

import { withAsyncAction } from "../../components/asyncAction.js";
import { appReady } from "../../core/app.js";
import { PERMISSIONS } from "../../core/constants.js";
import { allowedTransitions, listOrders, transitionOrder } from "../../services/orderService.js";
import { requirePermission } from "../../services/authService.js";
import { escapeHtml, formatCurrency } from "../../utils.js";
import { renderOrderTimeline } from "../../components/orderTimeline.js";
import { showToast } from "../../ui.js";
import { beginAdminPage } from "./shell.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.ORDERS_READ, "orders.html")) {
  // Sign-in or permission screen already rendered.
} else {

const mount = document.querySelector("#admin-content");

const render = async () => {
  const orders = await listOrders();
  mount.innerHTML = orders.map((order) => `
    <article class="admin-panel" data-order="${escapeHtml(order.id)}">
      <h2>${escapeHtml(order.reference)}</h2>
      <p>${escapeHtml(order.contact?.name || "")} · ${escapeHtml(order.status)} · ${formatCurrency(order.totals?.total || 0)}</p>
      ${renderOrderTimeline(order)}
      <label>Transition
        <select data-next="${escapeHtml(order.id)}">
          <option value="">Select valid status</option>
          ${allowedTransitions(order.status).map((status) => `<option value="${status}">${status}</option>`).join("")}
        </select>
      </label>
      <button type="button" data-apply="${escapeHtml(order.id)}">Apply</button>
    </article>
  `).join("") || "<p>No orders stored in this browser.</p>";
};

mount.addEventListener("click", withAsyncAction(async (event) => {
  const button = event.target.closest("[data-apply]");
  if (!button) return;
  try { requirePermission(PERMISSIONS.ORDERS_UPDATE); } catch (error) { showToast(error.message, "error"); return; }
  const select = mount.querySelector(`[data-next="${CSS.escape(button.dataset.apply)}"]`);
  if (!select?.value) return;
  try {
    await transitionOrder(button.dataset.apply, select.value);
    showToast("Order updated");
    await render();
  } catch (error) {
    showToast(error.message, "error");
  }
}));

render();

}

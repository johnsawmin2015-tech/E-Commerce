import { appReady } from "../core/app.js";
import { escapeHtml, formatCurrency, formatDate } from "../utils.js";
import { listOrders, requestOrderChange } from "../services/orderService.js";
import { getSession } from "../services/authService.js";
import { ORDER_STATUS } from "../core/constants.js";
import { renderOrderTimeline } from "../components/orderTimeline.js";
import { showToast } from "../ui.js";

await appReady().catch(() => {});

const mount = document.querySelector("#orders-page");

const render = async () => {
  if (!mount) return;
  mount.setAttribute("aria-busy", "true");
  const session = getSession();
  let orders = [];
  try { orders = await listOrders({ userId: session?.userId || undefined }); } catch { orders = []; }
  const visible = session?.userId
    ? orders.filter((order) => order.userId === session.userId)
    : orders.filter((order) => !order.userId);
  if (!visible.length) {
    mount.innerHTML = `<div class="empty-state empty-state--page"><h2>No orders yet</h2><p>${session ? "Place a demonstration checkout to see it here." : "Sign in or complete checkout in this tab to see a confirmation."}</p><a class="btn btn--primary" href="shop.html">Shop</a></div>`;
    mount.setAttribute("aria-busy", "false");
    return;
  }
  mount.innerHTML = visible.map((order) => `
    <article class="order-panel">
      <header class="order-panel__heading">
        <h2>${escapeHtml(order.reference)}</h2>
        <span>${formatDate(order.createdAt)} · ${escapeHtml(order.status)}</span>
      </header>
      <ul>${(order.items || []).map((item) => `<li>${escapeHtml(item.productNameSnapshot || item.name)} × ${item.quantity} — ${formatCurrency(item.subtotal ?? item.unitPriceSnapshot ?? item.price * item.quantity)}</li>`).join("")}</ul>
      <p>Total ${formatCurrency(order.totals?.total || 0)}</p>
      ${[ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED].includes(order.status) ? `<button class="btn btn--text" type="button" data-order-change="${escapeHtml(order.id)}" data-next-status="${ORDER_STATUS.CANCELLED}">Request cancellation</button>` : ""}
      ${order.status === ORDER_STATUS.DELIVERED ? `<button class="btn btn--text" type="button" data-order-change="${escapeHtml(order.id)}" data-next-status="${ORDER_STATUS.RETURN_REQUESTED}">Request a return</button>` : ""}
      ${renderOrderTimeline(order)}
    </article>
  `).join("");
  mount.setAttribute("aria-busy", "false");
};

mount.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-order-change]");
  if (!button) return;
  button.disabled = true;
  try {
    await requestOrderChange(button.dataset.orderChange, button.dataset.nextStatus);
    await render();
  } catch (error) {
    button.disabled = false;
    showToast(error.message || "That order could not be updated.", "error");
  }
});

render();
export { ORDER_STATUS };

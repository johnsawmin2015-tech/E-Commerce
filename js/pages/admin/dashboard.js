import { appReady } from "../../core/app.js";
import { PERMISSIONS } from "../../core/constants.js";
import { calculateMetrics } from "../../services/analyticsService.js";
import { listLowStock } from "../../services/inventoryService.js";
import { listOrders } from "../../services/orderService.js";
import { escapeHtml, formatCurrency } from "../../utils.js";
import { beginAdminPage } from "./shell.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.ANALYTICS_READ, "dashboard.html")) {
  // Sign-in or permission screen already rendered.
} else {

const mount = document.querySelector("#admin-content");
const metrics = await calculateMetrics();
const lowStock = listLowStock();
const orders = await listOrders();

const kpi = (label, value) => `<article class="kpi-card"><p class="eyebrow">${escapeHtml(label)}</p><p><strong>${value}</strong></p></article>`;

mount.innerHTML = `
  <p class="demo-banner">KPIs are calculated from IndexedDB orders and analytics events stored in this browser. Nothing is hard-coded.</p>
  <div class="kpi-grid">
    ${kpi("Revenue", formatCurrency(metrics.totalRevenue))}
    ${kpi("Orders", String(metrics.totalOrders))}
    ${kpi("Customers", String(metrics.totalCustomers))}
    ${kpi("Average order value", formatCurrency(metrics.averageOrderValue))}
    ${kpi("Conversion (purchases / sessions)", `${Math.round(metrics.conversionRate * 1000) / 10}%`)}
    ${kpi("Cancelled orders", String(metrics.cancelledOrders))}
    ${kpi("Low-stock SKUs", String(lowStock.length))}
  </div>
  <section class="admin-panel">
    <h2>Best sellers</h2>
    <ol>${metrics.bestSellers.slice(0, 6).map((row) => `<li>${escapeHtml(row.product?.name || row.id)} · ${row.count}</li>`).join("") || "<li>No purchases stored yet</li>"}</ol>
  </section>
  <section class="admin-panel">
    <h2>Recent orders</h2>
    <ol>${orders.slice(0, 6).map((order) => `<li>${escapeHtml(order.reference)} · ${escapeHtml(order.status)} · ${formatCurrency(order.totals?.total || 0)}</li>`).join("")}</ol>
  </section>
`;
}

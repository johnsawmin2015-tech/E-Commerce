import { appReady } from "../../core/app.js";
import { PERMISSIONS } from "../../core/constants.js";
import { calculateMetrics } from "../../services/analyticsService.js";
import { escapeHtml, formatCurrency } from "../../utils.js";
import { beginAdminPage } from "./shell.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.ANALYTICS_READ, "analytics.html")) {
  // Sign-in or permission screen already rendered.
} else {

const metrics = await calculateMetrics();
const maxSearch = Math.max(1, ...metrics.searchPopularity.map((row) => row.count));
const maxCategory = Math.max(1, ...metrics.categoryPerformance.map((row) => row.total));
const mount = document.querySelector("#admin-content");

mount.innerHTML = `
  <p class="demo-banner">Every figure below is derived from stored analytics events and orders.</p>
  <div class="kpi-grid">
    <article class="kpi-card"><p>Revenue</p><strong>${formatCurrency(metrics.totalRevenue)}</strong></article>
    <article class="kpi-card"><p>Purchases</p><strong>${metrics.totalPurchases}</strong></article>
    <article class="kpi-card"><p>AOV</p><strong>${formatCurrency(metrics.averageOrderValue)}</strong></article>
    <article class="kpi-card"><p>Cart abandonment</p><strong>${Math.round(metrics.cartAbandonment * 100)}%</strong></article>
    <article class="kpi-card"><p>Repeat purchase rate</p><strong>${Math.round(metrics.repeatPurchaseRate * 100)}%</strong></article>
    <article class="kpi-card"><p>Product views</p><strong>${metrics.productViews}</strong></article>
    <article class="kpi-card"><p>Coupon events</p><strong>${metrics.couponUsage}</strong></article>
  </div>
  <section class="admin-panel">
    <h2>Search popularity</h2>
    <div class="bar-chart">
      ${metrics.searchPopularity.slice(0, 8).map((row) => `<div class="bar-chart__row">
        <span>${escapeHtml(row.query)}</span>
        <div class="bar-chart__track"><div class="bar-chart__fill" style="width:${(row.count / maxSearch) * 100}%"></div></div>
        <span>${row.count}</span>
      </div>`).join("") || "<p>No searches stored yet.</p>"}
    </div>
  </section>
  <section class="admin-panel">
    <h2>Category performance</h2>
    <div class="bar-chart">
      ${metrics.categoryPerformance.map((row) => `<div class="bar-chart__row">
        <span>${escapeHtml(row.category)}</span>
        <div class="bar-chart__track"><div class="bar-chart__fill" style="width:${(row.total / maxCategory) * 100}%"></div></div>
        <span>${formatCurrency(row.total)}</span>
      </div>`).join("") || "<p>No category revenue yet.</p>"}
    </div>
  </section>
`;

}

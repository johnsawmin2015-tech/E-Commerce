import { appReady } from "../../core/app.js";
import { PERMISSIONS } from "../../core/constants.js";
import { listAuditLogs } from "../../services/auditService.js";
import { escapeHtml } from "../../utils.js";
import { beginAdminPage } from "./shell.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.AUDIT_READ, "audit-logs.html")) {
  // Sign-in or permission screen already rendered.
} else {

const mount = document.querySelector("#admin-content");

const render = async (filters = {}) => {
  const logs = await listAuditLogs(filters);
  mount.querySelector("#audit-results").innerHTML = `
    <div class="admin-table-wrap" role="region" aria-label="Audit logs table, scroll for more columns" tabindex="0"><table class="admin-table">
      <thead><tr><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Entity</th></tr></thead>
      <tbody>
        ${logs.map((log) => `<tr>
          <td>${escapeHtml(log.timestamp)}</td>
          <td>${escapeHtml(log.actor)}</td>
          <td>${escapeHtml(log.action)}</td>
          <td>${escapeHtml(log.entity)} ${escapeHtml(log.entityId || "")}</td>
        </tr>`).join("") || "<tr><td colspan='4'>No audit events yet.</td></tr>"}
      </tbody>
    </table></div>
  `;
};

mount.innerHTML = `
  <form id="audit-filter" class="admin-toolbar">
    <label>Action <input name="action" placeholder="PRODUCT_UPDATED"></label>
    <label>Entity <input name="entity" placeholder="product"></label>
    <label>Search <input name="query" placeholder="sku, actor…"></label>
    <button class="btn btn--secondary" type="submit">Filter</button>
  </form>
  <div id="audit-results"></div>
`;

mount.querySelector("#audit-filter").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  render({
    action: String(data.get("action") || "").trim(),
    entity: String(data.get("entity") || "").trim(),
    query: String(data.get("query") || "").trim(),
  });
});

render();

}

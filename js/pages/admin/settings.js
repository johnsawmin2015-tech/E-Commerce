import { withAsyncAction } from "../../components/asyncAction.js";
import { appReady } from "../../core/app.js";
import { AUDIT_ACTIONS, PERMISSIONS, ROLES } from "../../core/constants.js";
import { userRepository } from "../../data/repositories.js";
import { recordAudit } from "../../services/auditService.js";
import { getSession, requirePermission, restoreSession } from "../../services/authService.js";
import { TAX_RATE, FREE_SHIPPING_THRESHOLD } from "../../core/config.js";
import { STORAGE_KEYS, readStorage, writeSessionStorage, writeStorage } from "../../storage.js";
import { escapeHtml } from "../../utils.js";
import { showToast } from "../../ui.js";
import { beginAdminPage } from "./shell.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.SETTINGS_MANAGE, "settings.html")) {
  // Sign-in or permission screen already rendered.
} else {

const mount = document.querySelector("#admin-content");
const users = await userRepository.getAll();
const prefs = readStorage(STORAGE_KEYS.UI_PREFS, { storeName: "Morrow", taxNote: "Demonstration tax rate is illustrative." });

mount.innerHTML = `
  <section class="admin-panel">
    <h2>Storefront</h2>
    <p>Tax rate in pricing calculations: ${(TAX_RATE * 100).toFixed(0)}%. Complimentary standard delivery over ${FREE_SHIPPING_THRESHOLD}.</p>
    <form id="prefs-form" class="admin-form">
      <label>Public store name <input name="storeName" value="${escapeHtml(prefs.storeName || "Morrow")}"></label>
      <label>Tax disclaimer <textarea name="taxNote" rows="3">${escapeHtml(prefs.taxNote || "")}</textarea></label>
      <button class="btn btn--primary" type="submit">Save local settings</button>
    </form>
  </section>
  <section class="admin-panel">
    <h2>User roles</h2>
    <p>Changing a role only affects this browser copy of MorrowDB.</p>
    <div class="admin-table-wrap" role="region" aria-label="Settings table, scroll for more columns" tabindex="0"><table class="admin-table">
      <thead><tr><th scope="col">User</th><th scope="col">Role</th></tr></thead>
      <tbody>
        ${users.map((user) => `<tr>
          <td>${escapeHtml(user.email)}</td>
          <td>
            <form data-role="${escapeHtml(user.id)}">
              <select name="role" aria-label="Role for ${escapeHtml(user.email)}">
                ${Object.values(ROLES).map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`).join("")}
              </select>
              <button type="submit">Update</button>
            </form>
          </td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </section>
`;

mount.addEventListener("submit", withAsyncAction(async (event) => {
  if (event.target.id === "prefs-form") {
    event.preventDefault();
    requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const data = new FormData(event.target);
    writeStorage(STORAGE_KEYS.UI_PREFS, {
      storeName: String(data.get("storeName")),
      taxNote: String(data.get("taxNote")),
    });
    await recordAudit({ action: AUDIT_ACTIONS.SETTINGS_UPDATED, entity: "settings", entityId: "ui", newValue: { storeName: data.get("storeName") } });
    showToast("Settings saved in this browser");
    return;
  }
  const roleForm = event.target.closest("[data-role]");
  if (!roleForm) return;
  event.preventDefault();
  try { requirePermission(PERMISSIONS.USERS_MANAGE); } catch (error) { showToast(error.message, "error"); return; }
  const user = users.find((entry) => entry.id === roleForm.dataset.role);
  const role = new FormData(roleForm).get("role");
  await userRepository.save({ ...user, role });
  const currentSession = getSession();
  if (currentSession?.userId === user.id) {
    writeSessionStorage(STORAGE_KEYS.SESSION, { ...currentSession, role }, (value) => Boolean(value && typeof value.userId === "string"));
    await restoreSession();
  }
  await recordAudit({
    action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
    entity: "user",
    entityId: user.id,
    previousValue: { role: user.role },
    newValue: { role },
  });
  user.role = role;
  showToast("Role updated for this demonstration user");
  if (currentSession?.userId === user.id) location.reload();
}));

}

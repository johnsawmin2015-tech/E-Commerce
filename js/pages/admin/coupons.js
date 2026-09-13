import { withAsyncAction } from "../../components/asyncAction.js";
import { appReady } from "../../core/app.js";
import { AUDIT_ACTIONS, COUPON_TYPE, PERMISSIONS } from "../../core/constants.js";
import { listCoupons, createCoupon, toggleCoupon } from "../../services/couponService.js";
import { recordAudit } from "../../services/auditService.js";
import { requirePermission } from "../../services/authService.js";
import { escapeHtml } from "../../utils.js";
import { showToast } from "../../ui.js";
import { beginAdminPage } from "./shell.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.COUPONS_MANAGE, "coupons.html")) {
  // Sign-in or permission screen already rendered.
} else {

const mount = document.querySelector("#admin-content");

const render = async () => {
  const coupons = await listCoupons();
  mount.innerHTML = `
    <div class="admin-table-wrap" role="region" aria-label="Coupons table, scroll for more columns" tabindex="0"><table class="admin-table">
      <thead><tr><th scope="col">Code</th><th scope="col">Type</th><th scope="col">Value</th><th scope="col">Min</th><th scope="col">Active</th><th scope="col">Uses</th><th scope="col">Action</th></tr></thead>
      <tbody>
        ${coupons.map((coupon) => `<tr>
          <td>${escapeHtml(coupon.code)}</td>
          <td>${escapeHtml(coupon.type)}</td>
          <td>${coupon.value}</td>
          <td>${coupon.minimumOrder || 0}</td>
          <td>${coupon.active ? "yes" : "no"}</td>
          <td>${coupon.usageCount || 0}${coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}</td>
          <td><button type="button" data-toggle="${escapeHtml(coupon.id)}">${coupon.active ? "Pause" : "Activate"}</button></td>
        </tr>`).join("")}
      </tbody>
    </table></div>
    <form id="coupon-form" class="admin-form">
      <h2>Create coupon</h2>
      <label>Code <input name="code" required></label>
      <label>Type
        <select name="type">
          <option value="${COUPON_TYPE.PERCENTAGE}">percentage</option>
          <option value="${COUPON_TYPE.FIXED}">fixed</option>
        </select>
      </label>
      <label>Value <input name="value" type="number" min="0" step="0.01" required></label>
      <label>Minimum order <input name="minimumOrder" type="number" min="0" value="0"></label>
      <label>Usage limit <input name="usageLimit" type="number" min="0"></label>
      <label>Expires <input name="expiresAt" type="date"></label>
      <button class="btn btn--primary" type="submit">Save coupon</button>
    </form>
  `;
};

mount.addEventListener("submit", withAsyncAction(async (event) => {
  if (event.target.id !== "coupon-form") return;
  event.preventDefault();
  try { requirePermission(PERMISSIONS.COUPONS_MANAGE); } catch (error) { showToast(error.message, "error"); return; }
  const data = new FormData(event.target);
  try {
    const coupon = await createCoupon({
      code: data.get("code"), type: data.get("type"), value: data.get("value"),
      minimumOrder: data.get("minimumOrder"), usageLimit: data.get("usageLimit"),
      expiresAt: data.get("expiresAt") ? new Date(data.get("expiresAt")).toISOString() : null,
    });
    await recordAudit({ action: AUDIT_ACTIONS.COUPON_CREATED, entity: "coupon", entityId: coupon.id, newValue: { code: coupon.code } });
    showToast("Coupon saved");
    await render();
  } catch (error) {
    showToast(error.message || "Coupon could not be saved", "error");
  }
}));

mount.addEventListener("click", withAsyncAction(async (event) => {
  const button = event.target.closest("[data-toggle]");
  if (!button) return;
  try { requirePermission(PERMISSIONS.COUPONS_MANAGE); } catch (error) { showToast(error.message, "error"); return; }
  const coupon = await toggleCoupon(button.dataset.toggle);
  if (!coupon) return;
  await recordAudit({ action: AUDIT_ACTIONS.COUPON_UPDATED, entity: "coupon", entityId: coupon.id, newValue: { active: coupon.active } });
  showToast(coupon.active ? "Coupon activated" : "Coupon paused");
  await render();
}));

render();

}

import { withAsyncAction } from "../../components/asyncAction.js";
import { appReady } from "../../core/app.js";
import { AUDIT_ACTIONS, PERMISSIONS, REVIEW_STATUS } from "../../core/constants.js";
import { listReviews, moderateReview } from "../../services/reviewService.js";
import { recordAudit } from "../../services/auditService.js";
import { requirePermission } from "../../services/authService.js";
import { escapeHtml } from "../../utils.js";
import { showToast } from "../../ui.js";
import { beginAdminPage } from "./shell.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.REVIEWS_MODERATE, "reviews.html")) {
  // Sign-in or permission screen already rendered.
} else {

const mount = document.querySelector("#admin-content");

const render = async () => {
  const reviews = await listReviews(undefined, { includePending: true });
  mount.innerHTML = `
    <div class="admin-table-wrap" role="region" aria-label="Reviews table, scroll for more columns" tabindex="0"><table class="admin-table">
      <thead><tr><th scope="col">Product</th><th scope="col">Rating</th><th scope="col">Text</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
      <tbody>
        ${reviews.map((review) => `<tr>
          <td>${escapeHtml(review.productId)}</td>
          <td>${review.rating}</td>
          <td>${escapeHtml(review.text)}</td>
          <td>${escapeHtml(review.status)}</td>
          <td>
            <button type="button" data-mod="${review.id}" data-status="${REVIEW_STATUS.APPROVED}">Approve</button>
            <button type="button" data-mod="${review.id}" data-status="${REVIEW_STATUS.REJECTED}">Reject</button>
          </td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  `;
};

mount.addEventListener("click", withAsyncAction(async (event) => {
  const button = event.target.closest("[data-mod]");
  if (!button) return;
  try { requirePermission(PERMISSIONS.REVIEWS_MODERATE); } catch (error) { showToast(error.message, "error"); return; }
  await moderateReview(button.dataset.mod, button.dataset.status);
  await recordAudit({
    action: AUDIT_ACTIONS.REVIEW_MODERATED,
    entity: "review",
    entityId: button.dataset.mod,
    newValue: { status: button.dataset.status },
  });
  showToast("Review updated");
  await render();
}));

render();

}

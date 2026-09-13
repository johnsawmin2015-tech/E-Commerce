import { withAsyncAction } from "../../components/asyncAction.js";
import { appReady } from "../../core/app.js";
import { AUDIT_ACTIONS, PERMISSIONS } from "../../core/constants.js";
import { listCategories, removeCategory, upsertCategory } from "../../services/categoryService.js";
import { recordAudit } from "../../services/auditService.js";
import { escapeHtml } from "../../utils.js";
import { showToast } from "../../ui.js";
import { beginAdminPage } from "./shell.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.PRODUCTS_READ, "categories.html")) {
  // Sign-in or permission screen already rendered.
} else {
  const mount = document.querySelector("#admin-content");
  const render = async () => {
    const categories = await listCategories();
    mount.innerHTML = `
      <div class="admin-table-wrap" role="region" aria-label="Categories table, scroll for more columns" tabindex="0"><table class="admin-table">
        <caption class="sr-only">Catalog categories</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">Subcategories</th><th scope="col">Actions</th></tr></thead>
        <tbody>${categories.map((category) => `<tr>
          <td>${escapeHtml(category.name)}</td>
          <td>${escapeHtml((category.subcategories || []).join(", ") || "—")}</td>
          <td><button type="button" data-edit="${escapeHtml(category.id)}">Edit</button> <button type="button" data-remove="${escapeHtml(category.id)}">Remove</button></td>
        </tr>`).join("") || "<tr><td colspan=\"3\">No categories yet.</td></tr>"}</tbody>
      </table></div>
      <form id="category-form" class="admin-form">
        <h2>New category</h2>
        <input type="hidden" name="id">
        <label>Name <input name="name" required minlength="2"></label>
        <label>Subcategories <input name="subcategories" placeholder="Living, Desk"></label>
        <div class="cluster"><button class="btn btn--primary" type="submit">Save category</button><button class="btn btn--secondary" type="reset">New category</button></div>
      </form>`;
    mount.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => {
      const category = categories.find((entry) => entry.id === button.dataset.edit);
      const form = mount.querySelector("#category-form");
      form.querySelector("h2").textContent = "Edit category";
      form.elements.id.value = category?.id || "";
      form.elements.name.value = category?.name || "";
      form.elements.subcategories.value = (category?.subcategories || []).join(", ");
      form.querySelector("[name=name]").focus();
    }));
    mount.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", async () => {
      try {
        await removeCategory(button.dataset.remove);
        await recordAudit({ action: AUDIT_ACTIONS.SETTINGS_UPDATED, entity: "category", entityId: button.dataset.remove, newValue: { removed: true } });
        showToast("Category removed");
        await render();
      } catch (error) { showToast(error.message, "error"); }
    }));
    mount.querySelector("#category-form").addEventListener("reset", () => { mount.querySelector("#category-form h2").textContent = "New category"; });
    mount.querySelector("#category-form").addEventListener("submit", withAsyncAction(async (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      try {
        const saved = await upsertCategory({ id: data.get("id") || undefined, name: data.get("name"), subcategories: String(data.get("subcategories") || "").split(",") });
        await recordAudit({ action: AUDIT_ACTIONS.SETTINGS_UPDATED, entity: "category", entityId: saved.id, newValue: { name: saved.name } });
        showToast("Category saved");
        await render();
      } catch (error) { showToast(error.message, "error"); }
    }));
  };
  render();
}

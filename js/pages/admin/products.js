import { withAsyncAction } from "../../components/asyncAction.js";
import { appReady } from "../../core/app.js";
import { AUDIT_ACTIONS, PERMISSIONS, PRODUCT_STATUS } from "../../core/constants.js";
import { getAllProducts, upsertProductRecord } from "../../services/product-service.js";
import { adjustStock, ensureInventoryRecord, getInventoryRecord } from "../../services/inventoryService.js";
import { recordAudit } from "../../services/auditService.js";
import { requirePermission } from "../../services/authService.js";
import { escapeHtml, formatCurrency } from "../../utils.js";
import { createId, slugify } from "../../utils/helpers.js";
import { showToast } from "../../ui.js";
import { beginAdminPage } from "./shell.js";
import { paginate } from "../../components/pagination.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.PRODUCTS_READ, "products.html")) {
  // Sign-in or permission screen already rendered.
} else {

const mount = document.querySelector("#admin-content");
let page = 1;
const PAGE_SIZE = 50;

const render = () => {
  const products = getAllProducts();
  const paged = paginate(products, page, PAGE_SIZE);
  page = paged.page;
  mount.innerHTML = `
    <div class="admin-toolbar">
      <button class="btn btn--primary" type="button" id="create-product">New product</button>
    </div>
    <div class="admin-table-wrap" role="region" aria-label="Products table, scroll for more columns" tabindex="0">
      <table class="admin-table">
        <thead><tr><th scope="col">Name</th><th scope="col">SKU</th><th scope="col">Status</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col">Actions</th></tr></thead>
        <tbody>
          ${paged.items.map((product) => `<tr>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.sku || "")}</td>
            <td>${escapeHtml(product.status || "active")}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${product.stock}</td>
            <td>
              <button type="button" data-edit="${product.id}">Edit</button>
              <button type="button" data-archive="${product.id}">${product.status === "archived" ? "Restore" : "Archive"}</button>
              <button type="button" data-duplicate="${product.id}">Duplicate</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <nav class="admin-pagination" aria-label="Product pages">
      <button type="button" data-page="${Math.max(1, page - 1)}" ${page === 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${page} of ${paged.totalPages} · ${products.length} records</span>
      <button type="button" data-page="${Math.min(paged.totalPages, page + 1)}" ${page === paged.totalPages ? "disabled" : ""}>Next</button>
    </nav>
    <form id="product-form" class="admin-form" hidden>
      <h2 id="product-form-title">Product</h2>
      <input type="hidden" name="id">
      <label>Name <input name="name" required></label>
      <label>Brand <input name="brand" required></label>
      <label>Category <input name="category" required></label>
      <label>Price <input name="price" type="number" min="0" step="0.01" required></label>
      <label>Stock <input name="stock" type="number" min="0" step="1" required></label>
      <label>Status
        <select name="status">
          <option value="${PRODUCT_STATUS.ACTIVE}">active</option>
          <option value="${PRODUCT_STATUS.DRAFT}">draft</option>
          <option value="${PRODUCT_STATUS.ARCHIVED}">archived</option>
          <option value="${PRODUCT_STATUS.UNAVAILABLE}">unavailable</option>
        </select>
      </label>
      <label>Description <textarea name="description" rows="3"></textarea></label>
      <div class="cluster"><button class="btn btn--primary" type="submit">Save product</button><button class="btn btn--secondary" type="button" id="cancel-product">Cancel</button></div>
    </form>
  `;
};

const openForm = (product = {}) => {
  const form = document.querySelector("#product-form");
  form.hidden = false;
  form.elements.id.value = product.id || "";
  form.elements.name.value = product.name || "";
  form.elements.brand.value = product.brand || "";
  form.elements.category.value = product.category || "Apparel";
  form.elements.price.value = product.price || 0;
  form.elements.stock.value = product.stock ?? 0;
  form.elements.status.value = product.status || PRODUCT_STATUS.ACTIVE;
  form.elements.description.value = product.description || "";
  form.querySelector("#product-form-title").textContent = product.id ? "Edit product" : "New product";
  form.querySelector("[name=name]").focus();
};

mount.addEventListener("click", withAsyncAction(async (event) => {
  if (event.target.id === "cancel-product") { mount.querySelector("#product-form").hidden = true; mount.querySelector("#create-product").focus(); return; }
  const pageButton = event.target.closest("button[data-page]");
  if (pageButton) {
    page = Number(pageButton.dataset.page) || 1;
    await render();
    return;
  }
  if (event.target.id === "create-product") {
    try { requirePermission(PERMISSIONS.PRODUCTS_CREATE); } catch (error) { showToast(error.message, "error"); return; }
    openForm();
    return;
  }
  const edit = event.target.closest("[data-edit]");
  if (edit) {
    openForm(getAllProducts().find((product) => product.id === edit.dataset.edit));
    return;
  }
  const archive = event.target.closest("[data-archive]");
  if (archive) {
    try { requirePermission(PERMISSIONS.PRODUCTS_UPDATE); } catch (error) { showToast(error.message, "error"); return; }
    const product = getAllProducts().find((entry) => entry.id === archive.dataset.archive);
    const nextStatus = product.status === PRODUCT_STATUS.ARCHIVED ? PRODUCT_STATUS.ACTIVE : PRODUCT_STATUS.ARCHIVED;
    await upsertProductRecord({ ...product, status: nextStatus });
    await recordAudit({
      action: nextStatus === PRODUCT_STATUS.ARCHIVED ? AUDIT_ACTIONS.PRODUCT_ARCHIVED : AUDIT_ACTIONS.PRODUCT_RESTORED,
      entity: "product",
      entityId: product.id,
      previousValue: { status: product.status },
      newValue: { status: nextStatus },
    });
    showToast("Product status updated");
    await render();
    return;
  }
  const duplicate = event.target.closest("[data-duplicate]");
  if (duplicate) {
    try { requirePermission(PERMISSIONS.PRODUCTS_CREATE); } catch (error) { showToast(error.message, "error"); return; }
    const product = getAllProducts().find((entry) => entry.id === duplicate.dataset.duplicate);
    const copy = {
      ...product,
      id: createId(),
      sku: `${product.sku}-COPY`,
      slug: `${product.slug}-copy`,
      name: `${product.name} (Copy)`,
      status: PRODUCT_STATUS.DRAFT,
    };
    await upsertProductRecord(copy);
    await ensureInventoryRecord(copy, { onHand: copy.stock || 0 });
    await recordAudit({ action: AUDIT_ACTIONS.PRODUCT_CREATED, entity: "product", entityId: copy.id, newValue: { name: copy.name } });
    showToast("Draft duplicate created");
    await render();
  }
}));

mount.addEventListener("submit", withAsyncAction(async (event) => {
  if (!event.target.matches("#product-form")) return;
  event.preventDefault();
  try {
    requirePermission(event.target.elements.id.value ? PERMISSIONS.PRODUCTS_UPDATE : PERMISSIONS.PRODUCTS_CREATE);
  } catch (error) {
    showToast(error.message, "error");
    return;
  }
  const data = new FormData(event.target);
  const existing = getAllProducts().find((product) => product.id === data.get("id"));
  const price = Number(data.get("price"));
  const stock = Number(data.get("stock"));
  const saved = await upsertProductRecord({
    ...(existing || {
      images: ["assets/images/product-placeholder.svg"],
      colors: ["Ink"],
      sizes: ["M"],
      tags: ["admin"],
      rating: 0,
      reviewCount: 0,
      popularity: 40,
      featured: false,
      isNew: true,
    }),
    id: data.get("id") || createId(),
    name: String(data.get("name")),
    brand: String(data.get("brand")),
    category: String(data.get("category")),
    slug: slugify(data.get("name")),
    sku: existing?.sku || `MRW-${Date.now().toString().slice(-6)}`,
    price,
    stock,
    status: String(data.get("status")),
    description: String(data.get("description")),
  });
  if (existing && existing.price !== price) {
    await recordAudit({
      action: AUDIT_ACTIONS.PRICE_CHANGED,
      entity: "product",
      entityId: saved.id,
      previousValue: { price: existing.price },
      newValue: { price },
    });
  }
  if (!existing || existing.stock !== stock) {
    await ensureInventoryRecord(saved, { onHand: stock });
    const record = getInventoryRecord(saved.id);
    const delta = stock - (record?.onHand || 0);
    if (delta) {
      await adjustStock(saved.id, delta, "Admin product save");
    }
  }
  await recordAudit({
    action: existing ? AUDIT_ACTIONS.PRODUCT_UPDATED : AUDIT_ACTIONS.PRODUCT_CREATED,
    entity: "product",
    entityId: saved.id,
    previousValue: existing ? { name: existing.name } : null,
    newValue: { name: saved.name },
  });
  showToast("Product saved");
  await render();
}));

render();
}

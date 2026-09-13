import { appReady } from "../../core/app.js";
import { PERMISSIONS } from "../../core/constants.js";
import { userRepository } from "../../data/repositories.js";
import { listOrders } from "../../services/orderService.js";
import { escapeHtml } from "../../utils.js";
import { beginAdminPage } from "./shell.js";

await appReady().catch(() => {});
if (!beginAdminPage(PERMISSIONS.CUSTOMERS_READ, "customers.html")) {
  // Sign-in or permission screen already rendered.
} else {

const users = await userRepository.getAll();
const orders = await listOrders();
const mount = document.querySelector("#admin-content");
mount.innerHTML = `
  <div class="admin-table-wrap" role="region" aria-label="Customers table, scroll for more columns" tabindex="0"><table class="admin-table">
    <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Orders</th></tr></thead>
    <tbody>
      ${users.map((user) => `<tr>
        <td>${escapeHtml(user.name || "")}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${orders.filter((order) => order.userId === user.id).length}</td>
      </tr>`).join("")}
    </tbody>
  </table></div>
`;

}

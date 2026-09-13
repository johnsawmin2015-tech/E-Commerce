import { PERMISSIONS } from "../../core/constants.js";
import { hasPermission as roleHasPermission, canAccessAdmin } from "../../domain/rbac.js";
import { getSession } from "../../services/authService.js";
import { escapeHtml } from "../../utils.js";

import { ADMIN_LINKS as LINKS, getAdminDestination } from "../../domain/adminRoutes.js";
import { logout, restoreSession } from "../../services/authService.js";
import { getState } from "../../core/state.js";

const loginUrl = (reason = "required") => `login.html?next=${encodeURIComponent(document.body.dataset.adminPage || "dashboard.html")}&reason=${reason}`;

export const guardAdminPage = (permission) => {
  const session = getSession();
  if (!session) {
    location.replace(loginUrl("required"));
    return false;
  }
  if (!canAccessAdmin(session.role) || (permission && !roleHasPermission(session.role, permission))) {
    const destination = getAdminDestination(null, session.role);
    document.body.innerHTML = `<main class="admin-access-message" id="admin-content"><p class="eyebrow">Morrow / Admin portal</p><h1>Permission required</h1><p>Your current account cannot open this screen.</p><div class="cluster">${destination ? `<a class="btn btn--primary" href="${destination}">Open your workspace</a>` : '<a class="btn btn--primary" href="../account.html">Your account</a>'}<button class="btn btn--secondary" type="button" id="admin-switch-account">Use another account</button><a href="../index.html">Back to store</a></div></main>`;
    document.body.removeAttribute("data-admin-pending");
    document.querySelector("#admin-switch-account").addEventListener("click", () => { logout(); location.replace(loginUrl()); });
    return false;
  }
  return true;
};

/**
 * Gate an admin screen without throwing. Returns false when the sign-in or
 * permission message has already replaced the document.
 */
export const beginAdminPage = (permission, activeHref) => {
  if (!getState().ready) return false;
  if (!guardAdminPage(permission)) return false;
  document.body.removeAttribute("data-admin-pending");
  let expiryTimer;
  let checking = false;
  const checkSession = async () => {
    if (checking) return;
    checking = true;
    document.body.setAttribute("data-admin-pending", "");
    try {
      const user = await restoreSession();
      if (!user) { location.replace(loginUrl("expired")); return; }
      if (!guardAdminPage(permission)) return;
      renderAdminChrome(activeHref);
      document.body.removeAttribute("data-admin-pending");
      scheduleExpiry();
    } catch (error) {
      console.error("[Morrow] session verification failed", error);
      location.replace(loginUrl("required"));
    } finally { checking = false; }
  };
  const scheduleExpiry = () => {
    clearTimeout(expiryTimer);
    const remaining = Date.parse(getSession()?.expiresAt) - Date.now();
    expiryTimer = setTimeout(checkSession, Math.max(0, remaining || 0));
  };
  window.addEventListener("pagehide", () => document.body.setAttribute("data-admin-pending", ""));
  window.addEventListener("pageshow", (event) => { if (event.persisted) checkSession(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkSession(); });
  const compactNav = matchMedia("(max-width: 64rem)");
  compactNav.addEventListener("change", ({ matches }) => {
    const navigation = document.querySelector(".admin-navigation");
    if (navigation) navigation.open = !matches;
  });
  scheduleExpiry();
  renderAdminChrome(activeHref);
  return true;
};

export const renderAdminChrome = (active) => {
  const session = getSession();
  const nav = LINKS.filter((link) => roleHasPermission(session.role, link.permission))
    .map((link) => `<a href="${link.href}" ${link.href === active ? 'aria-current="page"' : ""}>${escapeHtml(link.label)}</a>`)
    .join("");
  const sidebar = document.querySelector("#admin-sidebar");
  if (sidebar) {
    sidebar.innerHTML = `
      <a class="brand" href="../index.html">Morrow</a>
      <p class="admin-sidebar__label">Admin workspace</p>
      <p class="admin-sidebar__identity">${escapeHtml(session.email)}<br><span>${escapeHtml(session.role.replaceAll("_", " "))}</span></p>
      <details class="admin-navigation" open><summary>Workspace navigation</summary><nav aria-label="Admin">${nav}</nav></details>
      <div class="admin-sidebar__footer"><a href="../index.html">Back to store</a><a href="../account.html">Your account</a><button type="button" id="admin-logout">Sign out</button></div>
    `;
    sidebar.querySelector(".admin-navigation").open = !matchMedia("(max-width: 64rem)").matches;
    sidebar.querySelector("#admin-logout").addEventListener("click", () => {
      logout();
      document.body.setAttribute("data-admin-pending", "");
      location.replace("login.html?reason=signedout");
    });
  }
};

export { PERMISSIONS, roleHasPermission };

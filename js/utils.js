export const formatCurrency = (value, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

export const formatDate = (value, options = {}) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(value));

export const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const debounce = (callback, delay = 180) => {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
};

export const clamp = (value, min, max) =>
  Math.min(Math.max(Number(value) || min, min), max);

export const uniqueId = (prefix = "id") => {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const getUrl = (path, params = {}) => {
  const url = new URL(path, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return `${url.pathname.split("/").pop()}${url.search}`;
};

export const safeImage = (image, fallback = "assets/images/product-placeholder.svg") =>
  image || fallback;

export const announce = (message) => {
  const region = document.querySelector("#live-region");
  if (!region) return;
  region.textContent = "";
  window.requestAnimationFrame(() => {
    region.textContent = message;
  });
};

const inertSiblingState = new WeakMap();

/**
 * Make every branch outside `activeElement` inert, while preserving any inert
 * state that was already present. Passing `false` restores only the branches
 * changed for that element. Elements marked `data-modal-exempt` remain
 * available for non-interactive services such as the global live region.
 */
export const setSiblingsInert = (activeElement, inert = true) => {
  if (!activeElement?.ownerDocument) return;

  if (!inert) {
    const records = inertSiblingState.get(activeElement) || [];
    records.forEach(({ element, wasInert }) => {
      if (!element.isConnected) return;
      element.inert = wasInert;
      if (!wasInert) element.removeAttribute("inert");
    });
    inertSiblingState.delete(activeElement);
    return;
  }

  if (inertSiblingState.has(activeElement)) return;

  const records = [];
  const documentBody = activeElement.ownerDocument.body;
  let branch = activeElement;

  while (branch?.parentElement) {
    const parent = branch.parentElement;
    [...parent.children].forEach((sibling) => {
      if (sibling === branch || sibling.hasAttribute("data-modal-exempt")) return;
      const wasInert = sibling.inert || sibling.hasAttribute("inert");
      records.push({ element: sibling, wasInert });
      sibling.inert = true;
    });
    if (parent === documentBody) break;
    branch = parent;
  }

  inertSiblingState.set(activeElement, records);
};

export const getFocusableElements = (container) =>
  [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) =>
    !element.hidden
    && !element.closest("[hidden], [inert]")
    && element.getAttribute("aria-hidden") !== "true");

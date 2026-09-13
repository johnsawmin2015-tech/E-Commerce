export const showLoader = (container, message = "Loading…") => {
  if (!container) return;
  container.setAttribute("aria-busy", "true");
  container.innerHTML = `<p class="loading-state" role="status">${message}</p>`;
};

export const hideLoader = (container) => {
  container?.setAttribute("aria-busy", "false");
};

export default { showLoader, hideLoader };

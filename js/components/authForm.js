import { AppError } from "../core/errors.js";

/** One validation/submission lifecycle shared by customer and operations forms. */
export const bindAuthForm = (
  form,
  { rules, submit, onSuccess, pendingLabel = "Signing in…" },
) => {
  if (!form || form.dataset.authBound) return;
  form.dataset.authBound = "true";
  form.noValidate = true;
  const button = form.querySelector('[type="submit"]');
  const feedback = form.querySelector("[data-form-feedback]");
  const idleLabel = button.textContent;
  let isSubmitting = false;
  const validate = (input) => {
    const result = rules[input.name]?.(input.value) ?? true;
    const message = result === true ? "" : result;
    const error = form.querySelector(`#${input.id}-error`);
    input.setAttribute("aria-invalid", String(Boolean(message)));
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
    return !message;
  };
  form.addEventListener("focusout", ({ target }) => {
    if (target.matches("input") && target.value) validate(target);
  });
  form.addEventListener("input", ({ target }) => {
    if (target.matches('input[aria-invalid="true"]')) validate(target);
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
    }
  });
  form.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
    const input = form.querySelector(
      `#${toggle.getAttribute("aria-controls")}`,
    );
    toggle.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password",
      );
      toggle.querySelector("[data-toggle-label]").textContent = show
        ? "Hide"
        : "Show";
    });
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const inputs = [...form.querySelectorAll("input")].filter(
      (input) => rules[input.name],
    );
    const results = inputs.map(validate);
    if (results.includes(false)) {
      inputs[results.indexOf(false)].focus();
      return;
    }
    isSubmitting = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.classList.add("is-loading");
    button.textContent = pendingLabel;
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
    }
    try {
      const result = await submit(Object.fromEntries(new FormData(form)));
      await onSuccess?.(result);
    } catch (error) {
      if (feedback) {
        feedback.textContent =
          error instanceof AppError
            ? error.message
            : "Unable to open your local account. Please reload and try again.";
        feedback.hidden = false;
        feedback.focus();
      }
      if (!(error instanceof AppError))
        console.error("[Morrow] authentication failed", error);
    } finally {
      isSubmitting = false;
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.classList.remove("is-loading");
      button.textContent = idleLabel;
    }
  });
};

export const passwordToggleMarkup = (inputId) =>
  `<button type="button" class="password-toggle" data-password-toggle aria-controls="${inputId}" aria-label="Show password"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span data-toggle-label>Show</span></button>`;

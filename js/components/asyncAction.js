import { AppError } from "../core/errors.js";
import { showToast } from "../ui.js";

const pending = new WeakSet();

/** Keep async controls usable on failure and prevent duplicate mutations. */
export const withAsyncAction = (handler) => async (event) => {
  const target =
    event.type === "submit" ? event.target : event.target.closest("button");
  if (!target) return handler(event);
  if (event.type === "click" && ["submit", "reset"].includes(target.type))
    return;
  if (pending.has(target)) {
    event.preventDefault();
    return;
  }
  const buttons = target.matches("form")
    ? [...target.querySelectorAll('[type="submit"]')]
    : [target];
  const initial = buttons.map((button) => button.disabled);
  pending.add(target);
  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  });
  try {
    await handler(event);
  } catch (error) {
    showToast(
      error instanceof AppError
        ? error.message
        : "Unable to save this change. Please try again.",
      "error",
    );
    if (!(error instanceof AppError))
      console.error("[Morrow] action failed", error);
  } finally {
    pending.delete(target);
    buttons.forEach((button, index) => {
      button.disabled = initial[index];
      button.removeAttribute("aria-busy");
    });
  }
};

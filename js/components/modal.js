import { getFocusableElements, setSiblingsInert } from "../utils.js";

export const openDialog = (dialog) => {
  if (!dialog) return;
  dialog.hidden = false;
  dialog.classList.add("is-open");
  setSiblingsInert(dialog, true);
  dialog.querySelector("button, [href], input")?.focus();
  const onKey = (event) => {
    if (event.key === "Escape") closeDialog(dialog);
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(dialog);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  dialog.__morrowKey = onKey;
  dialog.addEventListener("keydown", onKey);
};

export const closeDialog = (dialog) => {
  if (!dialog) return;
  setSiblingsInert(dialog, false);
  dialog.classList.remove("is-open");
  dialog.hidden = true;
  if (dialog.__morrowKey) dialog.removeEventListener("keydown", dialog.__morrowKey);
};

export default { openDialog, closeDialog };

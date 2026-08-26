import { initializeGlobalUI } from "./ui.js";

const start = () => initializeGlobalUI();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}

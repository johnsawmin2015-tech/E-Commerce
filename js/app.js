import { initializeGlobalUI } from "./ui.js?v=20260829-1";

const start = () => initializeGlobalUI();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}

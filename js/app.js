import { appReady } from "./core/app.js";
import { initializeGlobalUI } from "./ui.js";

const start = () => initializeGlobalUI();

appReady()
  .catch((error) => {
    console.error("[Morrow] continuing with in-memory catalog after bootstrap error", error);
  })
  .finally(() => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  });

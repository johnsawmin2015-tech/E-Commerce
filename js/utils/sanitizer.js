export const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

/** Strip control characters and trim. Never treat this as XSS-proof HTML sanitization. */
export const sanitizeText = (value = "", { maxLength = 2000 } = {}) =>
  String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);

export const sanitizeEmail = (value = "") =>
  sanitizeText(value, { maxLength: 254 }).toLocaleLowerCase("en-US");

export default Object.freeze({ escapeHtml, sanitizeText, sanitizeEmail });

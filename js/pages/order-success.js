import { readSessionStorage, STORAGE_KEYS } from "../storage.js?v=20260829-1";
import { escapeHtml, formatCurrency, formatDate, safeImage } from "../utils.js?v=20260829-1";

const FALLBACK_IMAGE = "assets/images/product-placeholder.svg";
const container = document.querySelector("#order-confirmation");
const order = readSessionStorage(STORAGE_KEYS.LAST_ORDER, null);

const isValidDate = (value) => typeof value === "string" && Number.isFinite(new Date(value).getTime());
const validOrder = order
  && typeof order.reference === "string"
  && /^ORD-\d{4}-[A-Z0-9]{4,}$/.test(order.reference)
  && order.status === "simulated"
  && isValidDate(order.createdAt)
  && isValidDate(order.estimatedDelivery?.start)
  && isValidDate(order.estimatedDelivery?.end)
  && typeof order.contact?.name === "string"
  && typeof order.contact?.email === "string"
  && typeof order.shipping?.address === "string"
  && typeof order.shipping?.city === "string"
  && typeof order.shipping?.region === "string"
  && typeof order.shipping?.postalCode === "string"
  && typeof order.shipping?.country === "string"
  && typeof order.paymentMethod === "string"
  && Array.isArray(order.items)
  && order.items.length > 0
  && order.items.every((item) => typeof item?.name === "string" && Number.isFinite(item.price) && Number.isInteger(item.quantity) && item.quantity > 0)
  && Number.isFinite(order.totals?.subtotal)
  && Number.isFinite(order.totals?.shipping)
  && Number.isFinite(order.totals?.discount)
  && Number.isFinite(order.totals?.total);

const confirmationLede = document.querySelector("#confirmation-lede");

if (container && !validOrder) {
  container.setAttribute("aria-busy", "false");
  if (confirmationLede) {
    confirmationLede.textContent = "Complete the simulated checkout to create an order summary for this tab.";
  }
  container.innerHTML = `
    <div class="empty-state empty-state--page">
      <span class="empty-state__icon" aria-hidden="true">◇</span>
      <p class="eyebrow">No recent demo order</p>
      <h2>There’s no confirmation to show</h2>
      <p>Complete the simulated checkout to create an order summary.</p>
      <a class="btn btn--primary" href="shop.html">Browse the collection</a>
    </div>`;
} else if (container) {
  container.setAttribute("aria-busy", "false");
  if (confirmationLede) {
    confirmationLede.textContent = "Your simulated order details are ready below.";
  }
  const deliveryStart = formatDate(order.estimatedDelivery.start, { month: "short", day: "numeric", year: undefined });
  const deliveryEnd = formatDate(order.estimatedDelivery.end, { month: "short", day: "numeric", year: undefined });
  container.innerHTML = `
    <section class="order-success__hero">
      <div class="order-success__mark" aria-hidden="true">✓</div>
      <p class="eyebrow">Demo order created</p>
      <h2>Thank you, ${escapeHtml(order.contact.name.split(" ")[0])}</h2>
      <p>A simulated confirmation has been prepared for <strong>${escapeHtml(order.contact.email)}</strong>. No real order, payment, or shipment was created.</p>
      <div class="order-success__reference"><span>Reference</span><strong>${escapeHtml(order.reference)}</strong></div>
    </section>
    <div class="order-success__layout">
      <section class="order-panel" aria-labelledby="confirmation-items-title">
        <div class="order-panel__heading"><h2 id="confirmation-items-title">Order summary</h2><span>${formatDate(order.createdAt)}</span></div>
        <ul class="confirmation-items">
          ${order.items.map((item) => `<li>
            <img src="${escapeHtml(safeImage(item.image, FALLBACK_IMAGE))}" alt="" width="88" height="110" data-image-fallback>
            <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(Object.values(item.options || {}).filter(Boolean).join(" · "))}</small><span>Qty ${item.quantity}</span></div>
            <strong>${formatCurrency(item.price * item.quantity)}</strong>
          </li>`).join("")}
        </ul>
        <dl class="summary-card__lines">
          <div><dt>Subtotal</dt><dd>${formatCurrency(order.totals.subtotal)}</dd></div>
          <div><dt>Shipping</dt><dd>${order.totals.shipping === 0 ? "Complimentary" : formatCurrency(order.totals.shipping)}</dd></div>
          ${order.totals.discount ? `<div><dt>Discount</dt><dd>−${formatCurrency(order.totals.discount)}</dd></div>` : ""}
          <div class="summary-card__total"><dt>Total</dt><dd>${formatCurrency(order.totals.total)}</dd></div>
        </dl>
      </section>
      <aside class="order-panel order-panel--details">
        <div><p class="eyebrow">Estimated delivery</p><h2>${deliveryStart}–${deliveryEnd}</h2><p>Illustrative estimate only; no shipment was created.</p></div>
        <div><h3>Shipping to</h3><address>${escapeHtml(order.contact.name)}<br>${escapeHtml(order.shipping.address)}<br>${escapeHtml(order.shipping.city)}, ${escapeHtml(order.shipping.region)} ${escapeHtml(order.shipping.postalCode)}<br>${escapeHtml(order.shipping.country)}</address></div>
        <div><h3>Demo payment</h3><p>${escapeHtml(order.paymentMethod.replaceAll("-", " "))}</p><small>No credentials were collected or stored.</small></div>
      </aside>
    </div>`;
}

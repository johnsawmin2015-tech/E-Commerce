import { ORDER_STATUS, ORDER_TRANSITIONS } from "../core/constants.js";
import { escapeHtml } from "../utils/sanitizer.js";
import { titleCase } from "../utils/formatter.js";

const STEPS = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

export const renderOrderTimeline = (order) => {
  const timeline = order.timeline || [{ status: order.status, at: order.createdAt }];
  const current = order.status;
  const isCancelled = current === ORDER_STATUS.CANCELLED;
  const isReturnFlow = [
    ORDER_STATUS.RETURN_REQUESTED,
    ORDER_STATUS.RETURNED,
    ORDER_STATUS.REFUNDED,
  ].includes(current);
  const sequence = isReturnFlow
    ? [...STEPS, ORDER_STATUS.RETURN_REQUESTED, ORDER_STATUS.RETURNED, ORDER_STATUS.REFUNDED]
    : STEPS;
  const currentIndex = sequence.indexOf(current);

  return `
    <ol class="order-timeline" aria-label="Order status">
      ${sequence.map((status, index) => {
        const done = !isCancelled && currentIndex >= 0 && index <= currentIndex;
        return `<li class="${done ? "is-complete" : ""} ${status === current ? "is-current" : ""}">
          <span>${escapeHtml(titleCase(status))}</span>
        </li>`;
      }).join("")}
      ${isCancelled ? `<li class="is-current"><span>Cancelled</span></li>` : ""}
    </ol>
    <p class="muted">Allowed next steps: ${(ORDER_TRANSITIONS[current] || []).map(titleCase).join(", ") || "none"}</p>
    <ol class="timeline-log">
      ${timeline.map((entry) => `<li>${escapeHtml(titleCase(entry.status))} — ${escapeHtml(entry.at || "")}${entry.note ? ` · ${escapeHtml(entry.note)}` : ""}</li>`).join("")}
    </ol>
  `;
};

export default renderOrderTimeline;

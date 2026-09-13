import { getDetailedCart, getPromotionCode } from "../order.js";
import { showToast } from "../ui.js";
import { escapeHtml, formatCurrency, safeImage } from "../utils.js";
import { appReady } from "../core/app.js";
import { placeOrder, quoteCheckout } from "../services/checkoutService.js";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analyticsService.js";
import { AppError } from "../core/errors.js";
import { CHECKOUT_FIELD_VALIDATORS, isValid } from "../utils/validators.js";
import { uniqueId } from "../utils/helpers.js";

await appReady().catch(() => {});

const FALLBACK_IMAGE = "assets/images/product-placeholder.svg";
const STEPS = ["contact", "shipping", "delivery", "payment", "review"];
const STEP_FIELDS = {
  contact: ["name", "email", "phone"],
  shipping: ["address", "city", "region", "postalCode", "country"],
  delivery: [],
  payment: [],
  review: [],
};
const PAYMENT_LABELS = {
  card: "Card — Demo",
  kbzpay: "KBZPay — Demo",
  wavepay: "WavePay — Demo",
  cod: "Cash on Delivery — Demo",
};
const SHIPPING_LABELS = {
  standard: "Standard delivery",
  express: "Express delivery",
};

const form = document.querySelector("#checkout-form");
const summaryContainer = document.querySelector("#checkout-summary");
const backButton = document.querySelector("#checkout-back");
const nextButton = document.querySelector("#checkout-next");
const submitBlock = document.querySelector("#checkout-submit");
const reviewDetails = document.querySelector("#checkout-review-details");
let items = getDetailedCart();
let currentStep = 0;
let isSubmitting = false;
const checkoutKey = uniqueId("checkout");
const PAYMENT_MAP = {
  card: "card",
  kbzpay: "kbzpay",
  wavepay: "wavepay",
  cod: "cod",
  "card-demo": "card",
  "cod-demo": "cod",
  "wallet-demo": "kbzpay",
};

const getErrorElement = (input) => {
  const field = input.closest(".field") || input.parentElement;
  let error = field.querySelector(".field-error");
  if (!error) {
    error = document.createElement("p");
    error.className = "field-error";
    error.id = `${input.id || input.name}-error`;
    error.hidden = true;
    field.append(error);
  }
  return error;
};

const validateField = (input) => {
  const rule = CHECKOUT_FIELD_VALIDATORS[input.name];
  if (!rule) return true;
  const result = rule(input.value);
  const valid = isValid(result);
  const error = getErrorElement(input);
  input.setAttribute("aria-invalid", String(!valid));
  const describedBy = new Set((input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  describedBy.add(error.id);
  input.setAttribute("aria-describedby", [...describedBy].join(" "));
  error.textContent = valid ? "" : result;
  error.hidden = valid;
  input.closest(".field")?.classList.toggle("field--error", !valid);
  return valid;
};

const validateRadioGroup = (name) => {
  const inputs = [...form.querySelectorAll(`input[name="${name}"]`)];
  const selected = inputs.find((input) => input.checked);
  const group = inputs[0]?.closest("fieldset");
  let error = group?.querySelector(".field-error");
  if (!error && group) {
    error = document.createElement("p");
    error.className = "field-error";
    error.id = `${name}-error`;
    group.append(error);
  }
  inputs.forEach((input) => {
    input.setAttribute("aria-invalid", String(!selected));
    if (error) input.setAttribute("aria-describedby", error.id);
  });
  if (error) {
    error.textContent = selected ? "" : `Choose a ${name === "shippingMethod" ? "shipping" : "demo payment"} method.`;
    error.hidden = Boolean(selected);
  }
  return Boolean(selected);
};

const getShippingMethod = () => form?.querySelector('input[name="shippingMethod"]:checked')?.value || "standard";

const validateStep = (index) => {
  const step = STEPS[index];
  if (step === "delivery") return validateRadioGroup("shippingMethod");
  if (step === "payment") return validateRadioGroup("paymentMethod");
  if (step === "review") {
    return STEPS.every((_, stepIndex) => stepIndex === STEPS.indexOf("review") || validateStep(stepIndex));
  }
  return (STEP_FIELDS[step] || [])
    .map((name) => form.elements.namedItem(name))
    .filter(Boolean)
    .map(validateField)
    .every(Boolean);
};

const renderReviewDetails = () => {
  if (!reviewDetails || !form) return;
  const country = form.elements.country;
  const payment = form.querySelector('input[name="paymentMethod"]:checked')?.value || "card";
  reviewDetails.innerHTML = `
    <dl class="checkout-review-list">
      <div><dt>Contact</dt><dd>${escapeHtml(form.elements.name.value)} · ${escapeHtml(form.elements.email.value)} · ${escapeHtml(form.elements.phone.value)}</dd></div>
      <div><dt>Ship to</dt><dd>${escapeHtml(form.elements.address.value)}, ${escapeHtml(form.elements.city.value)}, ${escapeHtml(form.elements.region.value)} ${escapeHtml(form.elements.postalCode.value)}, ${escapeHtml(country.selectedOptions[0]?.textContent.trim() || "")}</dd></div>
      <div><dt>Delivery</dt><dd>${escapeHtml(SHIPPING_LABELS[getShippingMethod()] || getShippingMethod())}</dd></div>
      <div><dt>Payment</dt><dd>${escapeHtml(PAYMENT_LABELS[payment] || payment)} — simulated</dd></div>
    </dl>
    <p class="form-hint">No real payment will be taken. Use Back if anything needs correcting.</p>`;
};

const showStep = (index) => {
  currentStep = Math.max(0, Math.min(index, STEPS.length - 1));
  const key = STEPS[currentStep];
  form?.querySelectorAll("[data-checkout-step]").forEach((panel) => {
    panel.hidden = panel.dataset.checkoutStep !== key;
  });
  document.querySelectorAll("#checkout-stepper [data-step-key]").forEach((item) => {
    if (item.dataset.stepKey === "bag") return;
    if (item.dataset.stepKey === "confirmation") {
      item.removeAttribute("aria-current");
      return;
    }
    if (item.dataset.stepKey === key) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  if (backButton) backButton.disabled = currentStep === 0;
  if (nextButton) nextButton.hidden = currentStep === STEPS.length - 1;
  if (submitBlock) submitBlock.hidden = currentStep !== STEPS.length - 1;
  if (key === "review") renderReviewDetails();
  const panel = form?.querySelector(`[data-checkout-step="${key}"]`);
  const focusTarget = currentStep === STEPS.length - 1
    ? form?.querySelector("#place-order-button")
    : panel?.querySelector("input, select, textarea");
  focusTarget?.focus?.();
};

const showPopulatedCheckout = () => {
  document.querySelector(".checkout-layout__empty")?.remove();
  const layout = document.querySelector(".checkout-layout");
  layout?.removeAttribute("hidden");
  form?.removeAttribute("hidden");
  document.querySelector("#checkout-stepper")?.removeAttribute("hidden");
  summaryContainer?.removeAttribute("hidden");
};

const renderSummary = async () => {
  if (!summaryContainer) return;
  items = getDetailedCart();
  if (!items.length) {
    showEmptyCheckout();
    return;
  }
  showPopulatedCheckout();
  const order = await quoteCheckout({
    shippingMethod: getShippingMethod(),
    discountCode: getPromotionCode(),
    includeTax: true,
  });
  summaryContainer.innerHTML = `
    <h2 id="checkout-summary-title">Your order</h2>
    ${order.couponError ? `<p class="field-error" role="alert">${escapeHtml(order.couponError)} <a href="cart.html">Update the promotion in your bag</a>.</p>` : ""}
    <ul class="checkout-items" aria-label="Order items">
      ${order.items.map((item) => `<li>
        <div class="checkout-items__image"><img src="${escapeHtml(safeImage(item.product?.images?.[0] || item.image, FALLBACK_IMAGE))}" alt="" width="72" height="90" loading="lazy" data-image-fallback><span>${item.quantity}</span></div>
        <div><strong>${escapeHtml(item.name || item.product?.name || "")}</strong><small>${escapeHtml(Object.values(item.options || {}).filter(Boolean).join(" · "))}</small></div>
        <span>${formatCurrency((item.unitPrice || item.product?.price || 0) * item.quantity)}</span>
      </li>`).join("")}
    </ul>
    <dl class="summary-card__lines">
      <div><dt>Subtotal</dt><dd>${formatCurrency(order.subtotal)}</dd></div>
      <div><dt>Shipping</dt><dd>${order.shipping === 0 ? "Complimentary" : formatCurrency(order.shipping)}</dd></div>
      ${order.discount ? `<div class="summary-card__discount"><dt>Promotion</dt><dd>−${formatCurrency(order.discount)}</dd></div>` : ""}
      <div><dt>Estimated tax</dt><dd>${formatCurrency(order.tax)}</dd></div>
      <div class="summary-card__total"><dt>Total</dt><dd>${formatCurrency(order.total)}</dd></div>
    </dl>
    <p class="summary-card__notice"><span aria-hidden="true">◎</span> This is a simulated checkout. No payment or order is sent to a processor.</p>`;
  summaryContainer.setAttribute("aria-busy", "false");
};

const showEmptyCheckout = () => {
  if (document.querySelector(".checkout-layout__empty")) return;
  form?.setAttribute("hidden", "");
  if (summaryContainer) summaryContainer.hidden = true;
  document.querySelector("#checkout-stepper")?.setAttribute("hidden", "");
  const layout = document.querySelector(".checkout-layout");
  const empty = document.createElement("div");
  empty.className = "empty-state empty-state--page checkout-layout__empty";
  empty.innerHTML = `<span class="empty-state__icon" aria-hidden="true">🛍</span><h2>Your bag is empty</h2><p>Add something to your bag before beginning checkout.</p><a class="btn btn--primary" href="shop.html">Browse the collection</a>`;
  layout?.before(empty);
  layout?.setAttribute("hidden", "");
};

backButton?.addEventListener("click", () => {
  showStep(currentStep - 1);
});

nextButton?.addEventListener("click", () => {
  if (!validateStep(currentStep)) {
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    firstInvalid?.focus();
    showToast("Review the highlighted checkout details", "error");
    return;
  }
  showStep(currentStep + 1);
});

form?.addEventListener("focusout", (event) => {
  if (event.target.matches("input, select")) validateField(event.target);
});
form?.addEventListener("input", (event) => {
  if (event.target.getAttribute("aria-invalid") === "true") validateField(event.target);
});
form?.addEventListener("change", (event) => {
  if (event.target.name === "shippingMethod") {
    validateRadioGroup("shippingMethod");
    renderSummary();
  }
  if (event.target.name === "paymentMethod") validateRadioGroup("paymentMethod");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSubmitting) return;
  if (currentStep < STEPS.length - 1) { nextButton?.click(); return; }
  const currentItems = getDetailedCart();
  if (!currentItems.length) {
    showEmptyCheckout();
    showToast("Your bag is empty. Add a product before checking out.", "error");
    return;
  }
  if (!validateStep(STEPS.indexOf("review"))) {
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    const invalidStep = firstInvalid?.closest("[data-checkout-step]")?.dataset.checkoutStep;
    if (invalidStep) showStep(STEPS.indexOf(invalidStep));
    firstInvalid?.focus();
    showToast("Review the highlighted checkout details", "error");
    return;
  }

  const data = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  isSubmitting = true;
  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  submitButton.textContent = "Creating demo order…";
  try {
    await placeOrder({
      name: String(data.get("name")),
      email: String(data.get("email")),
      phone: String(data.get("phone")),
      address: String(data.get("address")),
      city: String(data.get("city")),
      region: String(data.get("region")),
      postalCode: String(data.get("postalCode")),
      country: String(data.get("country")),
      countryName: form.elements.country.selectedOptions[0]?.textContent.trim() || String(data.get("country")),
      shippingMethod: String(data.get("shippingMethod")),
      paymentMethod: PAYMENT_MAP[String(data.get("paymentMethod"))] || "card",
      discountCode: getPromotionCode(),
      idempotencyKey: checkoutKey,
    });
    window.location.href = "order-success.html";
  } catch (error) {
    isSubmitting = false;
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
    submitButton.textContent = "Place demo order";
    if (error instanceof AppError && error.details?.fieldErrors) {
      Object.entries(error.details.fieldErrors).forEach(([name, message]) => {
        const input = form.elements.namedItem(name);
        if (input) {
          const errorNode = getErrorElement(input);
          input.setAttribute("aria-invalid", "true");
          errorNode.textContent = message;
          errorNode.hidden = false;
        }
      });
    }
    showToast(error.message || "Checkout could not be completed", "error");
  }
});

if (!items.length) showEmptyCheckout();
else {
  trackEvent(ANALYTICS_EVENTS.CHECKOUT_STARTED, { entityId: "checkout" });
  showStep(0);
  renderSummary();
}

window.addEventListener("ecommerce:cart-change", () => {
  items = getDetailedCart();
  if (!items.length) showEmptyCheckout();
  else renderSummary();
});

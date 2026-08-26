import { clearCart } from "../cart.js";
import {
  calculateOrder,
  getDetailedCart,
  getEstimatedDelivery,
  getPromotionCode,
  setPromotionCode,
} from "../order.js";
import { STORAGE_KEYS, writeSessionStorage } from "../storage.js";
import { createOrderReference, showToast } from "../ui.js";
import { escapeHtml, formatCurrency, safeImage } from "../utils.js";

const FALLBACK_IMAGE = "assets/images/product-placeholder.svg";
const form = document.querySelector("#checkout-form");
const summaryContainer = document.querySelector("#checkout-summary");
let items = getDetailedCart();

const rules = {
  name: (value) => value.trim().length >= 2 || "Enter your full name.",
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "Enter an email address in the format name@example.com.",
  phone: (value) => {
    const digits = value.replace(/\D/g, "");
    return (/^[+\d().\s-]+$/.test(value.trim()) && digits.length >= 7 && digits.length <= 15)
      || "Enter a phone number with 7 to 15 digits using numbers and standard separators.";
  },
  address: (value) => value.trim().length >= 5 || "Enter a complete street address.",
  city: (value) => value.trim().length >= 2 || "Enter your city.",
  region: (value) => value.trim().length >= 2 || "Enter your state or region.",
  postalCode: (value) => /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/.test(value.trim()) || "Enter a valid postal or ZIP code.",
  country: (value) => Boolean(value) || "Choose a country.",
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
  const rule = rules[input.name];
  if (!rule) return true;
  const result = rule(input.value);
  const valid = result === true;
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

const showPopulatedCheckout = () => {
  document.querySelector(".checkout-layout__empty")?.remove();
  const layout = document.querySelector(".checkout-layout");
  layout?.removeAttribute("hidden");
  form?.removeAttribute("hidden");
  summaryContainer?.removeAttribute("hidden");
};

const renderSummary = () => {
  if (!summaryContainer) return;
  items = getDetailedCart();
  if (!items.length) {
    showEmptyCheckout();
    return;
  }
  showPopulatedCheckout();
  const order = calculateOrder({
    items,
    shippingMethod: getShippingMethod(),
    discountCode: getPromotionCode(),
  });
  summaryContainer.innerHTML = `
    <h2 id="checkout-summary-title">Your order</h2>
    <ul class="checkout-items" aria-label="Order items">
      ${order.items.map((item) => `<li>
        <div class="checkout-items__image"><img src="${escapeHtml(safeImage(item.product.images?.[0], FALLBACK_IMAGE))}" alt="" width="72" height="90" loading="lazy" data-image-fallback><span>${item.quantity}</span></div>
        <div><strong>${escapeHtml(item.product.name)}</strong><small>${escapeHtml(Object.values(item.options || {}).filter(Boolean).join(" · "))}</small></div>
        <span>${formatCurrency(item.product.price * item.quantity)}</span>
      </li>`).join("")}
    </ul>
    <dl class="summary-card__lines">
      <div><dt>Subtotal</dt><dd>${formatCurrency(order.subtotal)}</dd></div>
      <div><dt>Shipping</dt><dd>${order.shipping === 0 ? "Complimentary" : formatCurrency(order.shipping)}</dd></div>
      ${order.discount ? `<div class="summary-card__discount"><dt>Promotion</dt><dd>−${formatCurrency(order.discount)}</dd></div>` : ""}
      <div class="summary-card__total"><dt>Total</dt><dd>${formatCurrency(order.total)}</dd></div>
    </dl>
    <p class="summary-card__notice"><span aria-hidden="true">◎</span> This is a simulated checkout. No payment or order is sent.</p>`;
  summaryContainer.setAttribute("aria-busy", "false");
};

const showEmptyCheckout = () => {
  if (document.querySelector(".checkout-layout__empty")) return;
  form?.setAttribute("hidden", "");
  if (summaryContainer) summaryContainer.hidden = true;
  const layout = document.querySelector(".checkout-layout");
  const empty = document.createElement("div");
  empty.className = "empty-state empty-state--page checkout-layout__empty";
  empty.innerHTML = `<span class="empty-state__icon" aria-hidden="true">🛍</span><h2>Your bag is empty</h2><p>Add something to your bag before beginning checkout.</p><a class="btn btn--primary" href="shop.html">Browse the collection</a>`;
  layout?.before(empty);
  layout?.setAttribute("hidden", "");
};

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

form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const currentItems = getDetailedCart();
    if (!currentItems.length) {
      showEmptyCheckout();
      showToast("Your bag is empty. Add a product before checking out.", "error");
      return;
    }
    const fields = [...form.querySelectorAll("input, select")].filter((input) => rules[input.name]);
    const validFields = fields.map(validateField).every(Boolean);
    const validShipping = validateRadioGroup("shippingMethod");
    const validPayment = validateRadioGroup("paymentMethod");
    if (!validFields || !validShipping || !validPayment) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      firstInvalid?.focus();
      showToast("Review the highlighted checkout details", "error");
      return;
    }

    const data = new FormData(form);
    const shippingMethod = data.get("shippingMethod");
    const totals = calculateOrder({
      items: currentItems,
      shippingMethod,
      discountCode: getPromotionCode(),
    });
    const now = new Date();
    const order = {
      reference: createOrderReference(),
      createdAt: now.toISOString(),
      status: "simulated",
      contact: {
        name: String(data.get("name")).trim(),
        email: String(data.get("email")).trim(),
        phone: String(data.get("phone")).trim(),
      },
      shipping: {
        address: String(data.get("address")).trim(),
        city: String(data.get("city")).trim(),
        region: String(data.get("region")).trim(),
        postalCode: String(data.get("postalCode")).trim(),
        country: form.elements.country.selectedOptions[0]?.textContent.trim() || String(data.get("country")).trim(),
        countryCode: String(data.get("country")).trim(),
        method: shippingMethod,
      },
      paymentMethod: String(data.get("paymentMethod")),
      estimatedDelivery: getEstimatedDelivery(shippingMethod, now),
      items: totals.items.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        image: item.product.images?.[0] || FALLBACK_IMAGE,
        price: item.product.price,
        quantity: item.quantity,
        options: item.options || {},
      })),
      totals: {
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        discount: totals.discount,
        total: totals.total,
      },
    };
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.textContent = "Creating demo order…";
    const stored = writeSessionStorage(STORAGE_KEYS.LAST_ORDER, order);
    if (!stored) {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.textContent = "Place demo order";
      showToast("Your browser blocked temporary order storage. Update its site-storage setting and try again.", "error");
      return;
    }

    window.setTimeout(() => {
      clearCart();
      setPromotionCode("");
      window.location.href = "order-success.html";
    }, 500);
});

if (!items.length) showEmptyCheckout();
else renderSummary();

window.addEventListener("ecommerce:cart-change", () => {
  items = getDetailedCart();
  if (!items.length) showEmptyCheckout();
  else renderSummary();
});

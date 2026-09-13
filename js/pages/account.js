import { appReady } from "../core/app.js";
import { showToast } from "../ui.js";
import {
  getCurrentUser,
  login,
  logout,
  register,
  updateCurrentUser,
} from "../services/authService.js";
import { bindAuthForm, passwordToggleMarkup } from "../components/authForm.js";
import { validateEmail, validatePassword, validateName } from "../utils/validators.js";
import { getAdminDestination } from "../domain/adminRoutes.js";
import { escapeHtml } from "../utils.js";
import { AppError } from "../core/errors.js";

await appReady().catch(() => {});

const mount = document.querySelector("#account-page");

const render = async () => {
  if (!mount) return;
  mount.setAttribute("aria-busy", "true");
  const user = await getCurrentUser();
  if (!user) {
    mount.innerHTML = `
      <div class="account-auth">
        <p class="auth-demo-note">Accounts are saved in this browser. Use demonstration details only. <a href="admin/login.html">Open the admin portal</a> · <a href="README.md#demonstration-accounts">Demo account setup</a></p>
        <div class="account-auth__grid">
          <form id="login-form" class="auth-form" novalidate aria-labelledby="customer-login-title">
            <h2 id="customer-login-title">Welcome back</h2>
            <p class="auth-intro">Sign in to manage your account and orders.</p>
            <div class="auth-feedback" data-form-feedback role="alert" tabindex="-1" hidden></div>
            <div class="auth-field"><label for="login-email">Email address</label>
            <input id="login-email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" aria-describedby="login-email-error" required>
            <p class="field-error" id="login-email-error" aria-live="polite" hidden></p></div>
            <div class="auth-field"><label for="login-password">Password</label>
            <div class="password-field"><input id="login-password" name="password" type="password" autocomplete="current-password" aria-describedby="login-password-error" required>${passwordToggleMarkup("login-password")}</div>
            <p class="field-error" id="login-password-error" aria-live="polite" hidden></p></div>
            <button class="btn btn--primary" type="submit">Sign in</button>
            <p class="form-hint">Your session stays in this browser tab.</p>
          </form>
          <form id="register-form" class="auth-form" novalidate aria-labelledby="register-title">
            <h2 id="register-title">New to Morrow?</h2>
            <p class="auth-intro">Create an account for this local demonstration.</p>
            <div class="auth-feedback" data-form-feedback role="alert" tabindex="-1" hidden></div>
            <div class="auth-field"><label for="register-name">Full name</label>
            <input id="register-name" name="name" type="text" autocomplete="name" aria-describedby="register-name-error" required>
            <p class="field-error" id="register-name-error" aria-live="polite" hidden></p></div>
            <div class="auth-field"><label for="register-email">Email address</label>
            <input id="register-email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" aria-describedby="register-email-error" required>
            <p class="field-error" id="register-email-error" aria-live="polite" hidden></p></div>
            <div class="auth-field"><label for="register-password">Password</label>
            <div class="password-field"><input id="register-password" name="password" type="password" autocomplete="new-password" minlength="8" aria-describedby="register-password-hint register-password-error" required>${passwordToggleMarkup("register-password")}</div>
            <p class="form-hint" id="register-password-hint">At least 8 characters, including a letter and a number.</p>
            <p class="field-error" id="register-password-error" aria-live="polite" hidden></p></div>
            <button class="btn btn--secondary" type="submit">Create demo account</button>
          </form>
        </div>
      </div>`;
    const onSuccess = async () => {
      showToast("Signed in to this browser session");
      await render();
      mount.querySelector("#account-profile-title")?.focus();
    };
    bindAuthForm(mount.querySelector("#login-form"), {
      rules: { email: (value) => value.trim() ? validateEmail(value) : "Please enter your email address.", password: (value) => Boolean(value) || "Please enter your password." },
      submit: ({ email, password }) => login(email, password), onSuccess,
    });
    bindAuthForm(mount.querySelector("#register-form"), {
      rules: { name: validateName, email: validateEmail, password: validatePassword },
      submit: register, onSuccess, pendingLabel: "Creating account…",
    });
    mount.setAttribute("aria-busy", "false");
    return;
  }

  const addresses = user.addresses || [];
  mount.innerHTML = `
    <div class="account-profile">
      <h2 id="account-profile-title" tabindex="-1">Your account</h2>
      <p>Signed in as <strong>${escapeHtml(user.name || user.email)}</strong> · role <code>${escapeHtml(user.role)}</code></p>
      <p>This role is enforced in application logic for the demo. It is not production authorization.</p>
      <p><a class="btn btn--secondary" href="orders.html">View orders</a> <button class="btn btn--text" type="button" id="logout-button">Sign out</button></p>
      ${getAdminDestination(null, user.role) ? `<p><a class="btn btn--primary" href="admin/${getAdminDestination(null, user.role)}">Open admin workspace</a></p>` : ""}
      <h2>Saved addresses</h2>
      ${addresses.length ? `<ul>${addresses.map((address) => `<li><strong>${escapeHtml(address.label || "Address")}</strong>${address.isDefault ? " <span>(default)</span>" : ""}<br>${escapeHtml(address.address)}, ${escapeHtml(address.city)}<br><button class="btn btn--text" type="button" data-address-default="${escapeHtml(address.id)}">Make default</button> <button class="btn btn--text" type="button" data-address-remove="${escapeHtml(address.id)}">Remove</button></li>`).join("")}</ul>` : "<p>No saved addresses yet.</p>"}
      <form id="address-form" class="checkout-form">
        <h3>Add an address</h3>
        <label for="addr-label">Label</label>
        <input id="addr-label" name="label" value="Home">
        <label for="addr-line">Street</label>
        <input id="addr-line" name="address" required>
        <label for="addr-city">City</label>
        <input id="addr-city" name="city" required>
        <label for="addr-region">Region</label>
        <input id="addr-region" name="region" required>
        <label for="addr-postal">Postal code</label>
        <input id="addr-postal" name="postalCode" required>
        <button class="btn btn--primary" type="submit">Save address</button>
      </form>
    </div>`;
  mount.querySelector("#logout-button").addEventListener("click", () => {
    logout();
    showToast("Signed out");
    render().then(() => mount.querySelector("#login-email")?.focus());
  });
  mount.querySelectorAll("[data-address-remove], [data-address-default]").forEach((button) => {
    button.addEventListener("click", async () => {
      const current = user.addresses || [];
      let next = current;
      if (button.dataset.addressRemove) {
        next = current.filter((address) => address.id !== button.dataset.addressRemove);
        if (next.length && !next.some((address) => address.isDefault)) next = next.map((address, index) => ({ ...address, isDefault: index === 0 }));
      } else {
        next = current.map((address) => ({ ...address, isDefault: address.id === button.dataset.addressDefault }));
      }
      try {
        await updateCurrentUser({ addresses: next });
        showToast(button.dataset.addressRemove ? "Address removed" : "Default address updated");
        render();
      } catch (error) {
        showToast(error instanceof AppError ? error.message : "Unable to update that address", "error");
      }
    });
  });
  mount.querySelector("#address-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      await updateCurrentUser({
        addresses: [
          ...(user.addresses || []),
          {
            id: crypto.randomUUID?.() || `addr-${Date.now()}`,
            label: String(data.get("label") || "Address"),
            address: String(data.get("address")),
            city: String(data.get("city")),
            region: String(data.get("region")),
            postalCode: String(data.get("postalCode")),
            country: "United States",
            countryCode: "US",
            isDefault: !(user.addresses || []).length,
          },
        ],
      });
      showToast("Address saved in this browser");
      render();
    } catch (error) {
      showToast(error instanceof AppError ? error.message : "Unable to save that address", "error");
    }
  });
  mount.setAttribute("aria-busy", "false");
};

render();

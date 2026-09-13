import { appReady } from "../../core/app.js";
import {
  authenticateAdmin,
  getCurrentUser,
} from "../../services/authService.js";
import { getAdminDestination } from "../../domain/adminRoutes.js";
import { bindAuthForm } from "../../components/authForm.js";
import { validateEmail } from "../../utils/validators.js";

const form = document.querySelector("#admin-login-form");
const status = document.querySelector("#auth-status");
const params = new URLSearchParams(location.search);
const redirect = (user) => {
  const destination = getAdminDestination(params.get("next"), user?.role);
  if (destination) location.replace(destination);
};

try {
  await appReady();
  const user = await getCurrentUser();
  if (getAdminDestination(params.get("next"), user?.role)) {
    status.textContent = "Opening your workspace…";
    redirect(user);
  } else {
    const messages = {
      expired: "Your session has expired. Please sign in again.",
      signedout: "You have signed out.",
      required: "Sign in to continue to your admin workspace.",
    };
    status.textContent = messages[params.get("reason")] || "";
    status.hidden = !status.textContent;
    form.querySelectorAll("input, button").forEach((control) => {
      control.disabled = false;
    });
    bindAuthForm(form, {
      rules: {
        email: (value) =>
          value.trim()
            ? validateEmail(value)
            : "Please enter your email address.",
        password: (value) => Boolean(value) || "Please enter your password.",
      },
      submit: ({ email, password }) => authenticateAdmin(email, password),
      onSuccess: redirect,
    });
  }
} catch {
  status.textContent =
    "Unable to open local sign-in. Reload this page to try again. Your saved data has not been reset.";
  status.setAttribute("role", "alert");
}

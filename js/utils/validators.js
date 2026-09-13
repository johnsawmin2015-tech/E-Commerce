const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/;

export const validateEmail = (value) => {
  const email = String(value ?? "").trim();
  return EMAIL_PATTERN.test(email) || "Enter an email address in the format name@example.com.";
};

export const validatePhone = (value) => {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  return (
    (/^[+\d().\s-]+$/.test(raw) && digits.length >= 7 && digits.length <= 15) ||
    "Enter a phone number with 7 to 15 digits using numbers and standard separators."
  );
};

export const validatePassword = (value) => {
  const password = String(value ?? "");
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use letters and at least one number.";
  }
  return true;
};

export const validateName = (value) =>
  String(value ?? "").trim().length >= 2 || "Enter your full name.";

export const validateAddressLine = (value) =>
  String(value ?? "").trim().length >= 5 || "Enter a complete street address.";

export const validateCity = (value) =>
  String(value ?? "").trim().length >= 2 || "Enter your city.";

export const validateRegion = (value) =>
  String(value ?? "").trim().length >= 2 || "Enter your state or region.";

export const validatePostalCode = (value) =>
  POSTAL_PATTERN.test(String(value ?? "").trim()) || "Enter a valid postal or ZIP code.";

export const validateCountry = (value) => Boolean(String(value ?? "").trim()) || "Choose a country.";

export const validatePrice = (value) => {
  const number = Number(value);
  return (Number.isFinite(number) && number >= 0) || "Enter a valid price of zero or more.";
};

export const validateQuantity = (value, { min = 1, max = Number.POSITIVE_INFINITY } = {}) => {
  const number = Number(value);
  if (!Number.isInteger(number) && !(Number.isFinite(number) && Math.trunc(number) === number)) {
    return "Enter a whole quantity.";
  }
  const quantity = Math.trunc(number);
  if (quantity < min) return `Quantity must be at least ${min}.`;
  if (quantity > max) return `Quantity cannot exceed ${max}.`;
  return true;
};

export const validateStock = (value) => {
  const number = Number(value);
  return (Number.isInteger(number) && number >= 0) || "Stock must be a whole number of zero or more.";
};

export const validateCouponCode = (value) => {
  const code = String(value ?? "").trim();
  if (!code) return "Enter a promotion code.";
  if (!/^[A-Z0-9][A-Z0-9-]{1,22}$/i.test(code)) return "Use letters, numbers, or hyphens only.";
  return true;
};

export const isValid = (result) => result === true;

export const CHECKOUT_FIELD_VALIDATORS = Object.freeze({
  name: validateName,
  email: validateEmail,
  phone: validatePhone,
  address: validateAddressLine,
  city: validateCity,
  region: validateRegion,
  postalCode: validatePostalCode,
  country: validateCountry,
});

export default Object.freeze({
  validateEmail,
  validatePhone,
  validatePassword,
  validateName,
  validateAddressLine,
  validateCity,
  validateRegion,
  validatePostalCode,
  validateCountry,
  validatePrice,
  validateQuantity,
  validateStock,
  validateCouponCode,
  isValid,
  CHECKOUT_FIELD_VALIDATORS,
});

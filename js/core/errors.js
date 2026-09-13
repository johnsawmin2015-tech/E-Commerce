export const ErrorCodes = Object.freeze({
  DATABASE_FAILURE: "DATABASE_FAILURE",
  INVALID_INPUT: "INVALID_INPUT",
  DUPLICATE_RECORD: "DUPLICATE_RECORD",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  CORRUPTED_DATA: "CORRUPTED_DATA",
  MISSING_PRODUCT: "MISSING_PRODUCT",
  INVALID_COUPON: "INVALID_COUPON",
  UNAUTHORIZED: "UNAUTHORIZED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  EMPTY_CART: "EMPTY_CART",
  CHECKOUT_INVALID: "CHECKOUT_INVALID",
  NOT_FOUND: "NOT_FOUND",
});

export class AppError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ cause?: unknown, details?: object }} [options]
   */
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.details = options.details ?? {};
  }
}

export const isAppError = (value) => value instanceof AppError;

export const toUserMessage = (error) => {
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return "Something went wrong. Please try again.";
  return "Something went wrong. Please try again.";
};

export const reportError = (error, context = "") => {
  const prefix = context ? `[Morrow] ${context}:` : "[Morrow]";
  if (isAppError(error)) {
    console.error(prefix, error.code, error.message, error.details);
  } else {
    console.error(prefix, error);
  }
};

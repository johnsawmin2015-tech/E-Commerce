import { ORDER_STATUS, ORDER_TRANSITIONS } from "../core/constants.js";
import { AppError, ErrorCodes } from "../core/errors.js";

export const canTransition = (from, to) =>
  (ORDER_TRANSITIONS[from] || []).includes(to);

export const assertTransition = (from, to) => {
  if (from === to) {
    throw new AppError(ErrorCodes.INVALID_TRANSITION, `Order is already ${from}.`, { details: { from, to } });
  }
  if (!canTransition(from, to)) {
    throw new AppError(
      ErrorCodes.INVALID_TRANSITION,
      `Orders cannot move from ${from} to ${to}.`,
      { details: { from, to, allowed: ORDER_TRANSITIONS[from] || [] } },
    );
  }
  return true;
};

export const nextStatuses = (from) => [...(ORDER_TRANSITIONS[from] || [])];

export const isCancellable = (status) =>
  status === ORDER_STATUS.PENDING || status === ORDER_STATUS.CONFIRMED;

export const isOpenFulfillment = (status) =>
  [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.PACKED,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
  ].includes(status);

export default Object.freeze({
  canTransition,
  assertTransition,
  nextStatuses,
  isCancellable,
  isOpenFulfillment,
});

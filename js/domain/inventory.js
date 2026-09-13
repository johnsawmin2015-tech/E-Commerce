import { roundCurrency } from "../utils/currency.js";

export const availableStock = (record) => {
  const onHand = Math.max(0, Number(record?.onHand) || 0);
  const reserved = Math.max(0, Number(record?.reserved) || 0);
  return Math.max(0, onHand - reserved);
};

export const isLowStock = (record) =>
  availableStock(record) <= (Number(record?.reorderLevel) || 0) && availableStock(record) > 0;

export const isOutOfStock = (record) => availableStock(record) <= 0;

export const canReserve = (record, quantity) =>
  Number.isInteger(quantity) && quantity > 0 && availableStock(record) >= quantity;

export const applyReservation = (record, quantity) => {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, record, reason: "invalid-quantity" };
  if (!canReserve(record, qty)) {
    return { ok: false, record, reason: "insufficient-stock" };
  }
  return {
    ok: true,
    record: {
      ...record,
      reserved: (Number(record.reserved) || 0) + qty,
    },
  };
};

export const releaseReservation = (record, quantity) => {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) return { ...record };
  return {
    ...record,
    reserved: Math.max(0, (Number(record.reserved) || 0) - qty),
  };
};

export const completeSale = (record, quantity) => {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0 || qty > Number(record?.onHand || 0) || qty > Number(record?.reserved || 0)) return { ...record };
  const reserved = Math.max(0, (Number(record.reserved) || 0) - qty);
  const onHand = Math.max(0, (Number(record.onHand) || 0) - qty);
  return {
    ...record,
    onHand,
    reserved,
  };
};

export const reverseSale = (record, quantity) => {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) return { ...record };
  return {
    ...record,
    onHand: (Number(record.onHand) || 0) + qty,
  };
};

export const adjustOnHand = (record, delta) => ({
  ...record,
  onHand: Math.max(0, (Number(record.onHand) || 0) + (Number(delta) || 0)),
});

export const snapshotAvailability = (record) => ({
  onHand: Number(record?.onHand) || 0,
  reserved: Number(record?.reserved) || 0,
  available: availableStock(record),
  reorderLevel: Number(record?.reorderLevel) || 0,
  lowStock: isLowStock(record),
  outOfStock: isOutOfStock(record),
});

export const roundMoney = roundCurrency;

export default Object.freeze({
  availableStock,
  isLowStock,
  isOutOfStock,
  canReserve,
  applyReservation,
  releaseReservation,
  completeSale,
  reverseSale,
  adjustOnHand,
  snapshotAvailability,
});

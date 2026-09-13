export const formatDate = (value, options = {}) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(value));

export const formatDateTime = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export const toIso = (value = new Date()) => new Date(value).toISOString();

export default Object.freeze({ formatDate, formatDateTime, toIso });

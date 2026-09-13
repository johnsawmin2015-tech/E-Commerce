export const starRating = (value, { max = 5 } = {}) => {
  const rating = Math.max(0, Math.min(max, Number(value) || 0));
  return `${rating} / ${max}`;
};

export default starRating;

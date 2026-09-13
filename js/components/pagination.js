export const paginate = (items, page = 1, pageSize = 12) => {
  const collection = Array.isArray(items) ? items : [];
  const size = Math.max(1, Math.trunc(pageSize) || 12);
  const totalPages = Math.max(1, Math.ceil(collection.length / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  const start = (current - 1) * size;
  return {
    page: current,
    pageSize: size,
    totalPages,
    total: collection.length,
    items: collection.slice(start, start + size),
  };
};

export default paginate;

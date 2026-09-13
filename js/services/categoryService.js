import { PERMISSIONS } from "../core/constants.js";
import { AppError, ErrorCodes } from "../core/errors.js";
import { categoryRepository, productRepository } from "../data/repositories.js";
import { requirePermission } from "./authService.js";
import { slugify } from "../utils/helpers.js";

export const listCategories = async () => {
  requirePermission(PERMISSIONS.PRODUCTS_READ);
  return (await categoryRepository.getAll()).sort((left, right) => String(left.name).localeCompare(String(right.name)));
};

export const upsertCategory = async ({ id, name, subcategories = [] } = {}) => {
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE);
  const normalized = String(name || "").trim();
  if (normalized.length < 2) throw new AppError(ErrorCodes.INVALID_INPUT, "Category names need at least two characters.");
  const rows = await categoryRepository.getAll();
  if (rows.some((row) => row.id !== id && String(row.name).toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
    throw new AppError(ErrorCodes.DUPLICATE_RECORD, "That category already exists.");
  }
  return categoryRepository.save({
    id: id || slugify(normalized),
    name: normalized,
    subcategories: [...new Set((Array.isArray(subcategories) ? subcategories : []).map((value) => String(value).trim()).filter(Boolean))],
  });
};

export const removeCategory = async (id) => {
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE);
  const category = await categoryRepository.getById(id);
  if (!category) return false;
  const products = await productRepository.getAll();
  if (products.some((product) => product.category === category.name)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "Reassign products before removing a category.");
  }
  await categoryRepository.remove(id);
  return true;
};

export default Object.freeze({ listCategories, upsertCategory, removeCategory });

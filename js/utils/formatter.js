export const optionLabel = (options = {}) =>
  Object.entries(options)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key[0].toUpperCase()}${key.slice(1)}: ${value}`)
    .join(" · ");

export const titleCase = (value) =>
  String(value ?? "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export default Object.freeze({ optionLabel, titleCase, pluralize });

import {
  applyProductPipeline,
  normalizeFilterState,
  readShopState,
  serializeShopState,
} from "../filters.js?v=20260829-1";
import { getProducts } from "../services/product-service.js?v=20260829-1";
import { renderProductGrid } from "../ui.js?v=20260829-1";
import {
  debounce,
  escapeHtml,
  formatCurrency,
  getFocusableElements,
  setSiblingsInert,
} from "../utils.js?v=20260829-1";

const PAGE_SIZE = 12;
const products = getProducts();
const elements = {
  form: document.querySelector("#filter-form"),
  searchForm: document.querySelector("#shop-search-form"),
  categoryFilters: document.querySelector("#category-filters"),
  brandFilters: document.querySelector("#brand-filters"),
  search: document.querySelector("#shop-search"),
  sort: document.querySelector("#sort-select"),
  grid: document.querySelector("#product-grid"),
  count: document.querySelector("#product-count"),
  active: document.querySelector("#active-filters"),
  clear: document.querySelector("#clear-filters"),
  loadMore: document.querySelector("#load-more"),
  panel: document.querySelector("#filter-panel"),
  backdrop: document.querySelector("#filter-backdrop"),
  openFilters: document.querySelector("#filter-drawer-toggle"),
  closeFilters: document.querySelector("#filter-close"),
};

const facetKey = (value) => String(value ?? "").trim().toLocaleLowerCase("en-US");
const categoryLookup = new Map(products.map((product) => [facetKey(product.category), product.category]));
const brandLookup = new Map(products.map((product) => [facetKey(product.brand), product.brand]));

const canonicalizeFacets = (values, lookup) => [
  ...new Set(values.map((value) => lookup.get(facetKey(value))).filter(Boolean)),
];

const sanitizeState = (candidate) => {
  const normalized = normalizeFilterState(candidate);
  let { minPrice, maxPrice } = normalized;

  if (minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice)) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    ...normalized,
    categories: canonicalizeFacets(normalized.categories, categoryLookup),
    brands: canonicalizeFacets(normalized.brands, brandLookup),
    minPrice,
    maxPrice,
  };
};

const getStateFromUrl = () => sanitizeState(readShopState(window.location.search));

let state = getStateFromUrl();
let pendingFilterFocusIndex = null;
let searchHistoryPrimed = false;

const titleCase = (value) => value
  .replaceAll("-", " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

const renderFilterOptions = () => {
  const categoryCounts = products.reduce((counts, product) => {
    counts.set(product.category, (counts.get(product.category) || 0) + 1);
    return counts;
  }, new Map());
  const brandCounts = products.reduce((counts, product) => {
    counts.set(product.brand, (counts.get(product.brand) || 0) + 1);
    return counts;
  }, new Map());

  if (elements.categoryFilters) {
    elements.categoryFilters.innerHTML = [...categoryCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, count]) => `<label class="check-row">
        <input type="checkbox" name="category" value="${escapeHtml(category)}">
        <span>${escapeHtml(titleCase(category))}</span><small>${count}</small>
      </label>`).join("");
  }
  if (elements.brandFilters) {
    elements.brandFilters.innerHTML = [...brandCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([brand, count]) => `<label class="check-row">
        <input type="checkbox" name="brand" value="${escapeHtml(brand)}">
        <span>${escapeHtml(brand)}</span><small>${count}</small>
      </label>`).join("");
  }
};

const syncForm = () => {
  if (elements.search) elements.search.value = state.q;
  if (elements.sort) elements.sort.value = state.sort;
  elements.form?.querySelectorAll('input[name="category"]').forEach((input) => {
    input.checked = state.categories.includes(input.value);
  });
  elements.form?.querySelectorAll('input[name="brand"]').forEach((input) => {
    input.checked = state.brands.includes(input.value);
  });
  const availability = elements.form?.querySelector(`input[name="availability"][value="${state.availability}"]`);
  if (availability) availability.checked = true;
  const minPrice = elements.form?.elements.namedItem("minPrice");
  const maxPrice = elements.form?.elements.namedItem("maxPrice");
  if (minPrice) minPrice.value = state.minPrice;
  if (maxPrice) maxPrice.value = state.maxPrice;
};

const updateUrl = (mode = "replace") => {
  const params = serializeShopState(state, window.location.search);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (url === currentUrl) return;

  const method = mode === "push" ? "pushState" : "replaceState";
  window.history[method]({ shopState: state }, "", url);
};

const getActiveFilterCount = () =>
  state.categories.length
  + state.brands.length
  + (state.availability !== "all" ? 1 : 0)
  + (state.minPrice !== "" ? 1 : 0)
  + (state.maxPrice !== "" ? 1 : 0);

const renderActiveFilters = () => {
  if (!elements.active) return;
  const chips = [
    ...state.categories.map((value) => ({ kind: "category", value, label: titleCase(value) })),
    ...state.brands.map((value) => ({ kind: "brand", value, label: value })),
  ];
  if (state.availability !== "all") chips.push({ kind: "availability", value: state.availability, label: titleCase(state.availability) });
  if (state.minPrice !== "") chips.push({ kind: "minPrice", value: state.minPrice, label: `From ${formatCurrency(Number(state.minPrice))}` });
  if (state.maxPrice !== "") chips.push({ kind: "maxPrice", value: state.maxPrice, label: `Up to ${formatCurrency(Number(state.maxPrice))}` });
  elements.active.innerHTML = chips.map((chip) => `<button type="button" class="chip" data-remove-filter="${chip.kind}" data-filter-value="${escapeHtml(chip.value)}">${escapeHtml(chip.label)} <span aria-hidden="true">×</span><span class="sr-only">Remove filter</span></button>`).join("");
  elements.active.hidden = chips.length === 0;
  if (elements.clear) elements.clear.hidden = chips.length === 0 && !state.q;
  const countBadge = elements.openFilters?.querySelector("[data-filter-count]");
  if (countBadge) {
    const count = getActiveFilterCount();
    countBadge.textContent = String(count);
    countBadge.hidden = count === 0;
  }
  if (pendingFilterFocusIndex !== null) {
    const requestedIndex = pendingFilterFocusIndex;
    pendingFilterFocusIndex = null;
    window.requestAnimationFrame(() => {
      const remainingChips = [...elements.active.querySelectorAll("[data-remove-filter]")];
      const resultsHeading = document.querySelector("#shop-results-heading");
      if (resultsHeading) resultsHeading.tabIndex = -1;
      (remainingChips[Math.min(requestedIndex, remainingChips.length - 1)]
        || (!elements.clear?.hidden && !elements.clear?.closest("[hidden]") ? elements.clear : null)
        || resultsHeading)?.focus();
    });
  }
};

const render = ({ historyMode = "none" } = {}) => {
  state = sanitizeState(state);
  let results = [];
  try {
    results = applyProductPipeline(products, state);
  } catch (error) {
    console.error("Unable to apply product filters", error);
  }
  const maximumPage = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  state.page = Math.min(state.page, maximumPage);
  const visibleCount = Math.min(results.length, state.page * PAGE_SIZE);
  renderProductGrid(elements.grid, results.slice(0, visibleCount), {
    emptyTitle: state.q ? `No results for “${state.q}”` : "No products match your filters",
    emptyMessage: "Try a broader search or remove one of the active filters.",
    emptyAction: "Clear filters",
  });
  if (elements.count) {
    elements.count.textContent = `${results.length} ${results.length === 1 ? "product" : "products"}`;
  }
  if (elements.loadMore) {
    elements.loadMore.hidden = visibleCount >= results.length;
    elements.loadMore.textContent = `Load more (${results.length - visibleCount} remaining)`;
  }
  renderActiveFilters();
  if (historyMode !== "none") updateUrl(historyMode);
};

const collectFilterForm = ({ historyMode = "push" } = {}) => {
  const formData = new FormData(elements.form);
  state = sanitizeState({
    ...state,
    categories: formData.getAll("category"),
    brands: formData.getAll("brand"),
    availability: formData.get("availability") || "all",
    minPrice: String(formData.get("minPrice") || "").trim(),
    maxPrice: String(formData.get("maxPrice") || "").trim(),
    page: 1,
  });
  syncForm();
  render({ historyMode });
};

const clearFilters = () => {
  state = {
    q: "",
    categories: [],
    brands: [],
    availability: "all",
    minPrice: "",
    maxPrice: "",
    sort: "featured",
    page: 1,
  };
  syncForm();
  render({ historyMode: "push" });
  elements.search?.focus();
};

const desktopQuery = window.matchMedia("(min-width: 1024px)");
let filterInertActive = false;

const setFilterPanel = (open, { restoreFocus = true } = {}) => {
  if (!elements.panel || !elements.backdrop) return;
  const wasOpen = elements.panel.classList.contains("filters--open");
  const isMobile = !desktopQuery.matches;
  const shouldOpen = Boolean(open && isMobile);

  elements.panel.classList.toggle("filters--open", shouldOpen);
  elements.panel.hidden = isMobile && !shouldOpen;
  elements.backdrop.hidden = !shouldOpen;
  elements.openFilters?.setAttribute("aria-expanded", String(shouldOpen));

  if (shouldOpen) {
    elements.panel.setAttribute("role", "dialog");
    elements.panel.setAttribute("aria-modal", "true");
    document.body.classList.add("is-scroll-locked");
    if (!filterInertActive) {
      setSiblingsInert(elements.panel, true);
      filterInertActive = true;
    }
    // The dismissible scrim is intentionally the one non-panel sibling that
    // remains interactive while the rest of the page is inert.
    elements.backdrop.inert = false;
    window.requestAnimationFrame(() => elements.closeFilters?.focus());
    return;
  }

  elements.panel.removeAttribute("role");
  elements.panel.removeAttribute("aria-modal");
  if (filterInertActive) {
    setSiblingsInert(elements.panel, false);
    filterInertActive = false;
  }
  if (wasOpen) document.body.classList.remove("is-scroll-locked");
  if (wasOpen && restoreFocus) elements.openFilters?.focus();
};

renderFilterOptions();
syncForm();
render({ historyMode: "replace" });
setFilterPanel(false, { restoreFocus: false });

elements.form?.addEventListener("change", collectFilterForm);
elements.form?.addEventListener("submit", (event) => {
  event.preventDefault();
  collectFilterForm();
  setFilterPanel(false);
});
const applySearchQuery = (query, { historyMode = "push" } = {}) => {
  const previousQuery = state.q;
  state.q = query;
  state.page = 1;

  // Entering a query from browse mode should surface relevance ranking. Leaving
  // a query restores featured unless the shopper already chose another sort.
  if (state.q && !previousQuery && state.sort === "featured") {
    state.sort = "relevance";
  } else if (!state.q && previousQuery && state.sort === "relevance") {
    state.sort = "featured";
  }

  syncForm();
  render({ historyMode });
};

elements.searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchHistoryPrimed = true;
  applySearchQuery(elements.search.value.trim(), { historyMode: "push" });
});
elements.search?.addEventListener("focus", () => {
  searchHistoryPrimed = false;
});
elements.search?.addEventListener("input", debounce(() => {
  if (!searchHistoryPrimed) {
    window.history.pushState(
      { shopState: state },
      "",
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    searchHistoryPrimed = true;
  }
  applySearchQuery(elements.search.value.trim(), { historyMode: "replace" });
}, 180));
elements.sort?.addEventListener("change", () => {
  state.sort = elements.sort.value;
  state.page = 1;
  render({ historyMode: "push" });
});
elements.loadMore?.addEventListener("click", () => {
  state.page += 1;
  render({ historyMode: "push" });
  const firstNewCard = elements.grid?.children[(state.page - 1) * PAGE_SIZE];
  firstNewCard?.querySelector("a")?.focus();
});
elements.clear?.addEventListener("click", (event) => {
  event.preventDefault();
  clearFilters();
});
elements.grid?.addEventListener("click", (event) => {
  if (event.target.closest("[data-empty-action]")) clearFilters();
});
elements.active?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-filter]");
  if (!button) return;
  const kind = button.dataset.removeFilter;
  const value = button.dataset.filterValue;
  pendingFilterFocusIndex = [...elements.active.querySelectorAll("[data-remove-filter]")]
    .indexOf(button);
  if (kind === "category") state.categories = state.categories.filter((item) => item !== value);
  if (kind === "brand") state.brands = state.brands.filter((item) => item !== value);
  if (kind === "availability") state.availability = "all";
  if (kind === "minPrice" || kind === "maxPrice") state[kind] = "";
  state.page = 1;
  syncForm();
  render({ historyMode: "push" });
});
elements.openFilters?.addEventListener("click", () => setFilterPanel(true));
elements.closeFilters?.addEventListener("click", () => setFilterPanel(false));
elements.backdrop?.addEventListener("click", () => setFilterPanel(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.panel?.classList.contains("filters--open")) setFilterPanel(false);
});
elements.panel?.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || !elements.panel.classList.contains("filters--open")) return;
  const focusable = getFocusableElements(elements.panel);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
desktopQuery.addEventListener("change", (event) => {
  setFilterPanel(false, { restoreFocus: false });
  if (elements.panel) elements.panel.hidden = !event.matches;
});
window.addEventListener("popstate", () => {
  state = getStateFromUrl();
  syncForm();
  render({ historyMode: "replace" });
});

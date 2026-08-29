# Morrow — Vanilla JavaScript Commerce Frontend

Morrow is a complete, responsive commerce storefront built with semantic HTML, layered CSS, and browser-native JavaScript modules. It demonstrates product discovery, variant selection, cart and wishlist persistence, a simulated checkout, and resilient empty/error states without a framework or UI library.

> This repository is a frontend demonstration. It has no production backend, account system, inventory service, order service, or payment processor. Checkout never requests real payment credentials and does not create a real order or shipment.

## Features

- Editorial storefront with featured products, new arrivals, categories, values, journal, and newsletter feedback
- 24-product local catalog with realistic categories, brands, variants, inventory, badges, and specifications
- Case- and diacritic-insensitive search across name, brand, category, description, and tags
- Search suggestions and a shareable catalog URL state
- Composable category, brand, availability, and price filters
- Featured, newest, price, rating, popularity, and name sorting
- Responsive product grid with loading, unavailable, and empty states
- Product gallery, color/size selection, stock-aware quantity, related items, and recently viewed items
- Variant-aware cart that merges identical configurations, requires valid options, and enforces product-wide inventory across variants
- Persistent cart, wishlist, and recently viewed state with malformed-data recovery
- Keyboard-accessible cart drawer with focus return, focus containment, Escape handling, backdrop close, and scroll locking
- Cart totals, complimentary-delivery threshold, and the demonstration promotion code `MORROW10`
- Inline checkout validation with corrective messages and focus on the first invalid field
- Simulated standard/express delivery and payment choices without collecting card credentials
- Session-scoped simulated order confirmation with an illustrative delivery window
- Visible focus styles, semantic landmarks, skip links, live regions, reduced-motion support, and touch-friendly controls

## Technology

- HTML5
- CSS3 (custom properties, Grid, Flexbox, container-aware responsive layouts, media queries)
- Vanilla JavaScript ES6 modules
- Browser APIs: URLSearchParams, History, localStorage, sessionStorage, Intl, FormData, CustomEvent

There are no runtime dependencies, build tools, frameworks, third-party components, or API keys.

## Run locally

ES modules require an HTTP origin. From the project directory, start any static server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

Opening the HTML directly with a `file://` URL may be blocked by browser module security rules and is not supported.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Editorial storefront and discovery entry points |
| `shop.html` | Searchable, filterable, sortable catalog with URL state |
| `product.html?id=prod-001` | Product details, variants, quantity, gallery, related and recent products |
| `cart.html` | Full cart management, totals, delivery threshold, promotion |
| `wishlist.html` | Saved products and move-to-cart flow |
| `checkout.html` | Validated, frontend-only simulated checkout |
| `order-success.html` | Explicitly simulated order confirmation and summary |

## Architecture

```text
.
├── assets/
│   └── images/
│       ├── products/           # Local catalog sample photography
│       ├── editorial/          # Homepage hero, category, and journal photos
│       └── product-placeholder.svg
├── css/
│   ├── tokens.css              # Color, type, space, radii, shadows, motion
│   ├── reset.css               # Browser normalization
│   ├── base.css                # Document defaults and typography
│   ├── layout.css              # Page-level layout primitives
│   ├── components.css          # Reusable UI components and states
│   ├── utilities.css           # Focused one-purpose helpers
│   └── responsive.css          # Breakpoint-specific adaptations
└── js/
    ├── data/products.js        # Immutable local catalog
    ├── services/product-service.js
    ├── storage.js              # Versioned, guarded persistence boundary
    ├── cart.js                 # Variant-aware cart domain logic
    ├── wishlist.js             # Wishlist domain logic
    ├── search.js               # Normalization and relevance ranking
    ├── filters.js              # Pure search/filter/sort pipeline + URL helpers
    ├── order.js                # Shared totals, delivery, and demo promotion rules
    ├── ui.js                   # Reusable rendering and global interactions
    ├── app.js                  # Shared application bootstrap
    └── pages/                  # Page-specific controllers
```

The catalog is accessed through `getProducts()` and `getProductById()` rather than imported into every interface. That boundary can later be replaced by a REST or GraphQL adapter while retaining the page controllers and rendering layer.

State flows in one direction:

```text
catalog + URL/persisted state
→ normalized domain operations
→ derived view model/totals
→ DOM rendering
→ user event
→ validated state update
→ targeted rerender
```

## Design system relationship

No inspectable Figma file, URL, variable export, or asset package was included with the supplied brief. The project therefore defines a restrained Morrow design language from the brief’s direction—premium, warm, minimal, trustworthy—and records it in `css/tokens.css` as the single source for color, typography, spacing, radius, elevation, focus, and motion decisions.

If a Figma source is supplied later, its variables can be reconciled at the token layer first. Component and layout selectors are already separated so visual alignment does not require rewriting commerce behavior.

## Product model

Every catalog record includes:

```text
id, slug, name, brand, category, price, originalPrice,
rating, reviewCount, stock, featured, isNew, popularity,
badge, createdAt, images, colors, sizes, tags,
description, specifications
```

Images are stored locally under `assets/images/products/` and `assets/images/editorial/`, with `product-placeholder.svg` as a resilient fallback if a file is missing. The storefront no longer depends on a remote image host for catalog or homepage photography.

## Persistence

`js/storage.js` wraps localStorage in a versioned envelope, validates data before use, drops malformed records, and falls back to in-memory storage if localStorage is unavailable.

| Logical key | Stored value |
| --- | --- |
| `ecommerce:v1:cart` | Product ID, quantity, selected options, stable variant key |
| `ecommerce:v1:wishlist` | Valid product IDs |
| `ecommerce:v1:recently-viewed` | Bounded list of recent product IDs |
| `ecommerce:v1:last-order` (sessionStorage) | Last simulated order summary and shipping details for the current tab only |

The applied demonstration promotion and order confirmation are kept in sessionStorage. Shipping details therefore disappear when the tab closes instead of persisting indefinitely in localStorage. Passwords and payment credentials are never requested or stored.

## Verification

Syntax-check all JavaScript modules:

```bash
find js -name '*.js' -exec node --check {} \;
```

Run the dependency-free domain test suite:

```bash
node --test tests/*.test.mjs
```

Recommended manual paths:

1. Search for a product, combine filters, change sorting, reload, and use browser history.
2. Open a product, select every required option, change the gallery and quantity, and add it twice.
3. Confirm identical variants merge while different variants remain separate.
4. Change quantities, remove an item, apply `MORROW10`, and reload the cart.
5. Save and remove wishlist items and use “Move to bag.”
6. Submit checkout empty, correct each validation message, and complete the simulated order.
7. Verify the confirmation clearly says no real order/payment/shipment was created.
8. Repeat the core path with keyboard only at mobile, tablet, and desktop widths.

## Current limitations

- Products, inventory, reviews, and recommendations are local demonstration data.
- Search and filtering are client-side and intended for a modest catalog.
- There is no authentication, server reconciliation, tax engine, address verification, fraud handling, analytics, or cross-device state.
- Multi-tab localStorage changes are not merged transactionally.
- Delivery dates, discounts, confirmation references, and payment choices are illustrative.
- Sample photography is illustrative demonstration media, not licensed product packaging from the named brands.
- WCAG 2.2 AA considerations are implemented, but formal certification requires assistive-technology and contrast testing in the final deployment environment.

## Future improvements

- Replace the product service with a real inventory/catalog API.
- Add an authenticated server cart with conflict-aware multi-device synchronization.
- Connect a compliant hosted payment flow; never handle raw card credentials in this frontend.
- Add server-validated promotions, tax, address, order, email, and fulfillment services.
- Add automated DOM, accessibility, visual-regression, and end-to-end test suites.
- Reconcile the token layer and component states against the actual Figma library when supplied.

# Morrow — Enterprise-inspired Vanilla JavaScript commerce platform

Morrow is an **enterprise-inspired Vanilla JavaScript e-commerce platform built entirely with browser technologies.** It applies software engineering patterns used in larger commerce systems—modules, repositories, services, state machines, RBAC structure, analytics events, and audit logs—while remaining a **browser-based simulation**.

> This repository is not a production commerce backend. It has no trusted server, no real payment processor, and no production-grade authentication or authorization. Checkout never collects card numbers. Roles and permissions are enforced in client-side application logic only; anyone with browser tools can inspect or alter local data.

## Technology

- HTML5, CSS3, Vanilla JavaScript ES6 modules
- IndexedDB (`MorrowDB`, versioned migrations)
- localStorage / sessionStorage for guest cart, session, and UI preferences
- Native browser APIs only (no frameworks, no Node runtime for the storefront)

## Architecture

```text
Pages → Components → Services → Repositories → IndexedDB
```

- **Pages** render and bind events.
- **Services** own business rules (cart, checkout, pricing, inventory, coupons, orders, recommendations, analytics).
- **Repositories** are the only modules that talk to IndexedDB.
- **EventBus** and a small **app state** object coordinate cross-cutting UI updates.
- Existing storefront modules (`cart.js`, `wishlist.js`, `search.js`, `filters.js`) remain the public APIs used by pages and tests.

## Run locally

ES modules require an HTTP origin:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/`.

## Demonstration accounts

These accounts are seeded into IndexedDB on first load. Password for all of them: `MorrowDemo!1`

| Email | Role |
| --- | --- |
| customer@morrow.demo | Customer |
| support@morrow.demo | Support agent |
| inventory@morrow.demo | Inventory manager |
| manager@morrow.demo | Store manager |
| admin@morrow.demo | Administrator |
| super@morrow.demo | Super admin |

This is demonstration identity storage (salted SHA-256 in the browser). It is not secure production authentication.

Promotion codes: `MORROW10` (10%), `SAVE25` ($25 off $150), `HOME15` (Home category). `EXPIRED10` and `ONCEONLY` exist to exercise rejection rules.

## Pages

Storefront: `index.html`, `shop.html`, `product.html`, `cart.html`, `wishlist.html`, `checkout.html`, `order-success.html`, `account.html`, `compare.html`, `orders.html`

Admin sign-in: `admin/login.html` (operations accounts only, with a role-aware return destination).

Admin (role-gated in application logic): `admin/dashboard.html`, `products.html`, `categories.html`, `inventory.html`, `orders.html`, `customers.html`, `reviews.html`, `coupons.html`, `analytics.html`, `audit-logs.html`, `settings.html`

## What is real vs simulated

| Capability | In this project |
| --- | --- |
| Catalog, search, filters, sort, pagination | Real client-side logic over a 1,024-product seeded catalog |
| Cart, wishlist, comparison, recently viewed | Persisted in this browser |
| Pricing, tax, shipping, coupons | Central `PricingService` / coupon validators (illustrative tax, not a tax engine) |
| Checkout & orders | Stepped wizard (contact → shipping → delivery → payment → review → confirmation). Simulated payments; orders stored in IndexedDB with a finite state machine |
| Inventory | onHand − reserved invariant; checkout commits the sale and history atomically, with admin adjustments and customer cancellation restock |
| Analytics dashboards | Calculated from stored events and orders, not hard-coded KPI widgets |
| Recommendations | Weighted heuristics (category, brand, browsing, wishlist, purchase, rating, popularity, price) — not machine learning |
| RBAC | Central permission map checked in services; not production authorization |
| Auth / payments / PII protection | Demonstration only |

## Tests

```bash
find js -name '*.js' -exec node --check {} \;
node --test tests/*.test.mjs
```

Browser runner: `tests/index.html` (also via the local HTTP server).

The current local verification run passes 54 Node tests, JavaScript syntax checks, relative-import checks and a 12/12 browser regression suite. See [`docs/engineering-log.md`](docs/engineering-log.md) for phase evidence and known demonstration limits.


## UI and authentication verification

The dedicated admin portal and customer sign-in share accessible validation, password visibility and submission handling. Admin sessions remain tab-scoped browser demonstrations; no persistent sign-in or email password recovery is implemented.

See [`docs/ui-ux-report.md`](docs/ui-ux-report.md) for the prioritized audit, exact files changed, responsive/accessibility evidence, optional isolated browser regression commands and remaining limits. No frontend dependencies were added.

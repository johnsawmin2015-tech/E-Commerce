# Morrow engineering record

## Audit baseline — 12 September 2026

The existing dirty worktree is an in-progress enterprise expansion of the original seven-page storefront. Preserve its 20 existing pages plus the new categories operations route, local photography, public DOM contracts, cart variant keys, storage namespace, and browser-only stack. Baseline: 44 logic/static tests pass; syntax checks pass; homepage renders with an existing one-item bag. No source changes were made before the whole-project audit.

Specialist findings: Platform Architect approved a synchronous, transaction-scoped atomic repository API; Commerce identified checkout/stock/coupon and order ownership gaps; Experience identified invisible mobile utilities, clipped admin tables, incomplete account/admin flows; Intelligence identified synthetic analytics and misleading recommendation aliases. Quality independently challenges acceptance gates. Agent concurrency is limited, so specialist work is scheduled in bounded rounds.

Principal risks: seed replay overwrites edited records when catalog count drops; multi-store checkout and cancellation can partially commit; service permissions are missing; guests can see unrelated guest orders; variants ignore overrides; state is stale; zero-review products retain hard-coded ratings; seeded events inflate metrics; browser persistence failures are silently treated as success.

## Architectural rules

Pages/components call services. Services own validation, permissions and domain operations. Repositories own persistence; only the database adapter uses IndexedDB. Pure domain modules have no DOM or storage dependencies. Core composes modules and the event bus communicates changes. Legacy entrypoints remain compatibility adapters. No application backend or framework is introduced.

Atomic operations read current records, validate and stage changes within one native IndexedDB readwrite transaction. The callback is synchronous and must not await network, timers, hashing or unrelated work. Cache/state updates and UI events occur only after commit. The memory adapter clones records and serializes equivalent operations for portable tests.

## Phase 1 — foundation

Objective: preserve working surfaces while correcting module contracts, state notifications and startup failures. Affected: core state/app, cart/wishlist event adapters, repository alias, this log. Risk: legacy listeners. Acceptance: existing tests/imports pass, state updates reach subscribers, homepage reload remains usable. Implementation: repaired product repository alias; cloned state snapshots, isolated subscriber failures, notified reset; cart/wishlist update shared state outside browser-only event guards; startup failure remains visible and does not report ready. Verification: 48 Node tests, syntax checks, static import checks and clean-origin homepage reload pass without console errors.

## Phase gate matrix

2. Data: atomic adapter, additive migration, seed preservation, primary structured persistence; verify rollback and reload.
3. Catalog: validated product/variant/category service, all-record admin browsing, search/filter/sort; verify 1,024-product performance and combined filters.
4. Customer commerce: primary saved collections, variant pricing/availability, comparison and real-behavior recommendations; verify persistence and stock caps.
5. Checkout/orders: atomic checkout, centralized pricing/coupons, guest ownership, immutable snapshots and state machine; verify invalid inputs, duplicate submission and cancellation/returns.
6. Inventory: strict stock invariants, reservation ownership, history and adjustments; verify concurrency, rollback and release.
7. Users/RBAC: service permissions against current records, validation, profile/addresses/preferences; verify allowed/denied/stale role cases.
8. Admin: working CRUD/categories/coupons/settings, pagination, audit and accessible tables; verify persisted changes and denied actions.
9. Intelligence: fixture isolation, event/session correctness, real aggregates and behavior recommendations; verify empty and populated metrics.
10. Hardening: native browser tests, regression/performance/responsive/keyboard checks and accurate documentation. No acceptance claim until evidence is recorded.

## Phase 2 — data layer

Objective: make browser persistence transactional and preserve user records during upgrades. Affected: database adapter, migration v4, repositories, seed, config, database tests. Features completed: synchronous atomic units of work with native readwrite transactions and serialized cloned memory fallback; blocked/version-change handling; additive indexes; first-run seed data marked as fixtures and never replayed over existing rows; persisted catalog ratings start at zero and derive from approved reviews. Tests: 48 Node tests pass, including rollback, detached reads, concurrent stock units, seed replay after deletion/edit and relative-import resolution. Browser runner now covers pricing, shipping/tax, coupons, inventory boundaries, transitions, RBAC and analytics. Phase acceptance passes for the implemented data contract; IndexedDB reload persistence remains a browser-only manual gate and is verified in the current local preview after v4 migration without console errors.

## Phase 3 — catalog and admin browsing

Objective: make the full catalog and inventory browsable without truncation. Files: `js/services/product-service.js`, `js/components/pagination.js`, `js/pages/admin/products.js`, `js/pages/admin/inventory.js`, `js/services/categoryService.js`, `js/pages/admin/categories.js`. Architecture: page controllers render service-owned records; repositories remain the persistence boundary. Risk: pagination could hide records or break row actions. Acceptance: all 1,024 records are reachable in 50-row pages, imports resolve, and admin tables remain accessible. The catalog service owns the hydrated extended catalog, variant records, status visibility and permission-checked product writes. Inventory tables include a caption, page controls and persisted adjustment history. Browser evidence: an administrator session rendered page 1 of 21 with no console warnings on a clean local origin.

## Phase 4 — customer commerce and recommendations

Objective: preserve customer choices and make recommendations evidence-based. Files: `js/cart.js`, `js/wishlist.js`, `js/features/comparison/`, `js/pages/account.js`, `js/services/recommendationService.js`. Architecture: variant-aware cart identity and state events feed service-level recommendation signals. Risk: legacy item keys and empty histories must remain compatible. Acceptance: selected variants/overrides persist, invalid options are rejected, and empty behavior produces an explicit fallback. Recommendation signals are derived from non-fixture views, cart additions, purchases and real co-view/co-purchase pairs; catalog popularity is not treated as behavior.

## Phase 5/6 — checkout, orders and inventory

Objective: make checkout and fulfillment atomic and owner-safe. Files: `js/services/checkoutService.js`, `js/services/orderService.js`, `js/services/inventoryService.js`, `js/domain/inventory.js`, `js/domain/orderMachine.js`. Architecture: one synchronous multi-store transaction commits the order snapshot, coupon usage, inventory, product stock, history and audit entry. Risk: duplicate submissions and fixture orders could corrupt stock. Acceptance: idempotency keys reject duplicates, cancellation restocks only committed sales, customer requests are owner-scoped, invalid quantities fail, and admin transitions require permission. The order service checks owner-or-operations permission for reads and references.

## Phase 7/8 — users, permissions and operations

Objective: enforce role boundaries in application logic and complete operations CRUD. Files: `js/services/authService.js`, `js/services/product-service.js`, `js/services/inventoryService.js`, `js/services/reviewService.js`, `js/services/couponService.js`, `js/services/analyticsService.js`, `js/services/categoryService.js`, `js/services/orderService.js`, and admin/account controllers. Architecture: UI guards are advisory; service methods validate permissions and current stored records. Risk: stale sessions and direct page calls could bypass UI checks. Acceptance: session roles reconcile, denied callers fail, categories support validated create/edit/remove (removal is blocked while referenced), coupons have service-backed create/pause/activate actions with audit records, and addresses support default/removal without stripping credentials.

## Phase 9 — intelligence integrity

Objective: separate demonstration fixtures from operational intelligence. Files: `js/data/seed.js`, `js/services/analyticsService.js`, `js/domain/analytics.js`, `js/services/recommendationService.js`, `js/services/reviewService.js`. Architecture: metrics and signals consume stored non-fixture events/orders, while approved-review aggregation is the source of product ratings. Risk: seeded rows or duplicate event types could inflate KPIs. Acceptance: fixture rows are excluded, purchase revenue is not double-counted, conversion uses distinct purchasing sessions, ratings reset to zero with no approved reviews, and zero-data dashboards are explicit.

## Phase 10 — verification and limits

Objective: make claims traceable to repeatable gates. Files: `tests/*.test.mjs`, `tests/index.html`, `tests/static-markup.test.mjs`, this log. Architecture: Node domain tests and a native-browser runner complement one another; neither implies a trusted backend. Risk: passing unit tests can miss cross-service or visual failures. Acceptance: 48 Node tests pass; all JavaScript files pass `node --check`; `git diff --check` passes; browser runner reports 12/12; clean-origin homepage, account, orders, admin products, categories, inventory, coupons and analytics routes rendered without console errors. Authentication, RBAC, payments, analytics and persistence remain browser-device demonstrations; no backend, deployment or production security claim is made.

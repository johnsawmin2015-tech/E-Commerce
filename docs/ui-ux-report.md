# Morrow UI/UX refinement and admin login report

Verified locally on 13 September 2026. The application remains HTML5, CSS3 and vanilla JavaScript ES modules. No frontend framework, icon library, backend, deployment, or data reset was introduced. The starting worktree was already extensively modified; this work builds on that state without reverting it.

## 1. Issues found, in priority order

| Priority | Finding and root cause |
| --- | --- |
| P0 | Product controls were intercepted by `closest("[data-page]")`, which matched the body. Product submissions also checked `form.id`, shadowed by an input named `id`, and could fall through to a native GET request. |
| P0 | Authentication published a successful session even when sessionStorage could not save it. Session validation accepted incomplete expiry data and did not clear deleted-user sessions. |
| P1 | Admin guards led to the generic customer account page; restricted operations roles could be sent to an overview they could not access. There was no dedicated admin login, direct sign-out, or live expiry handling. |
| P1 | Expanded desktop navigation collided with branding/search. Populated cart grids widened small screens. Inventory labels escaped their table's scrolling region. |
| P1 | Customer forms lacked inline errors, password controls and duplicate-submit protection. Several admin writes had unhandled failure paths; account navigation remained stale after login/logout. |
| P1 | The cart accepted only MORROW10 although the coupon service supported other codes. Restricted coupon totals multiplied already-totalled lines by quantity again. |
| P1 | A single selected comparison product could not be removed on its comparison page. Checkout Enter tried to validate future, hidden steps. |
| P2 | Admin forms, tables, actions and spacing were inconsistent. The account page repeated demo credentials prominently. Missing-product state retained a busy marker. |
| P3 | Focus visibility, search-suggestion keyboard navigation and access-help wording needed refinement. Newsletter feedback implied a real subscription despite having no delivery service. |

## 2. Issues fixed

Product editing and saving now reach their intended handlers and persist records. Controls recover after failed operations and prevent repeated mutations. Cart layouts stay within small viewports, table content scrolls within named regions, and the full header allocates a separate search row at intermediate desktop widths.

Cart pricing now uses the same checkout quote service as checkout. It supports validated active codes, shows rejection messages beside the field, allows removal, and uses selected variant prices. Restricted discounts use each line total once. The legacy synchronous pricing API remains available to its existing consumers.

The comparison page keeps a lone product visible and removable. Checkout Enter advances the current step, while final submission has an explicit in-flight guard. Missing-product feedback clears its loading state. Search suggestions support arrow-key navigation after focus moves into their links. Newsletter feedback accurately describes its preview behavior.

## 3. Admin login improvements

`admin/login.html` is a new, dedicated Morrow portal: restrained split layout on desktop, one form card on mobile, existing warm neutral/clay palette, system branding, and a 440px maximum card column. Email/password labels, autocomplete, field-level validation, an accessible show/hide control, visible focus, a CSS loading indicator and an error summary share a reusable form controller with customer authentication.

The service verifies credentials and operations access before saving an admin session. Successful sign-in returns only to known local routes allowed by the role; otherwise it uses that role's first permitted screen. Invalid credentials are generic. Session-storage failures remain failures. Expired, incomplete and deleted-user sessions are rejected. Guards keep workspace content hidden until initialization and checks finish; logout, expiry, visibility restoration and browser back navigation recheck access.

The help disclosure explains the actual local demo setup and lack of password-recovery service. No persistent “Remember me” behavior, email reset, trusted server authentication, or new administrator credential was fabricated.

## 4. HTML and accessibility improvements

- Dedicated semantic authentication page, heading/section labels and skip link.
- Explicit labels, autocomplete and error associations on sign-in and registration fields.
- Proper password-toggle buttons, alerts/status text and validation focus.
- Scoped column headers, labels for role controls, and named keyboard-scrollable admin/comparison table regions.
- Responsive native disclosure for admin navigation and clear sign-out/account/store controls.
- Existing storefront landmarks, IDs, navigation and commerce DOM contracts retained.

## 5. CSS improvements

The existing token system was already comprehensive and was retained. `auth.css` owns authentication layouts and shared form presentation. `admin.css` was consolidated into operations layout, surfaces, tables, controls, access states and responsive rules. The old whole-page admin overflow patch was removed.

The live header now has space for dynamic links. Cart/checkout grids use a shrinkable single-column minimum. Focus outlines remain visible; primary form controls use approximately 44–48px targets. Loading motion respects reduced-motion settings. The application has no working dark-mode switch; its existing light theme and inverse navigation surfaces were verified.

## 6. JavaScript improvements

- `authForm.js`: one validation, password-toggle and asynchronous submission lifecycle.
- `asyncAction.js`: shared mutation guarding and error recovery.
- `adminRoutes.js`: a single permission-aware local destination allowlist.
- Authentication/storage: valid expiring sessions, failed-write handling and deleted-user cleanup.
- Admin shell: startup visibility gate, role-aware links, logout and session rechecks.
- Correct button-specific pagination selectors and form matching that cannot be shadowed by an input name.
- Global UI initialization guard and navigation refresh on auth events.
- Shared quote service for cart promotions, stale-render protection, and corrected restricted-discount arithmetic.

## 7. Files modified or added in this task

The following list is compared with the captured starting file hashes, not with Git HEAD, so it excludes unrelated pre-existing changes.

- `account.html`
- `admin/analytics.html`
- `admin/audit-logs.html`
- `admin/categories.html`
- `admin/coupons.html`
- `admin/customers.html`
- `admin/dashboard.html`
- `admin/inventory.html`
- `admin/login.html`
- `admin/orders.html`
- `admin/products.html`
- `admin/reviews.html`
- `admin/settings.html`
- `compare.html`
- `css/admin.css`
- `css/auth.css`
- `css/base.css`
- `css/components.css`
- `css/layout.css`
- `css/responsive.css`
- `js/components/asyncAction.js`
- `js/components/authForm.js`
- `js/domain/adminRoutes.js`
- `js/order.js`
- `js/pages/account.js`
- `js/pages/admin/audit-logs.js`
- `js/pages/admin/categories.js`
- `js/pages/admin/coupons.js`
- `js/pages/admin/customers.js`
- `js/pages/admin/inventory.js`
- `js/pages/admin/login.js`
- `js/pages/admin/orders.js`
- `js/pages/admin/products.js`
- `js/pages/admin/reviews.js`
- `js/pages/admin/settings.js`
- `js/pages/admin/shell.js`
- `js/pages/cart-page.js`
- `js/pages/checkout-page.js`
- `js/pages/compare.js`
- `js/pages/product.js`
- `js/services/authService.js`
- `js/services/couponService.js`
- `js/storage.js`
- `js/ui.js`
- `orders.html`
- `tests/auth.test.mjs`
- `tests/browser/commerce.mjs`
- `tests/browser/flows.mjs`
- `tests/browser/layout.mjs`
- `tests/browser/runtime.mjs`
- `tests/browser/states.mjs`
- `tests/coupon.test.mjs`
- `tests/index.html`
- `README.md` — current login and verification documentation.
- `docs/ui-ux-report.md` — this report.

## 8. Regression verification

- **54/54 Node tests passed**, including new failure-path session, role/destination and multi-quantity coupon cases.
- **All application JavaScript syntax checks passed.** Relative module imports, local HTML targets, required landmarks and static ID uniqueness are included in the Node suite.
- **Git whitespace/error check passed.** Existing uncommitted work was retained.
- **12/12 native browser domain tests passed.**
- **22 route/state cases × 11 widths passed** layout checks: 320, 375, 390, 430, 768, 1024, 1117, 1279, 1280, 1440 and 1920px. This includes every existing storefront/admin route plus missing-product state.
- **7 additional states × 9 widths passed:** admin login, signed-out customer account, populated cart/wishlist/comparison, checkout contact and checkout validation errors. The two extra header boundary widths are covered by the route matrix.
- **Automated accessibility scans reported zero WCAG A/AA violations in checked states:** the route matrix plus small/large additional-state scans and flow checks. These results complement the keyboard checks; they are not a full accessibility certification.
- **28 flow checks and 8 commerce checks passed:** invalid/empty/non-admin login, password visibility, Enter, observable loading, repeat-submit guard, return routes, restricted roles, expiry, logout/back, customer registration/login, addresses across reload, navigation, comparison, cart drawer, full checkout/confirmation/cancellation, product/category persistence, inventory error recovery, search/sort/filters, promotion consistency, coupon create/pause/activate and pagination.
- Reduced motion, keyboard focus order, mobile navigation Escape/focus restoration and blocked-session-storage recovery were also exercised.
- No browser console errors or unhandled exceptions occurred in the final regression runs.

Browser tests use isolated Chrome contexts and synthetic demonstration records. They do not clear the user's normal browser profile. Playwright and axe are optional external QA tools; no runtime dependencies were added to the storefront.

### Reproduce

Serve the project on a local HTTP origin:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Run the built-in checks:

```sh
node --test tests/*.test.mjs
find js -name '*.js' -exec node --check {} \;
git diff --check
```

For the optional browser suites, install the QA tools outside the storefront and use installed Google Chrome:

```sh
npm install --prefix /tmp/morrow-qa-tools playwright axe-core
export MORROW_QA_MODULES=/tmp/morrow-qa-tools/node_modules
export MORROW_QA_URL=http://127.0.0.1:8765
node tests/browser/layout.mjs
node tests/browser/flows.mjs
node tests/browser/states.mjs
node tests/browser/commerce.mjs
```

Screenshots and JSON reports default to the system temporary directory under `morrow-ui-qa`. Set `MORROW_QA_OUTPUT` to choose a different directory. Application modules never import these browser test tools.

## 9. Remaining issues and boundaries

Authentication, role checks, payments and persistence are still a browser-only demonstration. A trusted backend is required for real administrator authorization, secure sessions, rate limiting, account recovery and real commerce. Existing seeded credentials and browser hashing remain isolated in the demo setup; client-side code cannot make them production-secure.

There is no implemented dark-mode toggle to preserve. Verification used desktop Chrome, including viewport resizing; physical mobile devices, Safari/Firefox and a full assistive-technology audit were not tested. This UI pass does not establish multi-user production readiness or certify every pre-existing business service. No site was deployed, and no Git commit or publication was made.

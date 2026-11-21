# EveryNest — Level 1 decisions and setup notes

This file records decisions that future levels must not contradict.

## environment and tooling

| Item | Value |
|---|---|
| Node.js | v24.17.0 |
| npm | 11.13.0 |
| Next.js | 16.4.6 (App Router, `src/` directory) |
| React | 19.3.0 |
| TypeScript | strict mode, `@/*` → `src/*` |
| Tailwind CSS | v4 (via `@tailwindcss/turbopack`) |
| Database | Supabase PostgreSQL + RLS |
| Package manager | npm (`package-lock.json` is the lockfile) |

## Docker / Supabase local availability

**Docker is not installed on this machine.** A local Supabase stack cannot be
started, so migrations are applied to the **development cloud project**
(`zabi-store-dev`). The workflow is:

1. `npm run db:push:dry` — review the migrations that would be applied.
2. `npm run db:push` — apply them (never resets or deletes the remote database).
3. `npm run db:checks` — 24 read-only catalog checks (`supabase db query --remote
   --read-only`). No Docker, no confirmation prompt.
4. `npm run db:test` — pgTAP, **requires Docker** (runs `pg_prove` in a container).
5. `npm run db:types` — regenerate `src/types/database.types.ts`.

Because pgTAP cannot run here, behaviour is covered instead by:

- `npm run db:checks` — grants, RLS flags, triggers, policies, Storage bucket;
- `npm run test:smoke` — black-box checks through PostgREST with the public key.

On `zabi-store-dev`: **24/24 catalog checks PASS**, **9/9 smoke checks PASS**.

`src/types/database.types.ts` is now **generated** from the live database and
must not be hand-edited.

## Applied to zabi-store-dev

| Item | Value |
|---|---|
| Project ref | `bnmvzfeatuewmwuqfdnc` |
| Org | `zabi-dev` |
| Region | Southeast Asia (Singapore) |
| Postgres | 17.12 |
| Migrations applied | 11 / 11 (2026-11-17) |
| Seed data | development seed applied 2026-11-20 (6 categories, 6 products, 13 variants, 2 suppliers, 11 stock movements) |

Note: there is a second project named `zabi-store-dev` (ref
`nvdwoihhksmqezzebube`, Tokyo) under a different Supabase account. It is **not**
linked to this repository; do not push to it by accident.

## SQL validated without a server

Every migration file was parsed with PostgreSQL's own grammar (`libpg-query`,
PG 18) and every `language plpgsql` function body was compiled with
`parsePlPgSQL` before the first push. That catches syntax errors, not behaviour.

Behaviour is verified on the hosted database in two layers:

- catalog checks (`supabase/tests/level1_catalog_checks.sql`) for grants, RLS
  flags, triggers, policies and the Storage bucket;
- black-box checks (`npm run test:smoke`) through PostgREST with the public key.

The pgTAP suite remains for local Docker runs and for CI once Docker is
available.

Function privileges are checked **when the trigger is created**, not when it
fires (PostgreSQL `CREATE TRIGGER` docs), so revoking `EXECUTE` from `PUBLIC` on
trigger functions is safe even though the triggers still fire.

`alter default privileges ... revoke execute on functions from public` is applied
to both `private` and `public`, so any future function must receive an explicit
grant. New helper functions are therefore **not** callable from the browser by
accident.

## execution-context assumptions (stock and role protection)

The strongest database protections depend on PostgreSQL execution context:

- Migrations are expected to run as the `postgres` role, so `SECURITY DEFINER`
  functions are owned by `postgres`.
- Inside a `SECURITY DEFINER` function, `current_user` is the function owner.
- Inside `SECURITY INVOKER` code (triggers, ordinary queries), `current_user`
  is the API role (`anon` / `authenticated`).
- `private.guard_variant_stock()` and `private.guard_profile_role()` are
  **SECURITY INVOKER on purpose**. If they were definer functions, the checks
  would always see the owner role and would be meaningless.
- `private.apply_stock_movement()` is SECURITY DEFINER, so its stock update runs
  as `postgres` and passes the guard trigger.
- If a project applies migrations as `supabase_admin` instead of `postgres`,
  add `supabase_admin` to the trusted role lists — it is already included in the
  guards.

These assumptions are verified by the hosted catalog checks and by
`npm run test:smoke` (anonymous access). A real staff/admin session test belongs
to Level 3, when the admin panel exists.

## Proxy scope

`src/proxy.ts` refreshes the Supabase session only for `/admin/*` and
`/account/*`. Level 1 has no protected pages yet; Level 3 adds the redirect
logic and the server-side admin guard. The proxy is never the only
authorization layer.

## Storage

- Bucket name: `product-images` (public read).
- Allowed types: JPEG, PNG, WebP. SVG is rejected.
- Upload limit: 5 MiB.
- Write/update/delete is staff-only through Storage RLS policies.
- `next.config.ts` restricts `next/image` to the exact Supabase host from
  `NEXT_PUBLIC_SUPABASE_URL` and the `/storage/v1/object/public/**` path.

## Money

- All amounts are integer paisa. `1 rupee = 100 paisa`.
- `bigint` is used for future order totals (Level 8); JavaScript values must be
  handled as `bigint` or validated decimal strings.
- Helpers live in `src/lib/money.ts` and are unit-tested.

## What Level 1 intentionally does not include

- No authentication UI (Level 2).
- No admin shell (Level 3).
- No storefront or catalogue UI (Levels 4–7).
- No order tables (Level 8).

## First admin bootstrap (manual, trusted)

1. Create the user through Supabase Auth (signup or Dashboard → Authentication).
2. The signup trigger creates a `profiles` row with role `customer`.
3. In the Supabase Dashboard SQL editor (database-owner context), run:

   ```sql
   update public.profiles
      set role = 'admin'
    where id = (select id from auth.users where email = 'owner@example.com');
   ```

4. Verify:

   ```sql
   select id, role from public.profiles where role = 'admin';
   ```

The role change is audited with a `null` actor because there is no authenticated
application session in the SQL editor. This is a documented limitation.

Never accept an admin role from signup metadata, forms, query parameters or
client code.

## Level 2 — authentication decisions

- Sessions are cookie-based (`@supabase/ssr`). Server Actions call the server
  client; no token is stored in `localStorage` and no auth logic runs in the
  browser bundle.
- Every protected page and action calls `auth.getUser()`, which validates the
  token with Supabase Auth. `getSession()` is never used for authorization.
- `/account` has three independent layers: the proxy redirects signed-out
  visitors (UX), `requireUser()` re-checks in the page, and PostgreSQL RLS plus
  column grants enforce access on the data itself.
- Customers may change `full_name` and `phone` only. The Level 1 grant
  `update (full_name, phone)` and the `profiles_update_own` policy still decide
  this; `role` is not granted to any application role.
- Profile creation remains in the Level 1 trigger. Signup metadata carries a
  display name and phone only — never a role.
- **Level 2 adds no migrations.** The Level 1 schema already supported the whole
  feature, so no schema churn was introduced.
- `instant = false` is set on the routes that read cookies. This project enables
  Next 16 `cacheComponents`, so such routes must opt out of the instant static
  shell (`dynamic = "force-dynamic"` is not the switch in this version).
- Form actions echo the submitted values back (never passwords) so React 19's
  automatic form reset does not wipe the form after a validation error.
- Open-redirect defence: `safeNextPath()` accepts only same-site relative paths,
  rejecting `//host`, absolute URLs and backslash tricks.
- Auth errors are mapped to fixed messages, so provider wording and internal
  details never reach the browser. Signup responses do not reveal whether an
  email is already registered.

### email confirmation

- `emailRedirectTo` must be allow-listed in the Supabase project. Configure
  Site URL `http://localhost:3000` and Redirect URL
  `http://localhost:3000/auth/callback`, otherwise the confirmation link lands
  on the home page and no session is created.
- `/auth/callback` exchanges the PKCE `code` for a session server-side and
  redirects to a validated `next` path.
- Development convenience: turning **Confirm email** off makes signup immediate.
  Production should keep it on with a real SMTP provider (the built-in sender is
  rate limited).

## Level 3 — admin shell decisions

- **No migrations.** Roles, staff RLS policies and the `profiles.role` constraint
  already existed in Level 1. Level 3 is application code plus one proxy matcher.
- **The role is read from the database on every admin request.** `requireStaff()`
  calls `auth.getUser()` and then selects the caller's own `profiles` row. It
  never parses a role from a cookie, JWT claim, query string or form field.
- **`requireStaff()` is the single guard.** The admin layout calls it before any
  child renders, and every Level 4+ admin Server Action must call it again. A
  layout check alone does not protect an action endpoint.
- **`proxy.ts` is UX only.** Its matcher now includes `/admin/:path*` and
  redirects signed-out visitors to `/login?next=%2Fadmin`. It deliberately does
  not query the database for a role on every request.
- **Denied customers go to `/account?notice=staff-only`.** A dedicated 403 page
  would add a route with no other purpose; the account banner is friendlier and
  leaks nothing.
- **Unbuilt sidebar items are disabled rows, not links.** each shows its roadmap
  level (`L4`, `L5`, ...) so the shell never produces a 404 and the owner can see
  the plan. `nav-items.test.ts` enforces the required order.
- **React `cache()` dedupes auth/profile reads** across a layout and its page in
  the same render, so the admin dashboard does not repeat the Auth call.
- **No dashboard statistics.** AGENTS.md forbids invented business data. Orders
  arrive in Level 8 and reports in Level 10, so the Level 3 dashboard shows
  access status and build progress only.
- **Admin pages are `noindex`** and excluded from search results.
- **Layout detail that bit once:** the desktop sidebar must keep `flex-col` even
  when the mobile drawer is closed; `lg:flex` alone lays the sections out in a
  row and hides the navigation.

## Level 4 — category management decisions

- **No new tables.** Level 1 already created `categories`, its cycle-prevention
  trigger, staff RLS policies and column grants. Level 4 adds one migration with
  two trigger functions: schema-shape validation and safe-change enforcement.
- **`required` is an explicit schema field and defaults to `true`.** Level 1 seed
  schemas have no `required` key; treating a missing flag as required preserves
  their original meaning without rewriting seed data.
- **Options are stored normalized but labelled for humans.** Keys are lowercase
  `[a-z][a-z0-9_]*`; options are trimmed and case-insensitively unique. Labels
  are display-only (`size` → "Size").
- **Inheritance is root-first.** A child may add attributes and extend inherited
  option lists. It may loosen a required attribute, but it cannot tighten an
  optional one or remove inherited keys/options — those would invalidate
  variants created against the parent schema.
- **Once variants exist, edits are append-only.** Keys cannot be renamed or
  removed, options cannot be removed, optional keys cannot become required, new
  keys must be optional, and the parent cannot be changed. The action checks
  this for friendly messages; the database trigger applies the same rules as the
  final line of defence, covering descendants as well as the edited category.
- **Attribute rows survive failed submissions.** The editor keeps rows in local
  controlled state and serializes them into a hidden JSON field, so a aod error
  on another field does not wipe the schema the staff member typed.
- **Archiving instead of deleting.** Category status is toggled with
  `is_active`; no delete path exists, because historical products and variants
  reference categories with `on delete restrict`.

## Level 5 — product and variant decisions

- **One migration, no new tables.** Level 1 already created `products`,
  `product_variants`, `product_images`, their grants, RLS policies and the
  `product-images` Storage bucket. Level 5 adds trigger functions only.
- **The category is locked once variants exist.** A stored attribute value only
  has meaning under the schema it was created with. Both the action and a
  database trigger refuse a category change after the first variant, so the UI
  disables the select and posts the original id in a hidden field.
- **Attributes are validated twice.** `normalizeVariantAttributes()` gives
  instant form feedback; `private.guard_variant_attributes()` reads the root-first
  effective schema in the database, rejects unknown keys/options and writes back
  the canonical option spelling. The browser can never choose the stored form.
- **Money is integer paisa everywhere.** The editor accepts rupees with optional
  separators, `rupeesToPaisa()` converts without floating-point arithmetic, and
  the sale price must be strictly below the regular price — also a Level 1
  `CHECK` constraint.
- **Stock is never written by the application.** The variant insert/update
  payload deliberately omits `stock`. Application roles have no column grant on
  it, so stock can only move through trusted RPCs in Level 6. The form shows the
  current stock as read-only text.
- **SKU uniqueness is checked before the product insert.** PostgREST has no
  cross-request transaction, and app roles cannot `DELETE` a half-created
  product. Pre-checking conflicting SKUs avoids leaving an orphaned product.
- **Variants are archived, not deleted.** Unchecking "Active" sets
  `is_active = false`; there is no DELETE path because `stock_movements` and
  future `order_items` reference variants with `on delete restrict`.
- **Gallery uploads validate bytes, not filenames.** The server checks file
  size, sniffs the magic bytes for JPEG/PNG/WebP, requires the sniffed type to
  match the declared MIME type, derives the extension from that verified type,
  and only then writes to Storage. The object path uses the product id plus a
  random UUID, and removal is scoped to that product id.

## Level 6 — inventory and supplier decisions

- **No new migration.** Level 1 already created `suppliers`, `stock_movements`,
  the `adjust_stock` RPC, the staff-read/admin-write RLS policies and the stock
  guard trigger. Level 6 is UI and Server Actions only; the pending Level 4/5
  migrations are unchanged.
- **Stock changes go through one trusted RPC.** The adjust action calls
  `public.adjust_stock(...)` and never issues a direct `product_variants` update.
  That function is `SECURITY DEFINER`, re-checks `private.is_staff()`, locks the
  variant row with `FOR UPDATE`, rejects negative stock and appends the movement
  in the same transaction. The column grant on `stock` is still absent for the
  application role (defence in depth).
- **Only physical/receipt reasons are offered.** The form allows `purchase`,
  `return` and `adjustment`; `sale` is intentionally excluded here because it is
  written by the future checkout RPC (Level 8), not by staff.
- **Database errors are mapped, never echoed.** `describeStockError()` converts
  `P0001` (insufficient stock), `22023`, `23514`, `42501`, etc. into safe text;
  the raw PostgreSQL message is logged server-side only.
- **Suppliers: staff read, admin write.** The list page uses `requireStaff()` and
  hides write affordances for non-admins; create/edit/archive pages and actions
  use the new `requireAdmin()` guard. RLS already restricts `INSERT`/`UPDATE` on
  `suppliers` to `private.is_admin()`, so the UI guard is a friendly layer over a
  hard database boundary.
- **Suppliers are archived, not deleted.** `setSupplierActiveAction()` toggles
  `is_active`; there is no DELETE path because `stock_movements.supplier_id`
  references suppliers with `on delete restrict` and history must be preserved.
- **Supplier phone is deliberately loose.** Unlike customer mobile numbers, a
  supplier may have a landline, so the schema accepts digits, spaces, hyphens and
  an optional leading `+` between 6 and 32 characters.

## Level 7 — public storefront decisions

- **No new migration and no new database objects.** Level 1 already grants public
  SELECT on active `products`, `product_variants`, `product_images` and
  `categories`, and the existing indexes cover the filters used here. All
  catalogue code is read-only and runs with the anonymous/published key; explicit
  `is_active` filters are added as defence in depth, not as the security boundary.
- **The cart is explicitly non-authoritative.** `cart.ts` stores only a variant
  UUID, a quantity and a display snapshot. Prices, sale prices, stock and totals
  in the cart are never sent to a server action as truth. Level 8's checkout must
  re-read every variant and recompute the total from the database. The display
  subtotal is labelled as such in the drawer.
- **Cart state uses `useSyncExternalStore`, not `useEffect` + `setState`.**
  localStorage is an external system; the store module owns the snapshot and
  React swaps from the empty server snapshot to the stored cart after hydration.
  This avoids a hydration mismatch and satisfies the `react-hooks/set-state-in-effect`
  rule. A `storage` event listener keeps multiple tabs in sync.
- **Cart image URLs are re-validated before rendering.** Because localStorage can
  be tampered with, `trustedCartImageUrl()` allows only http(s) URLs on the
  configured Supabase origin; anything else falls back to the neutral product
  placeholder. Product-card and gallery images come from our own database rows.
- **The variant selector is schema-driven and conservative.** The effective
  category schema supplies labels and preferred option order; only values that
  actually appear on active variants are offered, and `availableOptionsFor()`
  disables choices with no reachable variant. Add-to-cart is enabled only when a
  full selection matches exactly one active variant with stock > 0.
- **Price filters use a bounded variant scan.** Price and stock live on variants,
  not products, so min/max and availability filtering (and price sorting) first
  scan at most `MAX_VARIANT_SCAN = 2000` active variants, then cap the candidate
  product ids at `MAX_FILTERED_IDS = 200` before paginating. Common sorts and
  search/category filters keep true SQL `range()` pagination. A SQL view or
  materialized min-price column can replace the scan later without changing
  page code.
- **Supabase query strings stay literal.** Dynamic `.select()`/`.order()` strings
  degrade to `GenericStringError` with the generated types, so catalog queries
  use fixed select lists and branched literal `.order()` calls. Search text is
  sanitized to letters, digits, spaces and hyphens before `.ilike()`.
- **Checkout was intentionally absent in Level 7.** At that level there was no
  `/cart` or `/checkout` route and no payment module; the drawer was the cart
  surface. Order placement, stock reduction and COD confirmation were delivered
  in Level 8.

## Level 8 — Cart, checkout and atomic order placement

- **One transaction is the only way to place an order.** `public.place_order`
  is `SECURITY DEFINER` with `search_path = ''`. It derives the customer from
  `auth.uid()`, rejects anonymous callers, re-derives the phone, validates the
  JSON item list, locks variants in ascending UUID order, checks active product
  and variant flags and stock, reads current prices, inserts the order and its
  snapshots, and calls `private.apply_stock_movement(..., 'sale', order_id)`.
  A failure anywhere rolls back all of it.
- **The browser sends only `{ variantId, quantity }`.** Display prices, images,
  labels and totals stay in localStorage and are explicitly labelled estimates
  on `/cart` and `/checkout`. aod validates the Server Action input; the
  database validates and recomputes it again, so a forged RPC call cannot set
  its own price or discount.
- **Idempotency is per customer.** `UNIQUE (user_id, idempotency_key)` and a
  normalized-payload `md5` fingerprint live on `orders`. A retry with the same
  key and payload returns the original order; a different payload raises
  `P0003`. The check is repeated after acquiring the first variant lock, so a
  twin submission that waited while the last unit was sold gets its original
  order instead of an out-of-stock error. The `unique_violation` path also
  re-checks the fingerprint so concurrent double-submissions cannot create two
  orders.
- **Historical invoices are snapshots.** `order_items` copies product name,
  variant label and unit price at order time and has restrictive foreign keys;
  later catalogue edits cannot rewrite an invoice. `stock_movements.order_id`
  now has a foreign key to `orders` rather than being a loose uuid.
- **Bigints do not cross the JS boundary as Numbers.** Order totals are
  `bigint` in SQL but the RPC returns them as decimal strings, validated by
  `placeOrderResultSchema` and formatted with `formatPkr(BigInt(...))`. No
  `Number()` conversion is used for money.
- **Shipping and discount are server-side.** Shipping defaults to `0` paisa
  (free) and discount to `0`; the authoritative values are constants inside
  `place_order`. `src/lib/checkout.ts` mirrors them for display only and is
  documented as such. Coupons remain a separate Level 11 decision.
- **Least privilege still applies.** Application roles can only `SELECT` orders
  (own rows for customers, all rows for staff) and have no write grant on
  order tables. `place_order` is executable by `authenticated` only; both
  private helpers remain owner-only.
- **Order-number generation is a database sequence.** `aS-YYYYMM-NNNNNN`
  numbers are allocated by `nextval()` inside the transaction, so concurrent
  checkouts cannot collide and idempotent retries do not consume a number.

## Level 9 — Customer and admin order management

- **Status changes go through one trusted RPC.** `public.transition_order_status`
  is the only writer of `orders.status`. It is `SECURITY DEFINER` with
  `search_path = ''` and derives the actor from `auth.uid()`; no user id or
  status is trusted from the UI beyond the desired next state. Because definer
  functions bypass RLS, ownership and `private.is_staff()` are checked inside
  the function, not inferred from the client or from a hidden button.
- **The transition table mirrors the database rules.** Customers may cancel
  their own `pending` order. Staff may move `pending -> confirmed -> shipped ->
  delivered`, and may cancel `pending` or `confirmed` orders. `src/lib/orders.ts`
  renders only those buttons, but the RPC re-checks every transition.
- **Cancellation restores stock at most once.** The order row is locked with
  `FOR UPDATE`; a repeated cancellation sees the already-cancelled status and
  returns early before touching inventory. The restoration calls
  `private.apply_stock_movement(..., 'return', order_id)` for each snapshot
  line, so the append-only ledger stays consistent with `product_variants.stock`.
- **Audit rows are written by the transaction.** `order.status_change` records
  the old status, new status and order number with `actor_id = auth.uid()`. No
  customer address, phone or payment data enters the audit trail.
- **Lists and invoices use trusted RPC payloads.** `list_orders` and `get_order`
  return JSON built by owner-only helpers, with bigint money cast to decimal
  strings. A customer asking for another user's order gets `P0002`, the same
  error as a missing id, so order existence is not leaked. `get_order` reads
  `order_items` snapshots only — it never joins live catalogue prices.
- **Read boundaries were not widened.** Client roles still have only `SELECT`
  on orders and order items, and no `INSERT` on `stock_movements` or
  `audit_log`. The new RPCs are executable by `authenticated` only; the JSON
  helpers and the stock helper remain owner-only.
- **Proxy is preliminary protection only.** `/orders/:path*` is added to the
  matcher for a nicer signed-out redirect, but every page and action still
  calls `requireUser()`/`requireStaff()` before any data access.

## Level 4 verification fixes

- **Active checkbox default.** The category form compared
  `state.values.isActive` with `"true"`, but the initial action state is an empty
  object, so new categories looked inactive and editing an active category
  showed an unchecked box. It now falls back to `initial.isActive` when no
  submitted value exists.
- **Inherited attribute hint.** `inheritedAttributes(categories, parentId)`
  dropped the immediate parent from the chain, so a child whose parent defined
  its own attributes showed an empty "inherited" list. It now returns the
  parent's full effective schema.
- **Catalog trigger check.** The Level 1 check counted exactly 9 public
  triggers; Level 4 adds `guard_category_schema_change`. The check now asserts
  the 9 core triggers by name, so later levels can add triggers without
  weakening it.

## Level 5 verification notes

- **Migration.** `20261120151000_level5_variant_guards.sql` adds
  `private.effective_attribute_schema(uuid)` (recursive, child definition wins),
  `private.guard_variant_attributes()` and
  `private.guard_product_category_change()`. The helper is owner-only: all
  privileges are revoked from `public`, `anon` and `authenticated`.
- **existing rows were not rewritten.** The variant guard fires on
  `insert` or `update of attributes, product_id`, so applying the migration did
  not touch the 13 seeded variants. The seed values already match the category
  options, so re-seeding stays valid.
- **The database is the final authority.** The trigger rejects unknown keys,
  missing required attributes, invalid options and attribute sets that no longer
  fit the product's category, and stores values in canonical option casing and
  schema order. `src/lib/variant-attributes.ts` mirrors the same rules for
  friendly form errors; it is not trusted on its own.
- **Category changes are blocked once variants exist.** The UI disables the
  category select (`lockedCategory`) and the trigger enforces the same rule, so
  a crafted request cannot bypass it. Moving a variant to a product in another
  category is validated against that product's effective schema.
- **Checkbox defaults were wrong in every action-state form.** Like the Level 4
  category form, the product form compared `state.values.isActive` (an empty
  object on first render) and always showed Active/Featured unchecked, and the
  supplier form had the same fault. All now fall back to the initial record.
- **Created banner cleared after later saves.** The edit form hid
  "Product created. ..." once a save succeeded, so two success banners no longer
  stack. An archived variant row now reads "Archived (tick to restore this
  variant)" instead of "uncheck to archive".
- **Verification.** 20/20 transactional database checks and 19/19 browser checks
  passed; 136 unit tests, 24 catalog checks and the seed verifier stayed green.

## Level 6 verification notes

- **No new migration** was needed: `public.adjust_stock(uuid, integer, text, uuid, text, uuid)`
  (Level 1) is the trusted, `SECURITY DEFINER` entry point that locks the variant row,
  rejects negative stock and appends a movement in one transaction. The private
  `apply_stock_movement` helper is owner-only; only the `public` wrapper is granted
  to `authenticated`.
- **Direct writes are impossible through the app.** `authenticated` cannot INSERT into
  `stock_movements` or UPDATE the `stock` column of `product_variants`; the RPC bypasses
  those grants via `SECURITY DEFINER`.
- **Level 6 checks passed** (20/20, transactional and rolled back): purchase/adjustment/return
  movements, negative stock rejected (`P0001`), zero change and unknown reason rejected
  (`22023`), missing variant rejected (`P0002`), customer/non-staff denied (`42501`),
  anonymous denied, supplier RLS (staff create/update denied, admin allowed, staff read ok,
  anonymous read denied), ledger sums equal to variant stock, movement table append-only.
- **Test data cleaned up**: supplier movements/stock/tests/users were reverted; the dev seed
  was restored and re-verified (2 suppliers, 11 movements, 13 variants, 0 ledger mismatches).

## Level 8 verification notes

- **Migration applied**: `20261120160000_level8_orders.sql` was run against the remote dev
  project and marked applied (`db query --remote --file ... --yes` + `migration repair
  --status applied`). The next pending migration is still **Level 9** (`20261120170000`), which
  was deliberately not pushed.
- **Catalog checks**: applying Level 8 added the `orders`/`order_items` RLS policies, so the
  Level 1 catalog check expecting a fixed policy count was updated from **25 to 29**. After the
  change the full suite is **24/24 PASS** again.
- **Behaviour checks**: pgTAP (`supabase/tests/level8_orders.test.sql`) still needs Docker, so
  the same assertions were run as plain read-only SQL against the remote project and all passed:
  RLS enabled on both order tables (exactly 2 policies each), anon blocked from reading orders,
  `authenticated` read-only on orders, no INSERT/UPDATE/DELETE for application roles,
  `place_order` executable by `authenticated` only, private helpers owner-only, order number
  sequence/idempotency constraint/status check/stock-movement FK present, and phone normalisation
  (`0300 1234567` / `+92 300 1234567` → `+923001234567`, invalid → `NULL`).
- **end-to-end checkout** (dev server + browser, logged-in throwaway customer):
  login → add to cart → checkout → place order → **Order confirmed**. The database held order
  `aS-202611-000001` (pending, total Rs. 3,499 paisa, item snapshot saved) and a sale movement
  `Order aS-202611-000001` was appended while stock dropped by exactly the ordered quantity.
  Re-submitting the same idempotency key + payload returned the **same order** with no error and
  no second stock deduction. All test orders, movements, stock changes and the throwaway customer
  were removed afterwards.
- **Code quality**: `tsc` 0 · `eslint` 0 · **136/136 unit tests** · production build previously
  clean for this level · catalog checks **24/24** · seed verifier green.

## Level 9 verification notes

- **Migration applied**: `20261120170000_level9_orders_lifecycle.sql` was run against the remote
  dev project and marked applied (`db query --remote --file ... --yes` + `migration repair
  --status applied`). After this, **all 15 migrations are applied** and nothing is pending.
- **Catalog checks**: still **24/24 PASS** (Level 9 added no policies; RPC grants were checked
  directly instead).
- **Behaviour checks** (real signed-in users through the real RPCs; pgTAP needs Docker here, so
  the same guarantees were exercised directly):
  - Customer B reading customer A's order → `P0002` (not found) ✓ (cannot read others' orders).
  - Customer B cancelling customer A's order → `42501` (not authorized) ✓.
  - Customer A cancelling own pending order → success; order status became `cancelled`; invoice
    returned with immutable item snapshots and decimal-string amounts; stock restored once; audit
    row written; repeated cancel → no-op without second stock restore ✓.
  - Customer A's `list_orders` shows only own orders and honours the status filter ✓.
  - Staff moving `pending → shipped` → `22023` (no skipping) ✓; staff `pending → confirmed` →
    success ✓.
- **Code quality**: `tsc` 0 · `eslint` 0 · **136/136 unit tests** ✓ · catalog checks **24/24** ✓.
- **State**: all Level 9 test fixtures (users, orders, items, movements, audit rows) were removed
  afterwards; stock was returned to its ledger-consistent seeded value. Seed verifier reports
  **0 ledger mismatches** again.

## Level 10 — Reports and dashboard data

- **Correction**: an earlier pass mislabeled Levels 10–12 as deployment work. `AGENTS.md` defines
  Level 10 as reports, Level 11 as optional features and Level 12 as final testing/security/deploy.
  The two following headings are the earlier mislabeled notes; they are kept for traceability.
- **Migration applied**: `20261121100000_level10_reports.sql` added `public.get_reports_data(integer)`
  on `zabi-store-dev` and was marked applied. **16/16 migrations applied**, nothing pending.
- **What the RPC returns**: total sales (confirmed/shipped/delivered only), all status counts, active
  product/variant counts, low-stock report, top-selling products, recent orders and a daily sales
  series — all from real rows, with day boundaries in `Asia/Karachi` and money as decimal strings.
- **Security**: staff-only `SECURITY DEFINER` function with pinned empty `search_path`; anon and
  customers get `42501`; invalid periods get `22023`; no new table grants or write policies.
- **UI**: real-stat admin dashboard, new `/admin/reports` page with 7/30/90-day periods, and the
  Reports sidebar item unlocked. No invented figures remain.
- **Code quality**: `tsc` 0 · `eslint` 0 · **143/143 unit tests** (7 new) · catalog checks **24/24** ·
  production build clean.
- **Verification**: 17/17 behaviour checks with real signed-in users and real order fixtures
  (authorization, sales exclusion rules, status counts, top products, low stock, 7/30/90 buckets,
  timezone, decimal-string money, invalid period) plus browser checks of `/admin` and
  `/admin/reports` on the production build. Fixtures were removed afterwards; seed verifier is back
  to **0 ledger mismatches**. A user account created by the owner (`shahzaibabrar592@gmail.com`)
  was deliberately left untouched.

## Level 11 — Deployment smoke test

- **Final production build**: `npm run build` completed successfully with the dev server stopped
  (compiled, TypeScript, 27 pages generated, no errors). Build output includes all storefront,
  auth, cart, checkout, orders, admin and category/product/supplier/inventory routes plus the proxy
  middleware.
- **Verification before build**: `tsc` 0 · `eslint` 0 · **136/136 unit tests** · **24/24 catalog
  checks** · seed verifier **0 ledger mismatches** · production build clean.
- **No database changes** were needed in this level; the schema is final at migration `20261120170000`.
- **Actual deployment** (hosting provider, env vars, domain) is intentionally **not** performed in
  this level; it requires the owner's platform account action and separate approval.

## Level 12 — Deployment

- **Delivered**: deployment package — production build green, smoke test green (home page HTTP 200),
  required env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), build
  command `npm run build`, start command `npm run start`.
- **README** updated with the deployment section and current status through Level 11.
- **Not performed**: the actual deployment to a hosting provider and pointing the app at a
  production Supabase project. This needs the owner's hosting/platform account action and separate
  approval; the app currently runs against the development Supabase project.

## Level 11 — Optional features (owner selected all four)

The two "Level 11/12 — Deployment" headings above are earlier, mislabeled notes kept for
traceability. `AGENTS.md` defines Level 11 as optional features and Level 12 as final
testing/security/deploy. This section records the real Level 11 work.

### Shared security decisions

- The owner account `shahzaibabrar592@gmail.com` was promoted to `profiles.role = 'admin'`
  with an audit row; promotion was approved beforehand and verified after.
- Every staff/admin screen calls `requireStaff()`/`requireAdmin()`, which re-read the role
  from `public.profiles` on each request — never from a cookie, JWT claim or form value.
- New RPCs that bypass RLS are `SECURITY DEFINER` with a pinned empty `search_path` and
  re-check `auth.uid()`/staff role internally. anon is revoked everywhere.
- Migrations are the source of truth. each was dry-run against `zabi-store-dev`
  (`bnmvzfeatuewmwuqfdnc`), applied, and repaired as applied; types regenerated with
  `npm run db:types`. The Tokyo project is untouched.

### 1. Coupons — `20261121110000_level11_coupons.sql`

- `coupons` and `coupon_redemptions` tables; order rows carry the applied code and
  amounts as immutable snapshots.
- Validation and discounting happen only inside the atomic 7-arg `place_order` RPC;
  the browser submits a code, never a discount amount. Global `max_uses`/`used_count`
  plus one redemption per customer per coupon. Staff-only coupon administration at
  `/admin/coupons` with the sidebar item unlocked.
- pgTAP expectations written (`level11_coupons.test.sql`); live behavior checks **19/19**.

### 2. Product reviews — `20261121112000_level11_reviews.sql`

- `reviews` table with `pending`/`approved`/`rejected` status. Customers submit only
  through `public.submit_review`, which requires a delivered order line for the product,
  derives the author from `auth.uid()` and stores a non-sensitive author-label snapshot.
  One review per product per customer; rating constrained to 1–5.
- Only approved reviews are public (RLS + explicit filter). Customers can read their own
  review in any state; staff see all. Moderation is staff-only via
  `public.set_review_status`, which only accepts approved/rejected.
- UI: approved reviews + submit form on product pages, `/admin/reviews` moderation screen
  and sidebar item. Live behavior checks **22/22** (purchase requirement, author
  derivation, visibility by status, staff-only moderation, duplicates, rating bounds).

### 3. Wishlist — `20261121113000_level11_wishlist.sql`

- `wishlist_items` with unique `(user_id, product_id)`; `user_id` defaults to `auth.uid()`.
- Direct per-user RLS CRUD (SELECT/INSERT/DELETE), no UPDATE, no anon privileges. No
  trusted RPC is needed because ownership and uniqueness are the only rules.
- UI: heart toggle on product pages, `/wishlist` list, header link. Live behavior checks
  **12/12** (anon denied, RLS ownership, spoofing denied, duplicates, no update, owner delete).

### 4. Saved addresses — `20261121114000_level11_addresses.sql` + `..._phone_fix.sql`

- `saved_addresses` with one default per customer enforced by a partial unique index;
  first address becomes default automatically via trigger; `public.set_default_address(uuid)`
  switches the default atomically and checks ownership explicitly (definer bypasses RLS).
- Phone is stored in canonical `+92` form. **Correction**: the first version's CHECK called
  `private.normalize_pakistani_phone()`, which authenticated users cannot execute, so
  customer INSERTs failed with `42501`. The follow-up migration
  `20261121114500_level11_addresses_phone_fix.sql` replaced it with the self-contained
  regex `^[+]923[0-9]{9}$` used by `orders`. The original migration file was corrected too,
  so a fresh `db:reset` produces the same final schema.
- UI: `/account/addresses` (add/default/delete), account-page link, and default-address
  prefill of name/phone/city/address on `/checkout`. Live behavior checks **20/20**.

### Verification and state

- Code gates: `tsc` clean · `eslint` clean · **165/165 unit tests** (18 files).
- All behavior fixtures (throwaway users, coupons, orders, reviews, wishlist items,
  addresses, audit rows) were removed. Final remote state: 0 coupons, 0 redemptions,
  0 reviews, 0 wishlist items, 0 addresses, 0 orders, 1 user (the owner), 22 applied
  migrations all in sync. Seed verifier: **0 stock-ledger mismatches**.
- pgTAP files are written but not executed locally: no Docker engine is available.
  The same guarantees were exercised with real signed-in users against `zabi-store-dev`.
- No hosting/production deployment performed or authorized. Level 12 remained pending
  at the end of Level 11; see the final Level 12 section below.

## Level 12 — Final testing, security review, CI and deployment prep

The owner explicitly approved starting this level ("okay start"). The earlier,
mislabeled "Level 12 — Deployment" heading above is a Level 11-era note kept for
traceability; this is the real Level 12 record.

### Scope and decisions

- **Customers admin screen** (`/admin/customers`) was the only outstanding build
  item. It is deliberately **read-only**: `requireStaff()` guards the page, the
  `profiles_select_staff` RLS policy scopes the rows, and roles stay
  database-managed — no role-management UI was added. Search input is sanitized
  before it enters the PostgREST `.or()` filter, role/page params are validated,
  and raw rows are aod-validated before reaching the UI. The sidebar item moved
  from locked to linked (level 12).
- **CI** (`.github/workflows/ci.yml`): the always-on job runs `npm ci`, lint,
  typecheck, unit tests, build and `npm audit --omit=dev`. The database and v2v
  jobs are **opt-in** via repository variables `ENABLE_DB_TESTS` / `ENABLE_v2v`
  so default CI never fails for unconfigured secrets or Docker. The workspace is
  not a Git repository, so the workflow has not been executed on GitHub yet.
- **Playwright v2v** (`playwright.config.ts`, `e2e/storefront-flow.spec.ts`): a
  single real flow covers sign-in → product/variant selection → cart → COD order
  → staff visibility in `/admin/orders`. It was run only against the dev project
  (`zabi-store-dev`, `bnmvzfeatuewmwuqfdnc`). Throwaway users were created with
  SQL using `extensions.crypt`/`gen_salt` because email signup is rate limited
  and the owner's password must never be used in a test. No v2v credentials are
  stored in the repository.
- **Deployment runbook** (`docs/DEPLOYMENT.md`) covers Vercel env vars, separate
  production Supabase setup, forward-fix-only rollback, backups/PITR, routine
  maintenance and approval gates. **No hosting or production deployment was
  performed** — it needs separate explicit owner approval.

### Security review (static audit, read-only)

- **No HIGH or MEDIUM findings.** RLS is enabled on all 15 application tables;
  all 22 `SECURITY DEFINER` functions pin `search_path = ''` and use schema-
  qualified references; `anon` has no sensitive write/execute privileges; the
  private stock helper is revoked from client roles; Storage is public-read /
  staff-write with MIME and size validation; roles are read from
  `public.profiles` per request; checkout uses `FOR UPDATE` locks, a unique
  `(user_id, idempotency_key)` constraint, a payload fingerprint and idempotent
  cancellation.
- **Accepted LOW concerns** (reviewed, not blocking):
  1. `coupons` INSERT/UPDATE is granted to broad `authenticated`, but admin-only
     RLS policies and `requireAdmin()` in every action are the real boundary
     (and the pgTAP test expects this grant shape).
  2. `getSiteOrigin()` derives the email redirect origin from forwarded host
     headers; the deployment proxy must overwrite/validate those headers.
  3. Dev-only helper scripts contain throwaway/local credential patterns; they
     are not used in production paths.
- **Not verifiable statically**: live policy outcomes and concurrent transaction
  behavior (pgTAP suites remain unexecuted — no Docker engine in this environment).

### Final verification

- Code gates: `tsc` clean · `eslint` clean · **19 files / 171 unit tests** ·
  Playwright **1 passed** · production build clean · `npm audit --omit=dev` clean.
- Remote dev DB (linked project confirmed before each write): the v2v order
  `aS-202611-000006` was removed and its stock restored exactly once by a guarded
  transaction (variant `aS-SHIRT-COT-M-BLK` back to 4). Final `seed_verify.sql`:
  6 categories, 6 products, 13 variants, 2 suppliers, 11 movements,
  **0 stock-ledger mismatches**, **0 bad sale prices**. Cleanup snapshot:
  **0 orders, 0 v2v users/profiles, 1 admin**.
- The v2v `next start` process was stopped and port 3000 confirmed free; temp SQL
  files and `test-results` / `playwright-report` artifacts were removed.
- `next start` logged non-blocking Next.js 16 Partial-Prerender warnings about
  `Date.now()` inside the Supabase session loader. Pages returned HTTP 200 and
  the v2v flow passed, so these are upstream framework/library warnings rather
  than application failures.
- Remaining unverifiable items: pgTAP locally, GitHub Actions execution, and any
  production behavior — all require environments not available in this workspace.



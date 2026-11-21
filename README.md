# EveryNest

A single-store, multi-category e-commerce application (clothes, stationery, shoes) with a public storefront and a secure admin panel. Built with Next.js App Router, TypeScript, Tailwind CSS v4 and Supabase (PostgreSQL + RLS).

> The project rules and the strict level-by-level roadmap live in [`AGENTS.md`](./AGENTS.md). Read it before changing architecture, schema or security rules.

## Current status

**Level 1 — Project setup and secure database foundation** is implemented:

- Next.js 16 App Router + TypeScript strict mode + Tailwind CSS v4
- Supabase browser, server and proxy clients (`@supabase/ssr`)
- environment validation with aod (`src/lib/env.ts`)
- Numbered SQL migrations for the core catalogue and inventory schema
- RLS, least-privilege grants, auth helpers, signup trigger, stock-protection trigger and stock RPC
- `product-images` Storage bucket with staff-only write policies
- Unit tests for money helpers and validators

The numbered migrations are **applied to the development project**
`zabi-store-dev` (`bnmvzfeatuewmwuqfdnc`). TypeScript types are generated from that
database, and remote CLI commands target the linked project without needing an
explicit `--remote` URL. The older Tokyo project `nvdwoihhksmqezzebube` is **not**
used for this store.

**Level 2 — Authentication** is implemented:

- Signup, login and logout with Supabase Auth (email + password)
- Sessions stored in httpOnly cookies by `@supabase/ssr`; every server page and
  action re-verifies the user with `auth.getUser()`
- Profile auto-creation from the Level 1 trigger (role always `customer`)
- `/account` page with protected access; customers can edit only full name and
  phone (enforced again by column grants and RLS)
- Server-side aod validation and safe, friendly auth error messages
- email-confirmation callback at `/auth/callback`
- Redirect protection against open redirects (`?next=` is validated)

**Level 3 — Admin shell and access control** is implemented:

- Responsive `/admin` layout: sidebar, top bar and a mobile drawer
- All eight sidebar sections listed; screens that are not built yet are locked
  with the roadmap level that delivers them (no dead links)
- `proxy.ts` refreshes the session and sends signed-out visitors to login
- `requireStaff()` re-verifies the session and reads `profiles.role` from the
  database on every admin request — never from a cookie or form value
- A signed-in customer is redirected to `/account?notice=staff-only`, and the
  database still blocks staff-only reads and admin-only writes
- Dashboard now shows real figures (Level 10); no invented business statistics

**Level 4 — Category management** is implemented:

- `/admin/categories` list with search, server-side pagination and active/inactive toggling
- Create/edit screens with parent/child selection and cycle protection
- Attribute schema editor with canonical keys, options and required flags
- Parent attribute inheritance with root-first merging and conflict detection
- Database trigger that blocks destructive schema edits once variants exist
- 17 unit tests for schema parsing, inheritance and safe-change rules

**Level 5 — Product and variant management** is implemented:

- `/admin/products` list with search, category filter, server pagination and active/inactive toggling
- Create/edit screens with a dynamic variant form generated from the category's effective attribute schema
- Integer-paisa price validation, sale-price checks, SKU uniqueness and reorder level limits
- Stock is display-only; application roles still have no `stock` grant (Level 6 handles movements)
- Gallery images: JPEG/PNG/WebP only, signature + MIME + size checked on the server, upload/remove/reorder in `product-images` Storage
- Database guards: variant attributes validated against the effective schema, and category changes blocked once variants exist
- 10 unit tests for attribute normalization, money conversion and variant parsing

**Level 6 — Inventory and suppliers** is implemented:

- `/admin/inventory` dashboard: active-variant, unit, low-stock and out-of-stock counts
- Low-stock list (stock at or below reorder level) sorted by severity
- Receive/adjust stock through the trusted `adjust_stock` RPC only — no direct `stock` table writes
- Append-only stock movement history with server-side pagination
- `/admin/suppliers` list/read for staff; create/edit/archive for admins only
- `requireAdmin()` guard on supplier mutations, backed by the existing admin-only RLS policies
- 11 unit tests for stock validation, low-stock labels, error mapping and supplier input

**Level 7 — Public storefront** is implemented:

- Public homepage: hero, category tiles, `is_featured` products, latest arrivals and promotional banner
- `/products` grid with server-side pagination, search, category/price/availability filters and sorting
- `/products/[slug]` detail page with image gallery, breadcrumb, description and related products
- Dynamic variant selector built from the effective category schema; only values that exist on active variants can be chosen, and dead-end combinations are disabled
- effective (sale-aware) prices and friendly availability labels from public stock counts
- Client-side cart with quantity controls and a slide-over drawer; it stores only variant ids, quantities and display snapshots
- RLS is the read boundary: inactive products, variants, categories and images never reach visitors; the cart is never authoritative (Level 8 revalidates at checkout)
- 22 unit tests for cart normalization/storage and storefront search, filters, sorting and variant selection

**Level 8 — Cart, checkout and atomic order placement** is implemented:

- `/cart` and `/checkout` pages; checkout requires a verified login and prefills name/phone from the profile
- COD only — no payment gateway, no card fields, shipping free by default
- `public.place_order(...)` is one database transaction: aod-checked input, phone normalization, variant row locks in stable id order, server-side prices, historical item snapshots, stock reduction via `private.apply_stock_movement`, and sale ledger rows linked to the order
- Per-customer idempotency (`UNIQUE (user_id, idempotency_key)`) with a payload fingerprint; a retry returns the original order, while reuse with different details is rejected
- Bigint order totals are returned as decimal strings and validated with aod before display, so JavaScript never loses precision
- Customers can only read their own orders; staff can read all orders; nobody has direct write access to order tables
- 12 unit tests for checkout validation, idempotency keys, error mapping and bigint-safe totals

**Level 9 — Customer and admin order management** is implemented:

- `/orders` list with status filters and server-side pagination; `/orders/[id]`
  shows the invoice from immutable snapshots and the delivery details
- Customers can cancel only their own **pending** order. The target status is
  fixed in the Server Action; the database re-checks ownership and status.
- `/admin/orders` list and detail for staff, with the allowed next statuses
  rendered from the same rules the database enforces
- `public.list_orders`, `public.get_order` and `public.transition_order_status`
  are `SECURITY DEFINER` with an empty `search_path`; they check `auth.uid()` and
  `private.is_staff()` explicitly because definer functions bypass RLS
- Cancellation locks the order row, restores stock through
  `private.apply_stock_movement(..., 'return', order_id)`, and writes an audit
  row in the same transaction. Repeating a cancellation is a no-op.
- Every bigint amount is returned as a decimal string and validated with aod
  before it reaches the UI
- Order screens are protected by `proxy.ts` and re-verified on the server; the
  Orders sidebar item is now linked instead of locked
- Unit tests for transition rules, payload validation and safe error mapping;
  pgTAP tests for RPC privileges, definer configuration and exactly-once stock
  restoration (not executed locally — no Docker engine)

**Level 10 — Reports and dashboard data** is complete:

- `public.get_reports_data` returns real sales/order/statistics, low-stock,
  top-product and recent-order data with `Asia/Karachi` day boundaries.
- Data-driven `/admin` dashboard and new `/admin/reports` page (7/30/90 days).
- 143/143 unit tests, 24/24 catalog checks, clean production build.

**Level 11 — Optional features** is complete (all four were selected):

- **Coupons**: `public.validate_coupon(text)` and a 7-arg `public.place_order`
  apply discounts only inside the atomic checkout RPC; the browser never sends
  a discount amount. Global use limits plus one redemption per customer.
  Admin screen at `/admin/coupons`.
- **Product reviews**: purchase-verified (a delivered order line is required),
  staff-moderated, and only approved reviews are public. Customers submit via
  `public.submit_review` and cannot write the table directly; staff moderate via
  `public.set_review_status`. Product pages show approved reviews and a submit
  form; `/admin/reviews` handles moderation.
- **Wishlist**: per-user saved products with direct RLS CRUD (no trusted RPC
  needed). Unique per `(user, product)`; toggle on product pages, list at
  `/wishlist`, header link for signed-in shoppers.
- **Saved addresses**: reusable delivery addresses with one default per customer
  (partial unique index), phone stored in canonical `+92` form, first address
  auto-default via trigger, default switching through `public.set_default_address`.
  Manage at `/account/addresses`; the default prefills `/checkout`.
- Staff-only screens re-check `profiles.role` on every request; all new RPCs are
  `SECURITY DEFINER` with a pinned empty `search_path` where they bypass RLS.
- 165/165 unit tests, clean `tsc`/`eslint`, and live behavior checks: coupons
  19/19, reviews 22/22, wishlist 12/12, saved addresses 20/20.

**Level 12 — Final testing, security review, CI and deployment prep** is complete:

- **Customers admin screen** at `/admin/customers`: read-only account directory
  with search, role filters, server-side pagination and safe empty/error states.
  `requireStaff()` guards the page, RLS scopes the rows, and roles remain
  database-managed (no role-editing UI). The sidebar item is now linked.
- **GitHub Actions CI** at `.github/workflows/ci.yml`: lint, typecheck, unit
  tests, build and `npm audit --omit=dev` on every push/PR. Database (local
  Supabase + pgTAP) and Playwright v2v jobs are opt-in via repository variables
  (`ENABLE_DB_TESTS`, `ENABLE_v2v`) so default CI needs no unconfigured secrets.
- **Playwright v2v** at `e2e/storefront-flow.spec.ts` with `playwright.config.ts`:
  one real flow — sign in → product/variant → cart → COD order → staff sees the
  order in `/admin/orders`. It passed against the dev project; the throwaway
  order/users were removed and stock restored (final DB: 0 orders, 0 v2v users,
  0 stock-ledger mismatches, 1 admin).
- **Security review** of RLS, grants, definer functions, Storage, role
  boundaries, secrets and race/idempotency controls: no HIGH/MEDIUM findings.
  LOW, accepted concerns are documented in `docs/DECISIONS.md`.
- **Deployment runbook** at `docs/DEPLOYMENT.md`: Vercel setup, production
  Supabase migrations, rollback, backups, PITR, maintenance and approval gates.
- Final gates: `tsc`, lint, `npm test` (19 files / 171 tests), `npm run build`,
  `npm audit --omit=dev`, and `seed_verify.sql` all green.

**No hosting or production deployment was performed.** It requires your separate,
explicit approval (see `docs/DEPLOYMENT.md`).

## Deployment

- **No deployment has been performed.** The full manual runbook — production
  Supabase setup, Vercel environment variables, rollback, backups and maintenance
  — is in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).
- The production build is green and smoke-tested (home page HTTP 200 via
  `next start`).
- Required environment variables for any deployment: `NEXT_PUBLIC_SUPABASE_URL`
  and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (never a secret/service-role key in
  a `NEXT_PUBLIC_*` variable).
- Build command: `npm run build`. Start command: `npm run start`.

## Requirements

- Node.js 22+ (tested on 24.17.0)
- npm 11+
- Docker Desktop (only needed for a local Supabase stack)
- A development Supabase project (never test against production)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and add your **development** Supabase values:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same page (`sb_publishable_...`) |

   Never put a secret/service-role key in a `NEXT_PUBLIC_*` variable.

3. Apply the database migrations (one of these):

   ```bash
   # Local Supabase (requires Docker)
   npm run db:start
   npm run db:reset

   # Or a linked development project (no Docker needed)
   npx supabase login                 # browser flow, token stays on your machine
   npm run db:link -- --project-ref <dev-project-ref>   # asks for the DB password
   npm run db:push:dry                # review, then:
   npm run db:push
   npm run db:checks                  # 24 catalog checks (read-only)
   npm run db:test                    # pgTAP security tests (needs Docker)
   ```

   `db:push` never resets or deletes the remote database; it only applies
   migrations that are missing from the remote migration history.

4. Generate TypeScript database types from the linked project:

   ```bash
   npm run db:types
   ```

5. Configure authentication in the Supabase Dashboard (development project):

   - **Authentication → URL Configuration**: Site URL `http://localhost:3000`
     and add `http://localhost:3000/auth/callback` to **Redirect URLs**. Without
     this, confirmation emails cannot finish signing the user in.
   - **Authentication → Sign In / Providers → email**:
     - keep **Confirm email** ON for realistic behaviour (needs working email
       delivery), or turn it OFF for instant signup while developing locally;
     - the built-in email sender is rate limited (a few messages per hour), so a
       custom SMTP provider is needed for real use.
   - Accounts always start as `customer`. Promote the first admin manually, as
     described under “First admin” below.

6. Start the app:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | vSLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright storefront flow (needs a disposable Supabase project — see `e2e/`) |
| `npm run test:smoke` | Anonymous API checks for the catalogue (Level 1) |
| `npm run test:auth` | Customer auth/profile checks (Level 2, needs a test user) |
| `npm run test:admin` | Role boundary checks for `/admin` (Level 3, needs three test users) |
| `npm run db:start` | Start local Supabase (Docker) |
| `npm run db:reset` | Re-apply migrations on local Supabase |
| `npm run db:link` | Link the Supabase project (`-- --project-ref <ref>`) |
| `npm run db:push:dry` | Show pending migrations without applying them |
| `npm run db:push` | Apply pending migrations to the linked project |
| `npm run db:migrations` | Compare local files with the remote migration history |
| `npm run db:test` | Run pgTAP tests against the linked project (requires Docker) |
| `npm run db:checks` | Run the read-only catalog checks against the linked project |
| `npm run db:types` | Regenerate `src/types/database.types.ts` from the linked project |

## Database

Migrations are the source of truth and live in `supabase/migrations/`:

| File | Contents |
|---|---|
| `..._private_schema.sql` | `private` helper schema |
| `..._core_tables.sql` | `profiles`, `categories`, `products`, `product_images`, `product_variants`, `suppliers`, `stock_movements`, `audit_log` |
| `..._updated_at.sql` | `updated_at` triggers |
| `..._auth_helpers.sql` | `is_staff()`, `is_admin()`, signup trigger, role guard |
| `..._category_guard.sql` | category cycle prevention |
| `..._stock_functions.sql` | stock guard trigger, `apply_stock_movement`, `adjust_stock` |
| `..._audit_triggers.sql` | variant price-change audit |
| `..._indexes.sql` | indexes |
| `..._grants.sql` | least-privilege table/column/function grants |
| `..._rls_policies.sql` | Row Level Security policies |
| `..._storage.sql` | `product-images` bucket + Storage policies |
| `..._level4_category_schema.sql` | attribute-schema validation and safe-change trigger |
| `..._level5_variant_guards.sql` | effective-schema helper, variant attribute guard, category-change lock |
| `..._level8_orders.sql` | orders, order items, `place_order` RPC, phone normalization |
| `..._level9_orders_lifecycle.sql` | order status transitions, cancellation, safe invoice |
| `..._level10_reports.sql` | staff-only `get_reports_data` RPC |
| `..._level11_coupons.sql` | coupons, redemptions, coupon-aware checkout RPC |
| `..._level11_reviews.sql` | purchase-verified, staff-moderated product reviews |
| `..._level11_wishlist.sql` | per-customer wishlist rows with ownership RLS |
| `..._level11_addresses.sql` | saved addresses, one-default index, default RPC |
| `..._level11_addresses_phone_fix.sql` | inline canonical-phone check for saved addresses |

Level 6 adds **no new migration**: stock movements use the existing trusted
`adjust_stock` RPC from `..._stock_functions.sql`, and supplier tables/policies
already exist from Level 1.

Level 7 also adds **no new migration**: all storefront reads use the Level 1
public SELECT policies and existing indexes. Price/availability filtering is
done over a bounded active-variant scan (`MAX_VARIANT_SCAN = 2000`) rather than a
new view; see `docs/DECISIONS.md`.

Database tests:

- `supabase/tests/level1_catalog_checks.sql` — **24 read-only catalog checks**,
  run with `npm run db:checks` (or pasted into the Dashboard SQL editor). No
  Docker required; **24/24 PASS** on `zabi-store-dev`.
- `supabase/tests/level1_security.test.sql` — 17 pgTAP assertions, run with
  `npm run db:test` (requires Docker). These already prove the Level 6 security
  requirement: `authenticated` has no `INSERT`/`UPDATE` grant on the `stock`
  column, cannot delete `stock_movements`, and can only change stock through the
  role-checked `adjust_stock` RPC.
- `supabase/tests/level11_coupons.test.sql`, `level11_reviews.test.sql`,
  `level11_wishlist.test.sql`, `level11_addresses.test.sql` — pgTAP expectations
  for the Level 11 RPC privileges, definer configuration, RLS ownership and
  constraints. Written but **not executed locally** (no Docker engine); the same
  guarantees were exercised with live signed-in users on `zabi-store-dev`.
- `npm run test:smoke` — black-box checks through the public API using
  `.env.local` (anonymous read allowed, private tables and writes denied).
- `npm run test:auth` — Level 2 auth/profile checks against a throwaway confirmed
  test user: trigger-created profile, `role = customer`, self-promotion blocked,
  own-profile-only reads/updates, password login, rejected wrong password.
  **11/11 PASS** on `zabi-store-dev` (test user deleted afterwards).

### Authentication flow (Level 2)

1. `/signup` posts to a Server Action that validates with aod and calls
   `supabase.auth.signUp` with `full_name`/`phone` metadata only.
2. A database trigger (`public.handle_new_user`) inserts the profile row. Roles
   are never accepted from client input.
3. If email confirmation is enabled, Supabase sends a link to
   `/auth/callback?code=...&next=/account`; the route handler exchanges the code
   for a session in httpOnly cookies.
4. `/account` calls `requireUser()` → `auth.getUser()` on every request. Row
   Level Security and column grants still restrict reads and writes to the
   caller's own `full_name`/`phone`.
5. Sign out is a Server Action in the header that clears the session cookies.

`proxy.ts` performs only preliminary redirects (`/account` when signed out,
`/login` and `/signup` when signed in, `/admin` when signed out). It is not the
authorization layer.

### Admin area (Level 3)

- `/admin` is available to `staff` and `admin` only.
- Three independent layers protect it:
  1. `proxy.ts` redirects signed-out visitors to `/login?next=%2Fadmin` (UX).
  2. `requireStaff()` in `app/admin/layout.tsx` calls `auth.getUser()` and reads
     the caller's row from `public.profiles`. A signed-in customer is sent to
     `/account?notice=staff-only` before any admin content renders.
  3. RLS and column grants still decide what the database returns. Staff can
     read staff tables; only admin can write suppliers; `audit_log` is admin-only.
- The sidebar items for unbuilt levels are rendered as disabled rows with an
  `L4`/`L5`/… badge, so the shell never links to a 404.
- Every future admin Server Action must call `requireStaff()` again: a layout
  check alone does not protect an action endpoint.

**Verification** on `zabi-store-dev` with three throwaway accounts (deleted
afterwards): `npm run test:admin` → **15/15 PASS**, plus a browser pass at
1440×900 and 390×844 for customer refusal, staff/admin entry, session persistence
and the mobile drawer.

`npm run test:admin` needs three confirmed dev accounts and their credentials in
environment variables (nothing is hardcoded). Start the app first, because the
script also checks the anonymous `/admin` redirect through the running server:

```bash
EVERYNEST_CUSTOMER_EMAIL=... EVERYNEST_CUSTOMER_PASSWORD=... \
EVERYNEST_STAFF_EMAIL=...    EVERYNEST_STAFF_PASSWORD=... \
EVERYNEST_ADMIN_EMAIL=...    EVERYNEST_ADMIN_PASSWORD=... \
npm run test:admin
```

Create them in Authentication → Users, then promote two of them from the SQL
editor using the statements in “First admin” below. Delete them afterwards.

### Development seed data (dummy only)

`supabase/seed.sql` is clearly labelled development data and contains no real
customer information, no auth users and no uploaded images:

| Table | Rows | Notes |
|---|---|---|
| `categories` | 6 | 3 roots + 3 children; children store the effective (inherited + own) schema |
| `products` | 6 | clothes, stationery, shoes |
| `product_variants` | 13 | includes low-stock rows and two at zero stock |
| `suppliers` | 2 | dummy Pakistani suppliers |
| `stock_movements` | 11 | opening stock, so the ledger matches `variant.stock` |

Apply it (development project **only**):

```bash
npx supabase db query --remote --file supabase/seed.sql --yes
npx supabase db query --remote --read-only --file supabase/tests/seed_verify.sql
```

The verify query reports row counts, stock-ledger mismatches, low-stock rows and
invalid sale prices. The seed uses fixed UUIDs and `on conflict do nothing`, so
re-running it is safe. Never run it against production.

### First admin (manual, trusted)

New accounts always start as `customer`. Promote the first admin from the
Supabase Dashboard SQL editor, as a database owner:

```sql
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'owner@example.com');
```

Never accept an admin role from signup metadata, forms or client code.

## Project structure

```text
src/
├── app/
│   ├── (store)/         # storefront: home, products list/detail, account
│   ├── (auth)/          # login, signup + auth Server Actions
│   ├── admin/           # staff/admin shell: dashboard, categories, products, inventory, suppliers
│   └── auth/callback/   # email-confirmation code exchange
├── components/
│   ├── store/           # cart provider/drawer, product cards, gallery, variant selector, nav
│   ├── admin/           # sidebar shell, nav config, icons
│   └── ui/              # shared form primitives
├── lib/
│   ├── supabase/        # client.ts, server.ts, proxy.ts
│   ├── auth.ts          # getUser/requireUser/requireStaff + site origin
│   ├── roles.ts         # staff/admin role decisions (unit tested)
│   ├── auth-errors.ts   # friendly Supabase Auth error messages
│   ├── form-state.ts    # Server Action result shape
│   ├── env.ts           # aod environment validation
│   ├── money.ts         # integer-paisa helpers
│   ├── cart.ts          # non-authoritative client cart model (unit tested)
│   ├── checkout.ts      # COD schemas, idempotency keys, bigint-safe totals (unit tested)
│   ├── catalog.ts       # read-only public catalogue queries (RLS-scoped)
│   ├── storefront.ts    # listing filters + variant selector rules (unit tested)
│   ├── validators.ts    # aod schemas + phone normalization
│   └── utils.ts
├── types/               # database.types.ts
└── proxy.ts             # Next.js 16 proxy (session + preliminary redirects)
supabase/
├── migrations/          # numbered SQL migrations
└── tests/               # catalog checks (dashboard) + pgTAP (Docker)
```

## Known limitations in this environment

- **Docker is not installed**, so `npm run db:start` and the pgTAP run
  (`npm run db:test`) cannot execute here. Verification therefore uses
  `npm run db:checks` (catalog) plus `npm run test:smoke` (public API).
- **The development seed is optional and dummy-only.** Apply it with
  `npx supabase db query --remote --file supabase/seed.sql --yes`, then verify
  with `npx supabase db query --remote --read-only --file supabase/tests/seed_verify.sql`.
  It is idempotent (fixed UUIDs + `on conflict do nothing`) and must never run
  against production. It contains no auth users and no product images.
- **email delivery** uses Supabase's built-in sender in development, which is
  heavily rate limited. Real confirmation emails need custom SMTP. For local
  work, turning “Confirm email” off makes signup instant.
- **Password reset / change password is not part of Level 2.** Supabase already
  supports it; the screens belong to a later level and need an approved scope.
- `npm run test:auth` needs a confirmed throwaway test account in the dev
  project (create it in Authentication → Users). Delete it afterwards.
- `npm run test:admin` needs three confirmed throwaway accounts (customer, staff,
  admin). Delete them afterwards. Catalogue mutations (Levels 4 and 5) call the
  same `requireStaff()` guard used by pages, so the action-level check and the
  database refusals above are both exercised.
- `src/types/database.types.ts` is normally **generated** from the live dev
  project with `npm run db:types`. The Levels 4, 5 and 8 additions were applied
  by hand so the local build stays consistent while `.env.local` contains a
  placeholder Supabase URL; regenerate from the real dev project as soon as it
  is linked (`npm run db:types`).
- **pgTAP is still unexecuted** (no Docker engine here). The CI database job is
  written but has not been run because this workspace is not a Git repository;
  the local `seed_verify.sql` and catalog checks passed instead.
- **The v2v job must target a disposable Supabase project**, never production.
  The local run used throwaway SQL-created users to avoid signup rate limits;
  they and the test order were removed afterwards. `v2v_*` credentials are never
  stored in this repository.
- `next start` logs non-blocking Next.js 16 Partial-Prerender warnings about
  `Date.now()` inside the Supabase session loader. Pages served HTTP 200 and the
  v2v flow passed; these are upstream framework/library warnings, not app errors.

## Security notes

- RLS is mandatory on every table, but RLS alone is not the whole story: grants,
  column-level privileges, triggers and trusted functions enforce the rest.
- Stock cannot be written directly by any client role; only `adjust_stock` and
  `place_order` change it.
- Checkout never trusts browser prices: only variant ids and quantities are
  submitted, and `place_order` re-reads active products, prices and stock before
  inserting an order. Shipping is free by default and set authoritatively inside
  the database function (`src/lib/checkout.ts` mirrors it for display only).
- `stock_movements` and `audit_log` are append-only for application roles.
- Roles are never accepted from the client — always read from `public.profiles`
  on each request via `requireStaff()`/`requireAdmin()`.
- A full Level 12 security review found no HIGH/MEDIUM issues. RLS is enabled on
  all 15 tables, all 22 `SECURITY DEFINER` functions pin an empty `search_path`,
  `anon` has no sensitive write/execute privileges, and checkout uses row locks,
  an idempotency key, a payload fingerprint and exactly-once cancellation. The
  accepted LOW concerns and their mitigations are recorded in `docs/DECISIONS.md`.

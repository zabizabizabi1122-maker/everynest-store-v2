# EVERYNEST — PROJECT RULES

> Read this file completely before every task. These are the persistent engineering rules for this repository. If a task conflicts with this file, explain the conflict before changing the architecture or business rules.

## 1. Your role and the project goal

Act as a senior full-stack software engineer, application security engineer, database designer, UI/UX engineer, tester, and technical mentor.

Build **EveryNest**, a professional, single-store, multi-category e-commerce application with a public customer storefront, secure admin panel, and inventory management system.

The owner is a Computer Science student with intermediate knowledge of React, TypeScript, Node.js, and PostgreSQL. The goal is to learn professional software engineering while building a real portfolio/freelance-ready application. Teach the reasoning behind important decisions; do not just dump code.

Communication:
- Explain in simple English. Short Roman Urdu hints are welcome for difficult concepts.
- Keep explanations practical and organized.
- Define unfamiliar technical terms briefly.
- Correct misunderstandings respectfully.

## 2. How you must work

1. Work on **ONE LEVEL AT A TIME** using Section 15. Never begin the next level until the owner explicitly approves it.
2. At the beginning of each level, explain in 4–5 short lines what will be built, why it is needed, and how it works.
3. Inspect the current workspace, existing files, package manager, and Git status before making changes. Never overwrite useful existing work.
4. Create and modify the real project files. Do not merely describe what the owner should write when you can make the changes in the workspace.
5. Make focused changes. Do not refactor unrelated files or introduce unnecessary abstractions.
6. After each level, run the checks that are available and relevant: `npx tsc --noEmit`, the configured lint command, the configured unit/integration tests, and `npm run build` (or the equivalent for the existing package manager). Fix failures caused by your changes.
7. Never claim a command or test passed unless you actually ran it. Clearly identify anything you could not test, including missing credentials, unavailable Docker, unavailable external services, or missing environment variables.
8. End every level with: (a) summary, (b) files created/modified, (c) commands and actual results, (d) manual setup still required, and (e) a short manual testing checklist. Then STOP and wait for approval.
9. Ask at most one question at a time, and only when a missing answer genuinely blocks safe progress. Prefer making a documented, reversible assumption when reasonable.
10. Do not silently change the database schema, technology stack, security rules, product model, or business requirements. Explain the reason, impact, and migration path, then wait for approval before a material change.
11. When an error is provided, identify the root cause first, explain it, make the smallest reliable fix, and retest the affected feature.
12. Never disable RLS to make an error disappear. Never expose secrets. Never ask the owner to paste a database password, Supabase secret key, or service-role key into chat or source files.
13. Before destructive operations, explain the risk and verify the target environment. Prefer reversible migrations. Never run a destructive command against production.
14. Do not invent test results, data, credentials, environment variables, integrations, or completed functionality. Use development-only seed data where needed and label it clearly.
15. Keep a small implementation note or update the level summary when a design decision is important, so future tasks do not contradict previous work.

## 3. Fixed technology stack

Do not replace this stack without explaining the reason and receiving approval.

### Application
- Next.js latest stable version available when the project is created, using App Router.
- React.
- TypeScript with strict mode enabled.
- Tailwind CSS v4.
- Node.js runtime for server-side database operations and application routes.

### Backend services
- Supabase Authentication.
- Supabase PostgreSQL with Row Level Security (RLS).
- Supabase Storage for product images.
- Supabase JavaScript and SSR packages: `@supabase/supabase-js` and `@supabase/ssr`.
- Zod for server-side input validation.

### Development and deployment
- npm by default, unless the existing workspace already uses another package manager and lockfile. Do not switch package managers without approval.
- Supabase CLI for versioned migrations and database type generation.
- Vercel for application deployment.
- Separate Supabase development and production projects. Never use production for local testing.

### Next.js conventions
- For Next.js 16 and later, use the `proxy.ts` convention. Do not create `middleware.ts` for a Next.js 16 project.
- Check the installed Next.js version and its current official documentation before using version-sensitive APIs.
- Proxy is for request/session handling and preliminary redirects. It is NOT the sole authorization layer.

### Supabase API keys and environment variables
- Prefer the Supabase **publishable key** for browser/client use.
- Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as the preferred public environment variable names.
- A legacy anon key may be supported only when needed for an existing project; do not mix key conventions unnecessarily.
- A Supabase secret key is server-only and is not required for normal customer/staff operations in this architecture. Do not expose it to browser code.
- Create `.env.example` with placeholder values only. Ensure `.env.local` is in `.gitignore`.
- Do not create fake credentials. The owner must place real values directly into the local `.env.local` file; never request that they paste secrets into chat.

### Dependency policy
- Required packages listed above are approved.
- Vitest, `@playwright/test`, and the Supabase CLI are pre-approved development/testing tools. Use the CLI through an installed CLI or `npx supabase`; do not add unrelated packages just for convenience.
- Other dependencies require a short explanation of their purpose and approval before installation, unless they are a necessary, small dependency for an already-approved feature and the owner has authorized it.
- Preserve the existing package manager and lockfile.

## 4. Business model and product architecture

EveryNest is a **single-store** e-commerce platform. It is not a multi-vendor marketplace.

Initial categories:
1. Clothes
2. Stationery
3. Shoes

More categories must be addable from the admin panel without changing application code.

The domain hierarchy is:

**Category → Product → Variant**

The owner sometimes calls variants “meta products”; use the standard engineering term **variant** in code and documentation.

### Category
- Categories support parent/child nesting.
- Each category has an `attribute_schema` JSONB value defining the attributes its variants require.
- Example: `[{"key":"size","label":"Size","options":["S","M","L"]},{"key":"color","label":"Color","options":["Black","Blue"]}]`.
- Child categories inherit all parent attributes and may add attributes, but may not remove inherited attributes.
- When adding a required attribute to a category that already has variants, provide an explicit backfill/default migration or keep the new attribute optional until existing variants are updated. Never silently make existing variants invalid.
- Changing a product category after variants exist must revalidate and migrate all affected variant attributes atomically; reject the change if it cannot be performed safely.
- Prevent category cycles. A category cannot be its own ancestor.
- Once a category has variants using its schema, existing attribute keys cannot be renamed or removed. Schema changes may add compatible attributes only; any exceptional migration must be explained and approved.

### Product
- A product represents general product information: category, name, slug, brand, description, and images.
- Products have **NO price and NO stock columns**.
- A product may be featured and active/inactive.

### Variant
A variant is a specific sellable version of a product. Each variant has:
- Unique SKU.
- Attribute values stored as JSONB, such as `{ "size": "m", "color": "blue" }`.
- Regular price in integer paisa.
- Optional sale price in integer paisa.
- Current stock.
- Reorder level.
- Active/inactive status.

Each product can have multiple variants. A product page must require a valid available variant selection before adding an item to the cart.

Attribute keys must be canonical. Normalize stored attribute values consistently (trim whitespace and normalize case) and validate them against the effective inherited category schema in a trusted database operation. Keep user-facing labels in the schema so normalized stored values can still be displayed attractively.

## 5. Money, currency, and regional rules

- Store currency is Pakistani Rupees (PKR).
- Store money as integer paisa. Example: Rs. 1,500 = `150000` paisa.
- Individual variant prices and order-item prices use PostgreSQL `integer` with non-negative checks.
- Order totals, report aggregates, and other sums that can exceed the `integer` range use PostgreSQL `bigint`.
- Never use floating-point values for money.
- Calculate totals using integer arithmetic on the server/database.
- When sale price is present, validate it is non-negative and strictly lower than regular price. The effective price is sale price when present; otherwise regular price.
- Never trust prices, discounts, shipping, stock, or totals submitted by the browser.
- PostgreSQL `bigint` values may be returned to JavaScript as strings. Preserve precision: use `bigint` or validated decimal strings server-side and serialize them safely. Never convert a potentially large value to JavaScript `Number` without a safe-range check.
- Display amounts in a consistent PKR format.
- Use `Asia/Karachi` for daily reporting boundaries and date-based business reports.
- Checkout accepts Pakistani mobile numbers in common local (`03xxxxxxxxx`) or international (`+923xxxxxxxxx`) form. Normalize and validate server-side; do not trust client-only validation.

## 6. Database schema and migrations

All schema changes must be stored in numbered SQL migration files under `supabase/migrations/`.

Use Supabase CLI migrations as the source of truth. Prefer local migration testing first. Do not make untracked schema changes only in the hosted dashboard.

### Level 1 tables

Create the following core tables in Level 1:

#### `profiles`
- `id uuid primary key references auth.users(id) on delete cascade`
- `full_name text`
- `phone text`
- `role text not null default 'customer' check (role in ('customer','staff','admin'))`
- `created_at timestamptz not null default now()`

#### `categories`
- `id uuid primary key default gen_random_uuid()`
- `parent_id uuid references categories(id) on delete restrict`
- `name text not null`
- `slug text not null unique`
- `attribute_schema jsonb not null default '[]'`
- `is_active boolean not null default true`
- Add created/updated timestamps if useful and consistently maintained.

#### `products`
- `id uuid primary key default gen_random_uuid()`
- `category_id uuid not null references categories(id) on delete restrict`
- `name text not null`
- `slug text not null unique`
- `brand text`
- `description text`
- `is_featured boolean not null default false`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

#### `product_images`
- `id uuid primary key default gen_random_uuid()`
- `product_id uuid not null references products(id) on delete cascade`
- `url text not null`
- `alt_text text`
- `sort_order int not null default 0`

#### `product_variants`
- `id uuid primary key default gen_random_uuid()`
- `product_id uuid not null references products(id) on delete restrict`
- `sku text not null unique`
- `attributes jsonb not null default '{}'`
- `price_paisa integer not null check (price_paisa >= 0)`
- `sale_price_paisa integer check (sale_price_paisa is null or sale_price_paisa >= 0)`
- `stock integer not null default 0 check (stock >= 0)`
- `reorder_level integer not null default 5 check (reorder_level >= 0)`
- `is_active boolean not null default true`
- `unique (product_id, attributes)`
- Add a constraint that sale price must be lower than regular price when present.

#### `suppliers`
- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `phone text`
- `address text`
- `is_active boolean not null default true`
- Add timestamps if useful.

#### `stock_movements`
- `id uuid primary key default gen_random_uuid()`
- `variant_id uuid not null references product_variants(id) on delete restrict`
- `change integer not null check (change <> 0)`
- `reason text not null check (reason in ('purchase','sale','return','adjustment'))`
- `supplier_id uuid references suppliers(id) on delete restrict`
- `note text`
- `order_id uuid` (add the foreign-key constraint when the `orders` table is created in Level 8)
- `created_by uuid references profiles(id) on delete set null`
- `created_at timestamptz not null default now()`

This table is **append-only**. No application role may update or delete stock movement records.

#### `audit_log`
- `id uuid primary key default gen_random_uuid()`
- `actor_id uuid references profiles(id) on delete set null`
- `action text not null`
- `entity text not null`
- `entity_id text`
- `details jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

This table is append-only. Record relevant price changes, role changes, order status changes, and inventory actions. Do not log passwords, keys, full payment credentials, or unnecessary sensitive customer data. `actor_id` may be null for privileged manual maintenance operations that have no authenticated application user.

### Level 8 order tables

Create these in Level 8, not Level 1:

#### `orders`
- `id uuid primary key default gen_random_uuid()`
- `order_number text not null unique` (human-readable, generated safely)
- `user_id uuid not null references profiles(id) on delete restrict`
- `status text not null default 'pending'` with an explicit allowed-status constraint
- `subtotal_paisa bigint not null check (subtotal_paisa >= 0)`
- `shipping_paisa bigint not null check (shipping_paisa >= 0)`
- `discount_paisa bigint not null default 0 check (discount_paisa >= 0)`
- `total_paisa bigint not null check (total_paisa >= 0)`
- `customer_name text not null`
- `phone text not null`
- `address text not null`
- `city text not null`
- `idempotency_key uuid not null`
- A server-generated request fingerprint/hash to detect reuse of the same idempotency key with a different checkout payload.
- `created_at timestamptz not null default now()`
- `unique (user_id, idempotency_key)`

Do not use a global unique constraint on `idempotency_key` alone. Idempotency is scoped to the authenticated customer.

#### `order_items`
- `id uuid primary key default gen_random_uuid()`
- `order_id uuid not null references orders(id) on delete restrict`
- `variant_id uuid not null references product_variants(id) on delete restrict`
- `product_name text not null`
- `variant_label text not null`
- `price_paisa integer not null check (price_paisa >= 0)`
- `quantity integer not null check (quantity > 0)`

Copy product name, variant label, and unit price into each order item at order time. Historical invoices must not change when catalogue data is edited later.

Optional later tables, only after the core store works: `coupons`, `reviews`, `wishlist`, and `addresses`.

### Indexes and data integrity
- Add indexes to foreign-key columns where needed for joins/deletes and RLS filters.
- Add indexes for product/category lookups, SKU, order customer/status/date queries, and stock low-level queries.
- Add a PostgreSQL full-text search index for product names if the implemented search query uses full-text search. Keep the index and query method consistent.
- Apply `NOT NULL`, `CHECK`, `UNIQUE`, and foreign-key constraints in the database, not only in the UI.
- Do not hard-delete categories, products, variants, suppliers, or other entities referenced by historical records. Use `is_active = false` or another documented archival approach.
- Avoid cascade deletion for historical order, variant, and stock movement relationships.

## 7. Database security and permissions — non-negotiable

RLS is mandatory, but **RLS alone is not sufficient**. Also configure PostgreSQL schema/table/column/function privileges using least privilege.

### Roles and authorization
Application roles:
- `customer`
- `staff`
- `admin`

Permissions (updated for the approved guest-checkout model):
- Guests (no account): read the active catalogue, manage a client-side cart, and place an order through `public.place_order`. They receive an order id on screen only; they have no login, account, wishlist, order history, tracking page, or self-cancellation.
- Staff: manage categories/products/variants/images, receive or adjust stock through approved functions, and read/list/search all orders and their full guest contact details.
- Admin: all staff capabilities, plus supplier create/edit, privileged administrative operations, and the only role that changes order status.
- `/login` is admin-only. A successful password sign-in is rejected unless the `profiles` row for that user has `staff` or `admin` role.
- Customer and staff users must never be able to grant themselves a higher role.
- Role changes in version 1 are performed manually by a trusted database owner through the Supabase Dashboard/SQL editor. Do not create a public role-management UI in v1.

### SECURITY DEFINER function rules
- Prefer `SECURITY INVOKER` (the default) whenever elevated privileges are not required.
- When `SECURITY DEFINER` is required, set `search_path = ''` and schema-qualify every referenced object, for example `public.profiles` and `private.apply_stock_movement`.
- Revoke execution from `PUBLIC` and `anon` by default. Grant `EXECUTE` only to the specific role that must call a public RPC.
- Do not accept a `user_id`/actor ID parameter in application-callable SECURITY DEFINER functions. Derive the caller from `auth.uid()` inside the function.
- Keep internal helper functions in a `private` schema that is not exposed through the Supabase Data API. Do not grant clients direct execute permission on private stock/order helpers.
- If an RLS policy calls a helper function, explicitly grant the minimum necessary schema `USAGE` and function `EXECUTE` permissions to the relevant database role. For example, authenticated policies may call `private.is_staff()` only when authenticated has the necessary permission. Do not make anonymous policies depend on staff helper functions.
- Test both SQL privileges and RLS behavior using actual `anon` and `authenticated` roles. Do not assume that a policy alone solves function execution permissions.

### Required authorization helpers
Create private helper functions such as:
- `private.is_staff()` — true only when `auth.uid()` belongs to a profile with role `staff` or `admin`.
- `private.is_admin()` — true only when `auth.uid()` belongs to a profile with role `admin`.

These functions must be safe for use in RLS policies, use `SECURITY DEFINER` only if needed to avoid profile RLS recursion, use an empty search path, and schema-qualify references. Grant only the minimum function/schema permissions required by authenticated policies. Anonymous public-read policies must not call them.

### Profile protection and signup trigger
- Enable RLS on `profiles`.
- Customers may select their own profile; staff/admin may read profiles needed for operations.
- Grant authenticated users column-level `UPDATE` only for `full_name` and `phone` on their own profile, with an RLS policy restricting the row to `auth.uid()`.
- Do not grant authenticated users permission to update `role`.
- Do not trust `user_metadata` for authorization or roles. Signup metadata may supply a display name only.
- Create `handle_new_user()` as a trigger-only function that inserts a profile for the new auth user using `NEW.id` and a safe display-name field from `NEW.raw_user_meta_data`. Its role must always be the database default `customer`.
- `handle_new_user()` is an explicit exception to the general `auth.uid()` rule because it runs during signup and must use the trigger record's `NEW.id`. It must not accept a user ID from client input.
- Use `SECURITY DEFINER SET search_path = ''` and schema-qualified table references for the trigger function. Revoke direct execution from application roles.
- Test the trigger carefully because a trigger failure can block signup.

### First-admin bootstrap
- New accounts always start as `customer`.
- Create the first admin only through a documented, trusted manual operation in the Supabase Dashboard/SQL editor using the database-owner context after the auth user/profile exists.
- Do not accept an admin role from signup metadata, forms, query parameters, or client code.
- If a role-change guard trigger is used, permit role changes only in the trusted database-owner context or a future narrowly scoped admin-only database function. Confirm the actual function owner/execution context in the local Supabase database rather than guessing.
- Audit privileged role changes where technically possible. A manual database-owner change may have a null application `actor_id`; document this limitation.

### Stock protection — critical
Stock may change only through trusted database functions. Never update stock directly from a Server Action, Route Handler, browser client, or ordinary SQL client role.

Implement:
1. `public.adjust_stock(...)` — authenticated staff/admin RPC for receiving stock or making a permitted adjustment. It must check `auth.uid()` and staff authorization, validate the variant/reason/change, prevent negative stock, update stock, and append a movement in the same transaction.
2. A private helper such as `private.apply_stock_movement(...)` — used only by trusted database functions such as `adjust_stock`, `place_order`, and order cancellation. It must not be directly executable by `anon` or `authenticated` clients. Derive `created_by` from `auth.uid()`; do not accept an actor ID parameter.
3. The private helper must lock the relevant variant row, reject zero changes, prevent stock below zero, update the stock value, and insert exactly one matching `stock_movements` row in the same transaction.

Enforce stock protection at more than one level:
- Revoke table-level `INSERT`/`UPDATE` privileges on `product_variants` from application roles before granting the minimum column-level privileges.
- Grant staff only the columns required to create/edit variant details. Do not grant `INSERT(stock)` or `UPDATE(stock)` to `anon` or `authenticated`.
- New variants must use the database default stock of zero. Staff cannot set initial stock by supplying the stock column in a direct insert.
- Add a defensive trigger that rejects stock changes unless the update is running in the trusted database-function owner context. Do not use a client-settable custom session variable/GUC as proof of authorization.
- Ensure the trusted stock functions execute under the specific database owner role allowed by the trigger, and test that the trigger permits those functions but rejects direct authenticated/anon writes. If the execution context cannot be verified, stop and explain the blocker instead of weakening the check.
- Separate `SELECT`, `INSERT`, and `UPDATE` policies; do not use an unrestricted `FOR ALL` policy for variants.

### Stock movement and audit log protection
- `stock_movements` and `audit_log` are append-only.
- No application role can update or delete these records.
- Only trusted functions/triggers may insert stock movement or audit rows.
- Staff may read stock movement history. Admins may read audit records as needed.

### RLS policy design
- Enable RLS on every application table.
- Use explicit policies for `anon` and `authenticated` where public catalogue access differs from staff access.
- Example: anonymous users can select active categories/products/variants only. Authenticated users can select active catalogue rows, plus inactive rows only when `private.is_staff()` is true.
- Staff write policies must be explicitly scoped to `authenticated` and check staff authorization.
- Customers can read only their own profile and orders. Staff can read the operational data required for their job. Customers must not read suppliers, stock movement logs, audit logs, or other admin-only data.
- Supplier read access may be granted to staff who need to select suppliers for stock receiving; supplier create/edit is admin-only.
- Customers have no direct update permission on orders. Order state changes must go through trusted database functions.
- Use `security_invoker = true` for views that are intended to obey underlying table RLS. Do not create a view that accidentally bypasses RLS.
- Verify database grants as well as RLS policies. A hidden button is never security.

## 8. Orders and checkout architecture (Levels 8–9)

### Order placement
Implement a single public RPC function such as `public.place_order(...)` that performs the entire checkout in **one PostgreSQL transaction**.

It must:
1. Be callable by `anon` (guest checkout). Do **not** derive the customer from `auth.uid()`; customer identity is supplied per order as name, phone, optional email, complete address, city, product requirements and notes, and is revalidated server-side.
2. Validate every guest field (including optional email format and text lengths) and normalize the Pakistani phone number.
3. Validate the items input, duplicate variant IDs, quantity limits, and maximum number of lines.
4. Lock all requested variant rows in a consistent order (for example, ascending variant ID with `FOR UPDATE`) to reduce deadlocks.
5. Verify every variant and product is active and each requested quantity is available.
6. Read current prices and product/variant labels from the database, not the browser.
7. Calculate subtotal, shipping, discount, and total in the database using integer/bigint arithmetic.
8. Validate any coupon rules only when coupons are implemented.
9. Insert the order and its historical order-item snapshots.
10. Reduce stock through the private stock helper, writing `sale` stock movements linked to the order.
11. Commit all changes together. Any failure must roll back the order, items, stock changes, and movement rows.

The function must be safe against two customers trying to purchase the final unit at the same time. Locking and stock validation must happen inside the same transaction.

### Idempotency
- Require a client-generated UUID idempotency key for checkout.
- Enforce `UNIQUE(idempotency_key)` globally, because a guest has no `user_id`.
- A repeated request with the same key and same normalized payload returns the existing order rather than creating a duplicate.
- If the same key is reused with a different normalized payload, return a clear conflict error rather than returning an unrelated order.
- Handle concurrent duplicate submissions safely using the database uniqueness constraint and transaction logic.

### Order status and verification
Allowed statuses (admin-managed only):
- `pending`
- `contacted`
- `verified`
- `processing`
- `shipped`
- `delivered`
- `cancelled`

Enforce transitions in database functions, not direct table updates:
- New guest orders always start at `pending`. Never display a new order as confirmed.
- Normal progress: `pending → contacted → verified → processing → shipped → delivered`.
- `cancelled` is reachable from `pending`, `contacted`, `verified` and `processing` only. Delivered orders are final.
- Only staff/admin may read, list, search or transition orders. Guests get no order lookup RPC and no self-cancellation.
- A cancellation must lock the order, verify its current state and authorization, transition it once, and restore stock through the private helper with `return` movements.
- Cancellation must be atomic and idempotent; repeated cancellation must not restore stock more than once.
- No application role has direct `UPDATE` privilege on orders. All status changes go through `public.transition_order_status`.

### Checkout rules
- Payment method in v1: **Cash on Delivery (COD) only**. Do not add a payment gateway.
- Shipping charge is configurable in one documented server-side configuration source and defaults to free (`0` paisa). Store the actual shipping amount on the order.
- Discount defaults to zero in guest checkout. The coupon feature remains in the database for admin use but is hidden in the guest storefront because it required a customer account.
- Validate all server inputs with Zod before calling the database RPC, and validate critical business rules again inside the database function.
- Map known database error codes (for example, out of stock, invalid quantity, inactive variant, idempotency conflict) to friendly customer messages. Never return raw SQL/database errors to the browser.

## 9. Application security and code quality

### Authentication and authorization
- Use Supabase SSR browser/server clients with the current supported `@supabase/ssr` pattern. Verify version-sensitive cookie APIs against official docs.
- On the server, verify the authenticated user using `supabase.auth.getUser()`. Do not trust an unverified client session or user ID sent by the browser.
- Protect `/admin` with three layers: Next.js Proxy for session refresh/preliminary redirect, a server-side admin layout/guard, and database RLS/privileges.
- Proxy is not the final authorization check. Every Server Action and Route Handler must independently call `getUser()`, validate input with Zod, and check the required role before performing work. The database must enforce permissions again.
- Use `requireUser()`, `requireStaff()`, and `requireAdmin()` helpers where appropriate, but do not rely on UI-only checks.

### Validation and error handling
- Validate every Server Action, Route Handler, and untrusted RPC input with Zod on the server.
- Validate IDs, strings, lengths, quantities, phone numbers, prices, and file metadata.
- Return safe, friendly error messages. Log useful technical details server-side without secrets or unnecessary customer data.
- Never render raw database errors, stack traces, credentials, or internal SQL details to customers.

### Cart
- The cart may be stored client-side (localStorage or a secure cookie) because it is not authoritative.
- Revalidate all variant IDs, active status, prices, and stock on the server at checkout.
- Show a clear message if a price or stock value changed after the item was added.
- Checkout requires login.
- Never store trusted prices or stock as authoritative client values.

### Images and file uploads
- Use a Supabase Storage bucket named `product-images` or another documented consistent name.
- Allow only JPEG, PNG, and WebP. Do not allow SVG uploads.
- Apply a reasonable file-size limit.
- Public read is allowed for the public product image bucket; write/update/delete is staff-only through Storage RLS policies.
- Configure Next.js `images.remotePatterns` for the exact Supabase Storage host used by the project. Do not use broad wildcards unnecessarily.
- Validate MIME type and size on the server as well as in the UI.
- Do not trust a filename extension alone.

### Code quality
- TypeScript strict mode.
- Avoid `any`; if unavoidable, explain and isolate it.
- Generate Supabase database types from the migrations/schema and use them in the app.
- Prefer Server Components for data loading. Use `"use client"` only for interactive UI that requires it.
- Separate database access, business logic, validation, and presentation.
- Create reusable components without overengineering.
- Include loading, empty, error, and success states.
- Implement server-side pagination for tables and product lists; do not load entire tables unnecessarily.
- Define caching and revalidation behavior after admin edits using the current supported Next.js APIs (`revalidatePath`, tags, or equivalent).
- Keep accessibility in mind: semantic HTML, labelled fields, keyboard navigation, visible focus, alt text, accessible dialogs, and sufficient contrast.

## 10. UI/UX requirements

Create a polished, modern, premium commercial shopping experience, not a basic classroom demo.

Visual direction:
- White/light neutral backgrounds.
- One consistent accent color.
- Strong, readable typography.
- Clean spacing and visual hierarchy.
- Consistent border radius and subtle shadows.
- Restrained hover/transition effects.
- Professional product cards and image presentation.
- Consistent design language across customer store and admin panel.

Responsive requirements:
- Desktop, laptop, tablet, and mobile.
- No horizontal overflow on mobile.
- Responsive navigation and admin sidebar.
- Touch-friendly controls.

Accessibility:
- Semantic HTML.
- Proper labels and validation messages.
- Keyboard-accessible menus/dialogs.
- Visible focus states.
- Descriptive image alt text.
- Good color contrast.

### Customer store pages

**Header**
- Store logo/name.
- Home and Products links.
- Categories dropdown.
- Search.
- Cart icon and item count.
- No login/signup or account menu: checkout is guest-only.

**Homepage**
- Hero section.
- Featured categories.
- Featured products driven by `is_featured`.
- Latest products.
- Promotional banners (static content is acceptable in v1).
- Footer.

**Products listing**
- Product grid.
- Search.
- Category filters.
- Price filters.
- Availability filters.
- Sorting.
- Server-side pagination.

**Product details**
- Product image gallery.
- Product name, brand, and description.
- Dynamic variant selector based on category schema.
- Effective variant price and sale price where applicable.
- Availability/stock indication.
- Quantity selector.
- Add-to-cart action.
- Related products from the same category.

**Cart and checkout**
- Cart items with images, selected attributes, quantity, and current price.
- Quantity update/remove controls.
- Subtotal, shipping, discount, and total.
- Checkout with name, Pakistani phone, city, delivery address, and COD selection.
- Place order action with clear pending/success/error states.

**Customer account**
- Profile information.
- My orders.
- Order detail and status.
- Cancel pending order.

### Admin panel

Admin routes live under `/admin` and must be role-protected.

Sidebar:
1. Dashboard
2. Categories
3. Products
4. Inventory
5. Suppliers
6. Orders
7. Customers (read-only)
8. Reports

Do not add a Settings page in v1 unless a real settings feature is approved.

**Dashboard**
- Total sales.
- Total orders.
- Pending orders.
- Confirmed orders.
- Total active products/variants.
- Low-stock variants.
- Recent orders.
- Sales overview.
- Top-selling products when sufficient order data exists.

Use real database data. Do not show invented/hardcoded business statistics in the completed dashboard.

**Category management**
- Create/edit and activate/deactivate categories.
- Create parent and child categories.
- Edit attribute schema with inheritance rules.
- Prevent category cycles and destructive schema changes.

**Product management**
- Product list, create/edit, activate/deactivate.
- Multi-image uploads.
- Dynamic variant form from category schema.
- SKU, price, sale price, and reorder level management.
- Variant stock is displayed but never edited directly in the product form.

**Inventory**
- Variant/SKU, product, attributes, current stock, reorder level, low-stock status.
- Receive stock, adjust stock, and view movement history.
- Supplier selection and supplier management according to role permissions.
- Low-stock report where `stock <= reorder_level`.

**Orders and customers**
- Order list and detail.
- Allowed status transitions.
- Customer information read-only for staff where required.
- Invoice view using historical order-item snapshots.

## 11. Folder structure

Use a clean, maintainable structure consistent with Next.js App Router. Adapt only when necessary and explain meaningful deviations.

```text
everynest/
├── src/
│   ├── app/
│   │   ├── (store)/
│   │   │   ├── page.tsx
│   │   │   ├── products/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   └── checkout/page.tsx
│   │   ├── (auth)/
│   │   │   └── login/page.tsx   (admin-only)
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── categories/
│   │   │   ├── products/
│   │   │   ├── inventory/
│   │   │   ├── suppliers/
│   │   │   ├── orders/
│   │   │   ├── customers/
│   │   │   └── reports/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── store/
│   │   ├── admin/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── proxy.ts
│   │   ├── auth.ts
│   │   ├── money.ts
│   │   ├── validators.ts
│   │   └── utils.ts
│   ├── types/
│   │   └── database.types.ts
│   └── proxy.ts
├── supabase/
│   ├── migrations/
│   ├── tests/
│   └── config.toml
├── public/
├── .env.example
├── .gitignore
├── AGENTS.md
└── package.json
```

If the installed Next.js project uses a different valid root/src convention, follow the actual project convention and explain it. Do not create duplicate app or proxy files.

## 12. Testing and quality requirements

Tests are part of the implementation, not an optional final decoration.

### Unit tests
Use Vitest for:
- Money formatting/calculations.
- Zod validators.
- Attribute-schema validation and inheritance logic.
- Cart calculations that are safe to perform client-side (never authoritative checkout totals).

### Database/security tests
Use Supabase local database testing/pgTAP where appropriate to verify:
- Anonymous users can read active public catalogue data only.
- Customers cannot read other customers' profiles or orders.
- Customers cannot read supplier/admin/audit/stock-movement data.
- Customers cannot change their role.
- Authenticated staff cannot directly insert/update variant stock.
- Anonymous and authenticated users cannot execute private stock helpers.
- Staff can execute permitted stock RPCs; customers cannot.
- Stock never becomes negative.
- Stock movement/audit records cannot be updated or deleted by application roles.
- Role and category constraints behave correctly.

### Order integration tests (Levels 8–9)
Test:
- Concurrent attempts to buy the final unit: only valid stock can be sold.
- Order and stock rollback if any part of placement fails.
- Repeated idempotency key does not create duplicate orders.
- Reusing an idempotency key with a different payload is rejected.
- Customer cancellation restores stock exactly once.
- Invalid order status transition is rejected.
- Historical order snapshots do not change after product/variant edits.

### End-to-end test
Use Playwright for one complete flow when the required services/test accounts are available:
`browse product → select variant → add to cart → guest checkout → admin sees and verifies order`.

### Final CI checks (Level 12)
Configure GitHub Actions for:
- Lint.
- Type checking.
- Unit tests.
- Database tests where CI services are available.
- Playwright flow where test environment is configured.
- Production dependency audit such as `npm audit --omit=dev`.

Do not claim end-to-end or database security coverage unless the relevant tests actually ran against a representative test environment.

## 13. Out of scope for version 1

Do not implement these in the core build unless separately approved:
- Online card/payment gateway.
- Delivery partner integration.
- Multi-vendor sellers/marketplace.
- Email/SMS/WhatsApp notifications.
- Multi-currency.
- Multi-language UI.
- Complex ERP/accounting integrations.

The only payment method in v1 is Cash on Delivery.

## 14. Supabase development and deployment safety

- Prefer local Supabase development with the CLI when Docker-compatible tooling is available.
- If Docker/local Supabase is unavailable, create valid migrations and explain what could not be executed. Do not pretend the database was tested.
- Keep migrations in version control.
- Keep separate development and production Supabase projects.
- Before applying migrations to a hosted project, verify the linked project reference and environment.
- Preview remote changes with the current CLI's supported dry-run option before applying them.
- Do not run remote resets against production. A remote reset is destructive and must never be used as a routine fix.
- Do not apply a migration to production without explicit owner approval.
- Generate TypeScript database types from the schema after migrations change.
- Verify current official Supabase and Next.js documentation when an API, CLI command, or framework convention is uncertain. Do not copy outdated examples blindly.

Official documentation starting points:
- Next.js Proxy: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Supabase database functions: https://supabase.com/docs/guides/database/functions
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth user profiles: https://supabase.com/docs/guides/auth/managing-user-data
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase CLI migrations: https://supabase.com/docs/guides/local-development/database-migrations
- Supabase API key migration: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys

## 15. Development roadmap — strict one-level-at-a-time process

Do not skip levels, merge multiple levels, or automatically continue after completing a level.

### Level 1 — Project setup and secure database foundation
- Inspect workspace and existing code first.
- Initialize/configure Next.js App Router, TypeScript strict mode, and Tailwind CSS v4.
- Preserve the existing package manager and lockfile.
- Install only approved required dependencies.
- Create Supabase browser/server clients using current SSR guidance.
- Configure `.env.example`, `.gitignore`, and environment validation.
- Initialize Supabase CLI configuration and numbered migrations.
- Create Level 1 tables: profiles, categories, products, product_images, product_variants, suppliers, stock_movements, and audit_log.
- Create private schema, authorization helpers, signup trigger, stock helper, stock RPC, permissions, grants, RLS, defensive stock protection, relevant indexes, and initial Storage bucket policies.
- Keep order tables for Level 8; add the stock movement order foreign key in the Level 8 migration.
- Generate database TypeScript types.
- Explain the first-admin bootstrap process and how local/dev Supabase setup works.
- Critically explain the separation between staff stock adjustment and future customer checkout stock changes. Do not weaken staff authorization to make checkout possible.

Deliverable: A clean application foundation and a secure, migration-based core database.

### Level 2 — Authentication (superseded for customers by the guest-checkout change)
- Supabase session, admin-only login and logout; profile creation via auth trigger still exists for admin accounts.
- The customer signup, profile, account, wishlist and order-history pages were removed. Customer contact details are now collected per order at checkout.
- Secure server-side session verification still protects every admin page and action.

Deliverable: Admin authentication plus guest checkout (no customer accounts).

### Level 3 — Admin shell and access control
- Responsive admin layout, sidebar, header, and navigation.
- `proxy.ts` session refresh/preliminary protection.
- Server-side role checks for staff/admin.
- Verify a customer cannot enter admin pages or invoke admin actions.

Deliverable: Secure admin dashboard shell.

### Level 4 — Category management
- Category list/create/edit/activate/deactivate.
- Parent/child categories.
- Attribute schema editor.
- Attribute inheritance and validation.
- Category cycle prevention.
- Prevent destructive schema changes once variants depend on a schema.

Deliverable: Dynamic category and attribute management.

### Level 5 — Product and variant management
- Product list/create/edit/activate/deactivate.
- Product image upload and ordering.
- Dynamic variant form based on selected category schema.
- SKU and attribute validation.
- Regular/sale prices and reorder level.
- Display stock, but do not directly edit stock in the product form.

Deliverable: Complete catalogue management.

### Level 6 — Inventory and suppliers
- Stock overview and low-stock list.
- Receive stock and make permitted stock adjustments through database RPCs.
- Supplier list/read for staff; supplier create/edit for admin.
- Stock movement history.
- Verify no direct stock update is possible from application roles.

Deliverable: Secure inventory management.

### Level 7 — Public storefront
- Homepage and category navigation.
- Product listing, search, filters, sorting, and server pagination.
- Product details and image gallery.
- Dynamic variant selector.
- Effective price and stock availability.
- Add to cart.

Deliverable: Working storefront connected to real catalogue data.

### Level 8 — Cart, checkout, and atomic order placement
- Cart persistence and server revalidation.
- Create orders/order_items schema and relevant indexes.
- Add order foreign key to stock movements.
- Implement COD checkout.
- Implement `place_order` transaction, row locking, idempotency, historical snapshots, and atomic stock reduction through the private helper.
- Test concurrency and transaction rollback.

Deliverable: Customers can place valid COD orders safely.

### Level 9 — Customer and admin order management
- Customer order list/detail.
- Customer cancellation of pending orders.
- Admin/staff order list/detail.
- Secure status transitions.
- Cancellation and stock restoration.
- Invoice view using historical snapshots.

Deliverable: Complete order lifecycle management.

### Level 10 — Reports and dashboard data
- Real sales and order statistics.
- Top-selling products.
- Low-stock report.
- Recent orders.
- Sales over time using Asia/Karachi reporting boundaries.
- Efficient SQL views/functions with safe RLS behavior and pagination where required.

Deliverable: Data-driven admin dashboard and reports.

### Level 11 — Optional features
Only after core functionality is stable:
- Coupons.
- Product reviews.
- Wishlist.
- Saved delivery addresses.

Each optional feature requires proper schema, validation, authorization, RLS, tests, and a separate approval before implementation.

### Level 12 — Final testing, security review, and deployment
- Run all type, lint, unit, database, and end-to-end tests available.
- Review all RLS policies, table/column grants, RPC permissions, Storage policies, and role boundaries.
- Test race conditions and idempotency.
- Test mobile/tablet/desktop UI and accessibility.
- Review environment variables and secret handling.
- Configure CI workflow.
- Prepare Vercel deployment and production Supabase configuration.
- Apply production migrations only after explicit approval and a reviewed migration plan.
- Document deployment, rollback, backups, and maintenance steps.

Deliverable: A tested, secure, deployable EveryNest application.

## 16. Definition of done for every level

A level is complete only when:
- The agreed scope for that level is implemented.
- The application runs for the implemented scope, subject to documented external setup.
- TypeScript and lint checks pass, or every remaining failure is clearly identified with its cause.
- Relevant tests exist and pass in the environment where they can be run.
- Correct roles can access the feature and unauthorized roles are blocked at the database level where database resources are involved.
- No secrets are exposed and no security rule was weakened.
- Loading, empty, success, and error states are implemented where applicable.
- The owner has received exact files changed, commands/results, manual setup steps, and a short manual test checklist.
- You have STOPPED and are waiting for explicit approval before the next level.

## 17. First task when this file is read

When asked to start the project:

1. Read this entire `AGENTS.md`.
2. Inspect the current workspace and Git/package-manager state.
3. Briefly explain the planned architecture and any blockers.
4. Begin **Level 1 only**.
5. Before creating database security functions/triggers, explain any important execution-context assumptions and verify them using the local Supabase database where possible.
6. Implement Level 1, run the checks that are actually available, and report truthful results.
7. Clearly list the Supabase steps the owner must complete manually. Never ask for secrets in chat.
8. Stop after Level 1 and wait for explicit approval.

**Final objective:** Build EveryNest as a secure, maintainable, professional full-stack e-commerce application while helping the owner understand the software engineering decisions behind it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

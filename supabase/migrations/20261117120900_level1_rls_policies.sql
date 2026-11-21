-- =============================================================================
-- EveryNest - Level 1
-- 0010: Row Level Security policies
-- =============================================================================
-- Rules:
--   * RLS is enabled on every application table.
--   * Anonymous visitors only read active catalogue rows.
--   * Staff/admin see the full catalogue (needed to manage inactive records).
--   * Customers read their own profile only.
--   * No client INSERT/UPDATE/DELETE policies exist for stock_movements or
--     audit_log: they are append-only.
--   * There is no DELETE policy for categories/products/variants/suppliers:
--     records are archived with is_active = false.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_staff
  on public.profiles
  for select
  to authenticated
  using (private.is_staff());

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
alter table public.categories enable row level security;

create policy categories_select_public
  on public.categories
  for select
  to anon, authenticated
  using (is_active);

create policy categories_select_staff
  on public.categories
  for select
  to authenticated
  using (private.is_staff());

create policy categories_insert_staff
  on public.categories
  for insert
  to authenticated
  with check (private.is_staff());

create policy categories_update_staff
  on public.categories
  for update
  to authenticated
  using (private.is_staff())
  with check (private.is_staff());

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;

create policy products_select_public
  on public.products
  for select
  to anon, authenticated
  using (is_active);

create policy products_select_staff
  on public.products
  for select
  to authenticated
  using (private.is_staff());

create policy products_insert_staff
  on public.products
  for insert
  to authenticated
  with check (private.is_staff());

create policy products_update_staff
  on public.products
  for update
  to authenticated
  using (private.is_staff())
  with check (private.is_staff());

-- -----------------------------------------------------------------------------
-- product_images
-- Public read only for images of active products.
-- -----------------------------------------------------------------------------
alter table public.product_images enable row level security;

create policy product_images_select_public
  on public.product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_images.product_id
        and p.is_active
    )
  );

create policy product_images_select_staff
  on public.product_images
  for select
  to authenticated
  using (private.is_staff());

create policy product_images_insert_staff
  on public.product_images
  for insert
  to authenticated
  with check (private.is_staff());

create policy product_images_update_staff
  on public.product_images
  for update
  to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create policy product_images_delete_staff
  on public.product_images
  for delete
  to authenticated
  using (private.is_staff());

-- -----------------------------------------------------------------------------
-- product_variants
-- Public read only for active variants of active products.
-- -----------------------------------------------------------------------------
alter table public.product_variants enable row level security;

create policy product_variants_select_public
  on public.product_variants
  for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.products p
      where p.id = product_variants.product_id
        and p.is_active
    )
  );

create policy product_variants_select_staff
  on public.product_variants
  for select
  to authenticated
  using (private.is_staff());

create policy product_variants_insert_staff
  on public.product_variants
  for insert
  to authenticated
  with check (private.is_staff());

create policy product_variants_update_staff
  on public.product_variants
  for update
  to authenticated
  using (private.is_staff())
  with check (private.is_staff());

-- -----------------------------------------------------------------------------
-- suppliers (staff read, admin write)
-- -----------------------------------------------------------------------------
alter table public.suppliers enable row level security;

create policy suppliers_select_staff
  on public.suppliers
  for select
  to authenticated
  using (private.is_staff());

create policy suppliers_insert_admin
  on public.suppliers
  for insert
  to authenticated
  with check (private.is_admin());

create policy suppliers_update_admin
  on public.suppliers
  for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- -----------------------------------------------------------------------------
-- stock_movements: staff read only, appended exclusively by trusted functions
-- -----------------------------------------------------------------------------
alter table public.stock_movements enable row level security;

create policy stock_movements_select_staff
  on public.stock_movements
  for select
  to authenticated
  using (private.is_staff());

-- -----------------------------------------------------------------------------
-- audit_log: admin read only, appended by triggers/trusted functions
-- -----------------------------------------------------------------------------
alter table public.audit_log enable row level security;

create policy audit_log_select_admin
  on public.audit_log
  for select
  to authenticated
  using (private.is_admin());

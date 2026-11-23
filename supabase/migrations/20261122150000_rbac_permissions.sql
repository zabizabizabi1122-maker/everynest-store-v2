-- =============================================================================
-- EveryNest - Role-based admin permissions
-- =============================================================================
-- Explicit modern RBAC model:
--   * customer  - storefront visitor, no admin access
--   * admin     - staff account with only the permissions granted to it
--   * super_admin - owns the site and every administrative account
--
-- Existing data is migrated, not deleted:
--   admin -> super_admin, staff -> admin.
--
-- Super Admin permissions are implicit; Admin permissions come from role
-- defaults plus individual grants. Every decision is enforced by trusted
-- database helpers and re-checked in Server Actions, never by hidden UI alone.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profiles: new role values and active flag
-- -----------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles set role = 'super_admin' where role = 'admin';
update public.profiles set role = 'admin'      where role = 'staff';

alter table public.profiles
  add column is_active boolean not null default true,
  add constraint profiles_role_check
    check (role in ('customer', 'admin', 'super_admin'));

comment on column public.profiles.role is
  'Application role. super_admin is implicit full access; admin receives explicit permissions.';
comment on column public.profiles.is_active is
  'Inactive administrative accounts are rejected on login and by every authorization helper.';

-- -----------------------------------------------------------------------------
-- 2. Permission catalogue and grants
-- -----------------------------------------------------------------------------
create table public.permissions (
  key         text primary key
              check (key ~ '^[a-z][a-z0-9_.]*$'),
  label       text not null,
  description text,
  category    text not null default 'general',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role           text not null check (role in ('admin', 'super_admin')),
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role, permission_key)
);

create table public.admin_permissions (
  admin_id       uuid not null references public.profiles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  granted_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  primary key (admin_id, permission_key)
);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.admin_permissions enable row level security;

revoke all on table public.permissions, public.role_permissions, public.admin_permissions
  from anon, authenticated;

insert into public.permissions (key, label, description, category) values
  ('dashboard.view',     'View dashboard',      'Open the admin dashboard overview.', 'dashboard'),
  ('categories.view',    'View categories',     'Browse the category tree in admin.', 'catalogue'),
  ('categories.manage',  'Manage categories',   'Create and edit categories and attribute schemas.', 'catalogue'),
  ('categories.delete',  'Delete categories',   'Permanently delete unused categories.', 'catalogue'),
  ('products.view',      'View products',       'Browse the product list in admin.', 'catalogue'),
  ('products.manage',    'Manage products',     'Create, edit, archive and manage product images.', 'catalogue'),
  ('products.delete',    'Delete products',     'Permanently delete products with no sales history.', 'catalogue'),
  ('inventory.view',     'View inventory',      'Browse stock levels and movements.', 'catalogue'),
  ('inventory.manage',   'Adjust inventory',    'Record stock adjustments.', 'catalogue'),
  ('suppliers.view',     'View suppliers',      'Browse supplier records.', 'catalogue'),
  ('suppliers.manage',   'Manage suppliers',    'Create and edit suppliers.', 'catalogue'),
  ('orders.view',        'View orders',         'List and inspect customer orders.', 'orders'),
  ('orders.manage',      'Manage orders',       'Contact customers and transition order statuses.', 'orders'),
  ('customers.view',     'View customers',      'Browse the customer directory.', 'customers'),
  ('reports.view',       'View reports',        'Open reports and analytics.', 'reports'),
  ('coupons.view',       'View coupons',        'Browse discount codes.', 'marketing'),
  ('coupons.manage',     'Manage coupons',      'Create and toggle discount codes.', 'marketing'),
  ('reviews.view',       'View reviews',        'Browse product reviews.', 'marketing'),
  ('reviews.manage',     'Moderate reviews',    'Approve or reject product reviews.', 'marketing'),
  ('filters.view',       'View filters',        'Browse storefront filter configuration.', 'website'),
  ('filters.manage',     'Manage filters',      'Create, edit and toggle storefront filters.', 'website'),
  ('settings.view',      'View website settings','Browse promo, contact, social and hero settings.', 'website'),
  ('settings.manage',    'Manage website settings','Edit promo, contact, social and hero content.', 'website'),
  ('admins.view',        'View admin accounts', 'Browse administrator accounts.', 'administration'),
  ('admins.manage',      'Manage admin accounts','Create, edit, reset and remove administrators.', 'administration')
on conflict (key) do nothing;

-- Safe defaults for a new Admin. Super Admin is implicit and needs no rows.
insert into public.role_permissions (role, permission_key)
select 'admin', key
from public.permissions
where key in (
  'dashboard.view', 'categories.view', 'categories.manage',
  'products.view', 'products.manage',
  'inventory.view', 'inventory.manage',
  'suppliers.view', 'suppliers.manage',
  'orders.view', 'orders.manage',
  'customers.view', 'reports.view',
  'coupons.view', 'coupons.manage',
  'reviews.view', 'reviews.manage',
  'filters.view', 'settings.view'
)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 3. Authorization helpers
-- -----------------------------------------------------------------------------
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role in ('admin', 'super_admin')
  );
$$;

-- Broad "may open the admin area" check. Specific mutations use has_permission.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role = 'super_admin'
  );
$$;

create or replace function private.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_permission_key is not null
    and (
      -- Super Admin is implicit full access, including future permissions.
      (select private.is_super_admin())
      or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.is_active
          and p.role = 'admin'
          and (
            exists (
              select 1
              from public.role_permissions rp
              join public.permissions pm on pm.key = rp.permission_key
              where rp.role = 'admin'
                and rp.permission_key = p_permission_key
                and pm.is_active
            )
            or exists (
              select 1
              from public.admin_permissions ap
              join public.permissions pm on pm.key = ap.permission_key
              where ap.admin_id = p.id
                and ap.permission_key = p_permission_key
                and pm.is_active
            )
          )
      )
    );
$$;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_super_admin() from public, anon;
revoke all on function private.has_permission(text) from public, anon;

grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.has_permission(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Current admin's effective access (single trusted call for the UI)
-- -----------------------------------------------------------------------------
create or replace function public.get_my_admin_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role        text;
  v_permissions jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  select p.role
    into v_role
    from public.profiles p
   where p.id = (select auth.uid())
     and p.is_active;

  if v_role not in ('admin', 'super_admin') then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  if v_role = 'super_admin' then
    select coalesce(
      jsonb_agg(pm.key order by pm.key),
      '[]'::jsonb
    )
      into v_permissions
      from public.permissions pm
     where pm.is_active;
  else
    select coalesce(
      jsonb_agg(keys.key order by keys.key),
      '[]'::jsonb
    )
      into v_permissions
      from (
        select rp.permission_key as key
          from public.role_permissions rp
          join public.permissions pm on pm.key = rp.permission_key
         where rp.role = 'admin' and pm.is_active
        union
        select ap.permission_key as key
          from public.admin_permissions ap
          join public.permissions pm on pm.key = ap.permission_key
         where ap.admin_id = (select auth.uid()) and pm.is_active
      ) as keys;
  end if;

  return jsonb_build_object(
    'role', v_role,
    'isSuperAdmin', v_role = 'super_admin',
    'permissions', v_permissions
  );
end;
$$;

revoke all on function public.get_my_admin_access() from public, anon;
grant execute on function public.get_my_admin_access() to authenticated;

comment on function public.get_my_admin_access() is
  'Effective admin role and permission keys for the signed-in administrator.';

-- -----------------------------------------------------------------------------
-- 5. Protect the last active Super Admin from deactivation
-- -----------------------------------------------------------------------------
create or replace function private.guard_profile_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'super_admin'
     and old.is_active
     and (new.is_active is distinct from old.is_active)
     and not new.is_active
     and (
       select count(*)
       from public.profiles p
       where p.role = 'super_admin' and p.is_active
     ) <= 1
  then
    raise exception 'The last active Super Admin cannot be deactivated'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_profile_deactivation() from public, anon, authenticated;

drop trigger if exists guard_profile_deactivation on public.profiles;
create trigger guard_profile_deactivation
  before update on public.profiles
  for each row execute function private.guard_profile_deactivation();

-- -----------------------------------------------------------------------------
-- 6. Tighten existing RLS to permission keys
-- -----------------------------------------------------------------------------
drop policy if exists categories_insert_staff on public.categories;
create policy categories_insert_staff
  on public.categories for insert to authenticated
  with check (private.has_permission('categories.manage'));

drop policy if exists categories_update_staff on public.categories;
create policy categories_update_staff
  on public.categories for update to authenticated
  using (private.has_permission('categories.manage'))
  with check (private.has_permission('categories.manage'));

drop policy if exists products_insert_staff on public.products;
create policy products_insert_staff
  on public.products for insert to authenticated
  with check (private.has_permission('products.manage'));

drop policy if exists products_update_staff on public.products;
create policy products_update_staff
  on public.products for update to authenticated
  using (private.has_permission('products.manage'))
  with check (private.has_permission('products.manage'));

drop policy if exists product_images_insert_staff on public.product_images;
create policy product_images_insert_staff
  on public.product_images for insert to authenticated
  with check (private.has_permission('products.manage'));

drop policy if exists product_images_update_staff on public.product_images;
create policy product_images_update_staff
  on public.product_images for update to authenticated
  using (private.has_permission('products.manage'))
  with check (private.has_permission('products.manage'));

drop policy if exists product_images_delete_staff on public.product_images;
create policy product_images_delete_staff
  on public.product_images for delete to authenticated
  using (private.has_permission('products.manage'));

drop policy if exists product_variants_insert_staff on public.product_variants;
create policy product_variants_insert_staff
  on public.product_variants for insert to authenticated
  with check (private.has_permission('products.manage'));

drop policy if exists product_variants_update_staff on public.product_variants;
create policy product_variants_update_staff
  on public.product_variants for update to authenticated
  using (private.has_permission('products.manage'))
  with check (private.has_permission('products.manage'));

drop policy if exists suppliers_insert_admin on public.suppliers;
create policy suppliers_insert_admin
  on public.suppliers for insert to authenticated
  with check (private.has_permission('suppliers.manage'));

drop policy if exists suppliers_update_admin on public.suppliers;
create policy suppliers_update_admin
  on public.suppliers for update to authenticated
  using (private.has_permission('suppliers.manage'))
  with check (private.has_permission('suppliers.manage'));

drop policy if exists coupons_insert_admin on public.coupons;
create policy coupons_insert_admin
  on public.coupons for insert to authenticated
  with check (private.has_permission('coupons.manage'));

drop policy if exists coupons_update_admin on public.coupons;
create policy coupons_update_admin
  on public.coupons for update to authenticated
  using (private.has_permission('coupons.manage'))
  with check (private.has_permission('coupons.manage'));

drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin
  on public.audit_log for select to authenticated
  using (private.has_permission('reports.view'));

-- -----------------------------------------------------------------------------
-- 7. Permission-aware wrappers around trusted RPCs
-- -----------------------------------------------------------------------------
-- The original functions are retained as internal implementations. The public
-- names are wrappers that check the exact permission before delegating.
-- -----------------------------------------------------------------------------
alter function public.list_orders(integer, integer, text, text)
  rename to list_orders_internal;
revoke all on function public.list_orders_internal(integer, integer, text, text)
  from public, anon, authenticated;

create or replace function public.list_orders(
  p_page integer default 1,
  p_page_size integer default 20,
  p_status text default null,
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('orders.view') then
    raise exception 'Order view permission is required'
      using errcode = '42501';
  end if;

  return public.list_orders_internal(p_page, p_page_size, p_status, p_search);
end;
$$;

revoke all on function public.list_orders(integer, integer, text, text) from public, anon;
grant execute on function public.list_orders(integer, integer, text, text) to authenticated;

alter function public.get_order(uuid) rename to get_order_internal;
revoke all on function public.get_order_internal(uuid) from public, anon, authenticated;

create or replace function public.get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('orders.view') then
    raise exception 'Order view permission is required'
      using errcode = '42501';
  end if;

  return public.get_order_internal(p_order_id);
end;
$$;

revoke all on function public.get_order(uuid) from public, anon;
grant execute on function public.get_order(uuid) to authenticated;

alter function public.transition_order_status(uuid, text)
  rename to transition_order_status_internal;
revoke all on function public.transition_order_status_internal(uuid, text)
  from public, anon, authenticated;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_target_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('orders.manage') then
    raise exception 'Order management permission is required'
      using errcode = '42501';
  end if;

  return public.transition_order_status_internal(p_order_id, p_target_status);
end;
$$;

revoke all on function public.transition_order_status(uuid, text) from public, anon;
grant execute on function public.transition_order_status(uuid, text) to authenticated;

alter function public.get_reports_data(integer) rename to get_reports_data_internal;
revoke all on function public.get_reports_data_internal(integer) from public, anon, authenticated;

create or replace function public.get_reports_data(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('reports.view') then
    raise exception 'Report view permission is required'
      using errcode = '42501';
  end if;

  return public.get_reports_data_internal(p_days);
end;
$$;

revoke all on function public.get_reports_data(integer) from public, anon;
grant execute on function public.get_reports_data(integer) to authenticated;

alter function public.set_review_status(uuid, text) rename to set_review_status_internal;
revoke all on function public.set_review_status_internal(uuid, text)
  from public, anon, authenticated;

create or replace function public.set_review_status(
  p_review_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('reviews.manage') then
    raise exception 'Review moderation permission is required'
      using errcode = '42501';
  end if;

  perform public.set_review_status_internal(p_review_id, p_status);
end;
$$;

revoke all on function public.set_review_status(uuid, text) from public, anon;
grant execute on function public.set_review_status(uuid, text) to authenticated;

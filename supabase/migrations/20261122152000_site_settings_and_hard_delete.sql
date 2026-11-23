-- =============================================================================
-- EveryNest - Core website settings and guarded hard deletes
-- =============================================================================
-- Core-only content scope approved by the owner: promotional bar, contact and
-- social details, and hero slides. Logo and homepage copy stay hardcoded.
--
-- Hard delete is intentionally strictly guarded: products/categories referenced
-- by sales, stock history, child records or filter configuration cannot be
-- removed. Deletion is performed by trusted RPCs, never by direct table writes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Site settings
-- -----------------------------------------------------------------------------
create table public.site_settings (
  key        text primary key
             check (key in ('promo', 'contact', 'socials')),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.hero_slides (
  id             uuid primary key default gen_random_uuid(),
  eyebrow        text,
  title          text not null check (char_length(btrim(title)) between 1 and 160),
  description    text,
  image          text not null check (char_length(btrim(image)) between 1 and 500),
  image_alt      text,
  primary_label  text not null check (char_length(btrim(primary_label)) between 1 and 80),
  primary_href   text not null default '/products',
  secondary_label text,
  secondary_href text,
  display_order  integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint hero_slides_secondary_pair
    check (
      (secondary_label is null and secondary_href is null)
      or (secondary_label is not null and secondary_href is not null)
    )
);

create trigger set_site_settings_updated_at
  before update on public.site_settings
  for each row execute function private.set_updated_at();

create trigger set_hero_slides_updated_at
  before update on public.hero_slides
  for each row execute function private.set_updated_at();

alter table public.site_settings enable row level security;
alter table public.hero_slides enable row level security;

revoke all on table public.site_settings, public.hero_slides from anon, authenticated;

grant select on table public.site_settings to anon, authenticated;
grant select on table public.hero_slides to anon, authenticated;
grant insert, update, delete on table public.site_settings to authenticated;
grant insert, update, delete on table public.hero_slides to authenticated;

create policy site_settings_select_public
  on public.site_settings for select to anon, authenticated
  using (true);
create policy site_settings_insert_admin
  on public.site_settings for insert to authenticated
  with check (private.has_permission('settings.manage'));
create policy site_settings_update_admin
  on public.site_settings for update to authenticated
  using (private.has_permission('settings.manage'))
  with check (private.has_permission('settings.manage'));
create policy site_settings_delete_admin
  on public.site_settings for delete to authenticated
  using (private.has_permission('settings.manage'));

create policy hero_slides_select_public
  on public.hero_slides for select to anon, authenticated
  using (is_active);
create policy hero_slides_select_admin
  on public.hero_slides for select to authenticated
  using (private.has_permission('settings.view'));
create policy hero_slides_insert_admin
  on public.hero_slides for insert to authenticated
  with check (private.has_permission('settings.manage'));
create policy hero_slides_update_admin
  on public.hero_slides for update to authenticated
  using (private.has_permission('settings.manage'))
  with check (private.has_permission('settings.manage'));
create policy hero_slides_delete_admin
  on public.hero_slides for delete to authenticated
  using (private.has_permission('settings.manage'));

insert into public.site_settings (key, value) values
  ('promo', '{"message":"Free delivery over {amount}","shippingThresholdPaisa":300000,"enabled":true}'::jsonb),
  ('contact', '{"tagline":"EveryNest · Pakistan","note":"Nationwide delivery and cash on delivery on every order.","help":"Order help is available from our support team.","email":"","phone":"","whatsapp":"","address":""}'::jsonb),
  ('socials', '[{"label":"Instagram","url":"","icon":"instagram"},{"label":"Facebook","url":"","icon":"facebook"},{"label":"Twitter","url":"","icon":"twitter"}]'::jsonb)
on conflict (key) do nothing;

insert into public.hero_slides
  (eyebrow, title, description, image, image_alt, primary_label, primary_href,
   secondary_label, secondary_href, display_order, is_active)
values
  (
    'EveryNest · Pakistan',
    'Everyday essentials, picked for you.',
    'Explore clothes, stationery and shoes with clear prices and real-time availability. Choose your variant and add it to your cart in a tap.',
    '/products/canvas-backpack.jpg',
    'Everyday canvas backpack',
    'Shop all products', '/products',
    'Browse catalogue', '/products',
    10, true
  ),
  (
    'Style for every day',
    'Fresh fits, honest prices.',
    'From classic cotton shirts to everyday sneakers, find pieces that work hard without costing more.',
    '/products/cotton-shirt.jpg',
    'Classic cotton shirt',
    'Explore clothing', '/products',
    'View new arrivals', '/products?sort=newest',
    20, true
  ),
  (
    'Made for every desk',
    'Stationery that shows up.',
    'Notebooks, pens and desk essentials chosen for students, makers and anyone who likes a tidy workspace.',
    '/products/notebook.jpg',
    'Everyday notebook',
    'Shop stationery', '/products',
    'Browse catalogue', '/products',
    30, true
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. Guarded hard deletes
-- -----------------------------------------------------------------------------
create or replace function public.delete_product(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_sales   bigint;
  v_ledger  bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to delete a product'
      using errcode = '42501';
  end if;

  if not private.has_permission('products.delete') then
    raise exception 'Product deletion permission is required'
      using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'A valid product id is required'
      using errcode = '22023';
  end if;

  select p.* into v_product
  from public.products p
  where p.id = p_product_id;

  if not found then
    raise exception 'Product not found'
      using errcode = 'P0002';
  end if;

  select count(*) into v_sales
  from public.order_items oi
  join public.product_variants v on v.id = oi.variant_id
  where v.product_id = p_product_id;

  if v_sales > 0 then
    raise exception 'This product cannot be deleted because it appears in order history'
      using errcode = '23503';
  end if;

  select count(*) into v_ledger
  from public.stock_movements sm
  join public.product_variants v on v.id = sm.variant_id
  where v.product_id = p_product_id;

  if v_ledger > 0 then
    raise exception 'This product cannot be deleted because it has stock movement history'
      using errcode = '23503';
  end if;

  delete from public.product_images where product_id = p_product_id;
  delete from public.product_variants where product_id = p_product_id;
  delete from public.products where id = p_product_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()),
    'product.delete',
    'products',
    p_product_id::text,
    jsonb_build_object('name', v_product.name, 'slug', v_product.slug)
  );

  return jsonb_build_object('id', p_product_id, 'name', v_product.name);
end;
$$;

revoke all on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;

comment on function public.delete_product(uuid) is
  'Permission-checked hard delete. Refuses products referenced by orders or stock history.';

create or replace function public.delete_category(p_category_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.categories;
  v_children bigint;
  v_products bigint;
  v_filters  bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to delete a category'
      using errcode = '42501';
  end if;

  if not private.has_permission('categories.delete') then
    raise exception 'Category deletion permission is required'
      using errcode = '42501';
  end if;

  if p_category_id is null then
    raise exception 'A valid category id is required'
      using errcode = '22023';
  end if;

  select c.* into v_category
  from public.categories c
  where c.id = p_category_id;

  if not found then
    raise exception 'Category not found'
      using errcode = 'P0002';
  end if;

  select count(*) into v_children
  from public.categories c
  where c.parent_id = p_category_id;

  if v_children > 0 then
    raise exception 'This category cannot be deleted because it has subcategories'
      using errcode = '23503';
  end if;

  select count(*) into v_products
  from public.products p
  where p.category_id = p_category_id;

  if v_products > 0 then
    raise exception 'This category cannot be deleted because it still has products'
      using errcode = '23503';
  end if;

  select count(*) into v_filters
  from public.filter_categories fc
  where fc.category_id = p_category_id;

  if v_filters > 0 then
    raise exception 'This category cannot be deleted because it is assigned to a storefront filter'
      using errcode = '23503';
  end if;

  delete from public.categories where id = p_category_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()),
    'category.delete',
    'categories',
    p_category_id::text,
    jsonb_build_object('name', v_category.name, 'slug', v_category.slug)
  );

  return jsonb_build_object('id', p_category_id, 'name', v_category.name);
end;
$$;

revoke all on function public.delete_category(uuid) from public, anon;
grant execute on function public.delete_category(uuid) to authenticated;

comment on function public.delete_category(uuid) is
  'Permission-checked hard delete. Refuses categories with children, products or filter assignments.';

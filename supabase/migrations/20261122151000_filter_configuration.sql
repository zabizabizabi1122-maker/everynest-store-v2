-- =============================================================================
-- EveryNest - Admin-configurable storefront filters
-- =============================================================================
-- Separate from categories.attribute_schema: variant schema stays protected by
-- its existing guards, while storefront filters can be enabled, ordered,
-- assigned to categories and given friendly labels/options independently.
--
-- All values shown to customers are derived from real catalogue data:
-- product brand, active variant attributes, price, stock, featured flag,
-- sale price and approved review ratings.
-- =============================================================================

create table public.filter_definitions (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique
                check (key ~ '^[a-z][a-z0-9_]*$'),
  label         text not null check (char_length(btrim(label)) between 1 and 80),
  description   text,
  type          text not null
                check (type in ('attribute', 'brand', 'price', 'availability', 'rating', 'featured', 'discount', 'new_arrivals')),
  source_key    text check (source_key is null or source_key ~ '^[a-z][a-z0-9_]*$'),
  is_active     boolean not null default true,
  is_multiple   boolean not null default true,
  applies_to_all boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint filter_definitions_attribute_has_source
    check (type <> 'attribute' or source_key is not null)
);

create table public.filter_options (
  id            uuid primary key default gen_random_uuid(),
  filter_id     uuid not null references public.filter_definitions (id) on delete cascade,
  value         text not null check (char_length(btrim(value)) between 1 and 100),
  label         text not null check (char_length(btrim(label)) between 1 and 100),
  color_hex     text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (filter_id, value)
);

create table public.filter_categories (
  filter_id   uuid not null references public.filter_definitions (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (filter_id, category_id)
);

create table public.sort_options (
  key           text primary key check (key ~ '^[a-z][a-z0-9-]*$'),
  label         text not null check (char_length(btrim(label)) between 1 and 80),
  is_active     boolean not null default true,
  display_order integer not null default 0
);

create index if not exists filter_options_filter_order_idx
  on public.filter_options (filter_id, display_order, label);
create index if not exists filter_categories_category_idx
  on public.filter_categories (category_id);

create trigger set_filter_definitions_updated_at
  before update on public.filter_definitions
  for each row execute function private.set_updated_at();

alter table public.filter_definitions enable row level security;
alter table public.filter_options enable row level security;
alter table public.filter_categories enable row level security;
alter table public.sort_options enable row level security;

revoke all on table
  public.filter_definitions,
  public.filter_options,
  public.filter_categories,
  public.sort_options
from anon, authenticated;

grant select on table public.filter_definitions to anon, authenticated;
grant select on table public.filter_options to anon, authenticated;
grant select on table public.sort_options to anon, authenticated;
grant select on table public.filter_categories to authenticated;
grant insert, update, delete on table public.filter_definitions to authenticated;
grant insert, update, delete on table public.filter_options to authenticated;
grant insert, delete on table public.filter_categories to authenticated;

-- Public visitors see only enabled configuration; admins see everything.
create policy filter_definitions_select_public
  on public.filter_definitions for select to anon, authenticated
  using (is_active);
create policy filter_definitions_select_admin
  on public.filter_definitions for select to authenticated
  using (private.has_permission('filters.view'));
create policy filter_definitions_insert_admin
  on public.filter_definitions for insert to authenticated
  with check (private.has_permission('filters.manage'));
create policy filter_definitions_update_admin
  on public.filter_definitions for update to authenticated
  using (private.has_permission('filters.manage'))
  with check (private.has_permission('filters.manage'));
create policy filter_definitions_delete_admin
  on public.filter_definitions for delete to authenticated
  using (private.has_permission('filters.manage'));

create policy filter_options_select_public
  on public.filter_options for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.filter_definitions fd
      where fd.id = filter_options.filter_id and fd.is_active
    )
  );
create policy filter_options_select_admin
  on public.filter_options for select to authenticated
  using (private.has_permission('filters.view'));
create policy filter_options_insert_admin
  on public.filter_options for insert to authenticated
  with check (private.has_permission('filters.manage'));
create policy filter_options_update_admin
  on public.filter_options for update to authenticated
  using (private.has_permission('filters.manage'))
  with check (private.has_permission('filters.manage'));
create policy filter_options_delete_admin
  on public.filter_options for delete to authenticated
  using (private.has_permission('filters.manage'));

create policy filter_categories_select_admin
  on public.filter_categories for select to authenticated
  using (private.has_permission('filters.view'));
create policy filter_categories_insert_admin
  on public.filter_categories for insert to authenticated
  with check (private.has_permission('filters.manage'));
create policy filter_categories_delete_admin
  on public.filter_categories for delete to authenticated
  using (private.has_permission('filters.manage'));

create policy sort_options_select_public
  on public.sort_options for select to anon, authenticated
  using (is_active);
create policy sort_options_select_admin
  on public.sort_options for select to authenticated
  using (private.has_permission('filters.view'));

-- -----------------------------------------------------------------------------
-- Seed configuration. These are real filter definitions, not hardcoded UI data.
-- Options are only defaults; admins can add, rename, recolour and remove them.
-- -----------------------------------------------------------------------------
insert into public.filter_definitions
  (key, label, description, type, source_key, is_active, is_multiple, applies_to_all, display_order)
values
  ('category',     'Category',     'Narrow by product department.',        'attribute',   'category',      true, true,  true,  10),
  ('brand',        'Brand',        'Values come from products in the catalogue.', 'brand', null, true, true, true,  20),
  ('color',        'Colour',       'Visual swatches from variant colour attributes.', 'attribute', 'color', true, true, true,  30),
  ('size',         'Size',         'Variant sizes from real product data.', 'attribute',   'size',          true, true,  true,  40),
  ('price',        'Price',        'Minimum and maximum price in rupees.', 'price',       null,            true, false, true,  50),
  ('availability', 'Availability', 'Show only in-stock products.',         'availability',null,            true, false, true,  60),
  ('rating',       'Rating',       'Approved customer review average.',    'rating',      null,            true, false, true,  70),
  ('discount',     'On sale',      'Products with an active sale price.',   'discount',    null,            true, false, true,  80),
  ('featured',     'Featured',     'Products chosen for the homepage.',    'featured',    null,            true, false, true,  90),
  ('new_arrivals', 'New arrivals', 'Recently added products.',             'new_arrivals',null,            true, false, true, 100)
on conflict (key) do nothing;

insert into public.sort_options (key, label, is_active, display_order) values
  ('newest',     'Newest first',      true, 10),
  ('price-asc',  'Price: low to high',true, 20),
  ('price-desc', 'Price: high to low',true, 30),
  ('name-asc',   'Name: A to Z',      true, 40)
on conflict (key) do nothing;

-- Swatch defaults for attributes already used in the catalogue.
insert into public.filter_options (filter_id, value, label, color_hex, display_order)
select fd.id, x.value, x.label, x.color_hex, x.display_order
from public.filter_definitions fd
cross join (
  values
    ('black', 'Black', '#111111', 10),
    ('white', 'White', '#FFFFFF', 20),
    ('red', 'Red', '#DC2626', 30),
    ('blue', 'Blue', '#2563EB', 40),
    ('green', 'Green', '#16A34A', 50),
    ('grey', 'Grey', '#6B7280', 60),
    ('gray', 'Grey', '#6B7280', 70),
    ('brown', 'Brown', '#92400E', 80)
) as x(value, label, color_hex, display_order)
where fd.key = 'color'
on conflict (filter_id, value) do nothing;

insert into public.filter_options (filter_id, value, label, color_hex, display_order)
select fd.id, '4', '4★ and above', null, 10
from public.filter_definitions fd
where fd.key = 'rating'
on conflict (filter_id, value) do nothing;

insert into public.filter_options (filter_id, value, label, color_hex, display_order)
select fd.id, '3', '3★ and above', null, 20
from public.filter_definitions fd
where fd.key = 'rating'
on conflict (filter_id, value) do nothing;

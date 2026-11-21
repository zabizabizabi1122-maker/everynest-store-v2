-- =============================================================================
-- EveryNest - Level 1
-- 0002: core catalogue, inventory and audit tables
-- =============================================================================
-- Design rules enforced here, not only in the UI:
--   * money is integer paisa (never floating point)
--   * products have no price and no stock; variants do
--   * historical records are protected by `on delete restrict`
--   * sale price must be strictly lower than the regular price
--   * order tables are intentionally NOT created here (Level 8)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: one row per Supabase auth user
-- -----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  phone      text,
  role       text not null default 'customer'
             check (role in ('customer', 'staff', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile for each auth user. Role defaults to customer and can only be changed by a trusted database owner.';

-- -----------------------------------------------------------------------------
-- categories: hierarchical, with a JSONB attribute schema
-- -----------------------------------------------------------------------------
create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid references public.categories (id) on delete restrict,
  name             text not null,
  slug             text not null unique,
  attribute_schema jsonb not null default '[]'::jsonb,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint categories_attribute_schema_is_array
    check (jsonb_typeof(attribute_schema) = 'array'),
  constraint categories_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint categories_parent_not_self
    check (parent_id is null or parent_id <> id)
);

comment on table public.categories is
  'Category tree. attribute_schema is a JSON array of {key,label,options} objects describing required variant attributes.';

-- -----------------------------------------------------------------------------
-- products: general product information only (no price, no stock)
-- -----------------------------------------------------------------------------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name        text not null,
  slug        text not null unique,
  brand       text,
  description text,
  is_featured boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint products_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

comment on table public.products is
  'General product information. Price and stock live on product_variants.';

-- -----------------------------------------------------------------------------
-- product_images: ordered gallery images
-- -----------------------------------------------------------------------------
create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url        text not null,
  alt_text   text,
  sort_order integer not null default 0
);

-- -----------------------------------------------------------------------------
-- product_variants: the sellable unit (SKU, price, stock)
-- -----------------------------------------------------------------------------
create table public.product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete restrict,
  sku              text not null unique,
  attributes       jsonb not null default '{}'::jsonb,
  price_paisa      integer not null check (price_paisa >= 0),
  sale_price_paisa integer check (sale_price_paisa is null or sale_price_paisa >= 0),
  stock            integer not null default 0 check (stock >= 0),
  reorder_level    integer not null default 5 check (reorder_level >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint product_variants_sku_format
    check (sku ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'),
  constraint product_variants_attributes_is_object
    check (jsonb_typeof(attributes) = 'object'),
  constraint product_variants_sale_price_below_regular
    check (sale_price_paisa is null or sale_price_paisa < price_paisa),
  constraint product_variants_product_attributes_unique
    unique (product_id, attributes)
);

comment on table public.product_variants is
  'Sellable variant. Stock is only changed through trusted database functions (adjust_stock / place_order).';

-- -----------------------------------------------------------------------------
-- suppliers
-- -----------------------------------------------------------------------------
create table public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- stock_movements: append-only inventory ledger
-- -----------------------------------------------------------------------------
create table public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references public.product_variants (id) on delete restrict,
  change      integer not null check (change <> 0),
  reason      text not null
              check (reason in ('purchase', 'sale', 'return', 'adjustment')),
  supplier_id uuid references public.suppliers (id) on delete restrict,
  note        text,
  -- The FK to orders is added in the Level 8 migration, when orders exists.
  order_id    uuid,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.stock_movements is
  'Append-only stock ledger. Application roles can read (staff) but never insert, update or delete directly.';

-- -----------------------------------------------------------------------------
-- audit_log: append-only privileged-action trail
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_details_is_object
    check (jsonb_typeof(details) = 'object')
);

comment on table public.audit_log is
  'Append-only audit trail. actor_id is null for trusted manual maintenance performed outside an authenticated session.';

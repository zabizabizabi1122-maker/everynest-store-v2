-- =============================================================================
-- EveryNest - Level 8 database security tests (pgTAP)
-- =============================================================================
-- Run with a local Supabase database after applying all migrations:
--
--   npx supabase start
--   npx supabase test db
--
-- STATUS: NOT EXECUTED YET (no local Docker engine in this environment).
-- These assertions describe the intended Level 8 guarantees and must be run
-- against a local stack before the order layer is treated as verified.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(18);

-- -----------------------------------------------------------------------------
-- RLS coverage
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('orders', 'order_items')
      and c.relrowsecurity
  ),
  2,
  'RLS is enabled on orders and order_items'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'orders'),
  2,
  'orders has exactly the own-customer and staff SELECT policies'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'order_items'),
  2,
  'order_items has exactly the own-customer and staff SELECT policies'
);

-- -----------------------------------------------------------------------------
-- Privileges: no application role may write order history directly.
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.orders', 'SELECT'),
  'anon cannot read orders'
);

select ok(
  not has_table_privilege('anon', 'public.order_items', 'SELECT'),
  'anon cannot read order items'
);

select ok(
  has_table_privilege('authenticated', 'public.orders', 'SELECT'),
  'authenticated can read orders subject to RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.orders', 'INSERT'),
  'authenticated cannot insert orders directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.orders', 'UPDATE'),
  'authenticated cannot update orders directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.order_items', 'DELETE'),
  'authenticated cannot delete order items'
);

-- -----------------------------------------------------------------------------
-- RPC surface
-- -----------------------------------------------------------------------------
select ok(
  has_function_privilege(
    'authenticated',
    'public.place_order(uuid, jsonb, text, text, text, text)',
    'EXECUTE'
  ),
  'authenticated can call place_order'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.place_order(uuid, jsonb, text, text, text, text)',
    'EXECUTE'
  ),
  'anon cannot call place_order'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.normalize_pakistani_phone(text)',
    'EXECUTE'
  ),
  'the phone normalizer stays private'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.apply_stock_movement(uuid, integer, text, uuid, text, uuid)',
    'EXECUTE'
  ),
  'the stock helper stays private'
);

-- -----------------------------------------------------------------------------
-- Constraints and integrity
-- -----------------------------------------------------------------------------
select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'order_number_seq'
  ),
  'order number sequence exists'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_customer_idempotency_unique'
  ),
  'idempotency is unique per customer, not globally'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'stock_movements_order_id_fkey'
      and confrelid = 'public.orders'::regclass
  ),
  'stock movements link to orders with a foreign key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'orders_status_check'
  ),
  'order status is constrained in the database'
);

select is(
  private.normalize_pakistani_phone('0300 1234567'),
  '+923001234567',
  'phone normalization matches the application validator'
);

rollback;

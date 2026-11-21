-- =============================================================================
-- EveryNest - Level 1 database security tests (pgTAP)
-- =============================================================================
-- Run with a local Supabase database:
--
--   npx supabase start
--   npx supabase test db
--
-- STATUS: NOT EXECUTED YET.
-- This machine has no Docker engine, so a local Supabase stack could not be
-- started. The assertions below are written against the Level 1 migrations and
-- must be run before this level is treated as database-verified.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(17);

-- -----------------------------------------------------------------------------
-- RLS coverage
-- -----------------------------------------------------------------------------
select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'profiles', 'categories', 'products', 'product_images',
        'product_variants', 'suppliers', 'stock_movements', 'audit_log'
      )
      and c.relrowsecurity
  ),
  8,
  'RLS is enabled on all eight Level 1 tables'
);

-- -----------------------------------------------------------------------------
-- Privileges: anonymous visitors
-- -----------------------------------------------------------------------------
select ok(
  has_table_privilege('anon', 'public.categories', 'SELECT'),
  'anon can read categories (RLS limits to active rows)'
);

select ok(
  not has_table_privilege('anon', 'public.stock_movements', 'SELECT'),
  'anon cannot read stock movements'
);

select ok(
  not has_table_privilege('anon', 'public.audit_log', 'SELECT'),
  'anon cannot read the audit log'
);

select ok(
  not has_table_privilege('anon', 'public.product_variants', 'INSERT'),
  'anon cannot insert variants'
);

-- -----------------------------------------------------------------------------
-- Privileges: authenticated customers/staff
-- -----------------------------------------------------------------------------
select ok(
  has_column_privilege('authenticated', 'public.product_variants', 'price_paisa', 'UPDATE'),
  'authenticated can update variant price columns'
);

select ok(
  not has_column_privilege('authenticated', 'public.product_variants', 'stock', 'UPDATE'),
  'authenticated cannot update variant stock directly'
);

select ok(
  not has_column_privilege('authenticated', 'public.product_variants', 'stock', 'INSERT'),
  'authenticated cannot insert variant stock directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'INSERT'),
  'authenticated cannot insert audit rows directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE'),
  'authenticated cannot update audit rows'
);

select ok(
  not has_table_privilege('authenticated', 'public.stock_movements', 'DELETE'),
  'authenticated cannot delete stock movements'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'authenticated cannot update the profile role column'
);

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
select ok(
  not has_function_privilege(
    'anon',
    'private.apply_stock_movement(uuid, integer, text, uuid, text, uuid)',
    'EXECUTE'
  ),
  'anon cannot execute the private stock helper'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.apply_stock_movement(uuid, integer, text, uuid, text, uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute the private stock helper'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.adjust_stock(uuid, integer, text, uuid, text)',
    'EXECUTE'
  ),
  'authenticated can execute the staff stock RPC (role checked inside)'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.adjust_stock(uuid, integer, text, uuid, text)',
    'EXECUTE'
  ),
  'anon cannot execute the staff stock RPC'
);

-- -----------------------------------------------------------------------------
-- Internal schema is not reachable by anonymous visitors
-- -----------------------------------------------------------------------------
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon has no USAGE privilege on the private schema'
);

select * from finish();

rollback;

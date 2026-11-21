-- =============================================================================
-- EveryNest - Level 10 database tests (pgTAP)
-- =============================================================================
-- Run with a local Supabase database after applying all migrations:
--
--   npx supabase start
--   npx supabase test db
--
-- STATUS: NOT EXECUTED YET (no local Docker engine in this environment).
-- These assertions describe the intended Level 10 guarantees; the same
-- structural checks are run as read-only SQL on the dev project instead.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(9);

-- -----------------------------------------------------------------------------
-- The reports surface is one staff-only, definer-pinned RPC.
-- -----------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.get_reports_data(integer)', 'EXECUTE'),
  'authenticated can call get_reports_data'
);

select ok(
  not has_function_privilege('anon', 'public.get_reports_data(integer)', 'EXECUTE'),
  'anon cannot call get_reports_data'
);

select ok(
  not has_function_privilege('public', 'public.get_reports_data(integer)', 'EXECUTE'),
  'the reports RPC is not public'
);

select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'get_reports_data'
       and p.prosecdef
  ),
  'get_reports_data is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'get_reports_data'
       and p.proconfig @> array['search_path=""']
  ),
  'get_reports_data pins an empty search_path'
);

-- -----------------------------------------------------------------------------
-- Reports must not widen write access to the underlying data.
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('authenticated', 'public.orders', 'UPDATE'),
  'authenticated still cannot update orders'
);

select ok(
  not has_table_privilege('authenticated', 'public.order_items', 'INSERT'),
  'authenticated still cannot insert order items'
);

select ok(
  not has_table_privilege('authenticated', 'public.stock_movements', 'INSERT'),
  'authenticated still cannot insert stock movements'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'INSERT'),
  'authenticated still cannot insert audit rows'
);

select * from finish();

rollback;

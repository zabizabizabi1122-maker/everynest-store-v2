-- =============================================================================
-- EveryNest - Level 11 saved addresses database tests (pgTAP)
-- =============================================================================
-- STATUS: NOT EXECUTED YET (no local Docker engine in this environment).
-- Run with `npx supabase start` then `npx supabase test db` after all migrations.
-- Live RLS/ownership/phone/constraint probes are performed on the dev project
-- in the behavior script instead.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(12);

-- anon has no saved-address privileges at all.
select ok(
  not has_table_privilege('anon', 'public.saved_addresses', 'SELECT'),
  'anonymous users cannot read saved addresses'
);
select ok(
  not has_table_privilege('anon', 'public.saved_addresses', 'INSERT'),
  'anonymous users cannot insert saved addresses'
);

-- Authenticated customers get full CRUD, scoped by RLS.
select ok(
  has_table_privilege('authenticated', 'public.saved_addresses', 'SELECT'),
  'customers can read saved addresses'
);
select ok(
  has_table_privilege('authenticated', 'public.saved_addresses', 'INSERT'),
  'customers can insert saved addresses'
);
select ok(
  has_table_privilege('authenticated', 'public.saved_addresses', 'UPDATE'),
  'customers can update saved addresses'
);
select ok(
  has_table_privilege('authenticated', 'public.saved_addresses', 'DELETE'),
  'customers can delete saved addresses'
);

-- The default-setting RPC is executable by authenticated users and is pinned.
select ok(
  has_function_privilege('authenticated', 'public.set_default_address(uuid)', 'EXECUTE'),
  'customers can call set_default_address'
);
select ok(
  not has_function_privilege('anon', 'public.set_default_address(uuid)', 'EXECUTE'),
  'anonymous users cannot call set_default_address'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_default_address'
      and p.prosecdef
      and p.proconfig @> array['search_path=\"\"']
  ),
  'set_default_address is SECURITY DEFINER with an empty search_path'
);

-- Structural guarantees: one default per user, phone check, first-default trigger.
select ok(
  exists (
    select 1 from pg_index
    where indname = 'saved_addresses_one_default_per_user' and indisunique
  ) or exists (
    select 1 from pg_constraint where conname = 'saved_addresses_one_default_per_user'
  ),
  'at most one default address per customer'
);
select ok(
  exists (
    select 1 from pg_constraint where conname = 'saved_addresses_phone_valid'
  ),
  'phone numbers are validated by a check constraint'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'set_first_saved_address_default' and not tgisinternal
  ),
  'the first saved address becomes the default automatically'
);

select * from finish();

rollback;

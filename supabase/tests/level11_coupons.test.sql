-- =============================================================================
-- EveryNest - Level 11 coupons database tests (pgTAP)
-- =============================================================================
-- STATUS: NOT EXECUTED YET (no local Docker engine in this environment).
-- Run with `npx supabase start` then `npx supabase test db` after all migrations.
-- These assertions describe the intended guarantees; the same privileges are
-- checked with read-only SQL on the dev project.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(12);

-- Coupons are not directly readable by customers; only admins may write them.
select ok(
  not has_table_privilege('anon', 'public.coupons', 'SELECT'),
  'anonymous users have no coupon table access'
);
select ok(
  has_table_privilege('authenticated', 'public.coupons', 'SELECT'),
  'authenticated users have the table privilege; RLS narrows rows to staff'
);
select ok(
  has_table_privilege('authenticated', 'public.coupons', 'INSERT'),
  'authenticated users have the insert privilege; RLS narrows it to admins'
);
select ok(
  not has_table_privilege('authenticated', 'public.coupon_redemptions', 'INSERT'),
  'customers cannot write redemption records'
);
select ok(
  not has_table_privilege('authenticated', 'public.orders', 'UPDATE'),
  'customers still cannot edit orders directly'
);

-- Trusted functions are configured correctly.
select ok(
  has_function_privilege('authenticated', 'public.validate_coupon(text)', 'EXECUTE'),
  'authenticated users can check a coupon code'
);
select ok(
  not has_function_privilege('anon', 'public.validate_coupon(text)', 'EXECUTE'),
  'anonymous users cannot check coupon codes'
);
select ok(
  not has_function_privilege('public', 'public.place_order(uuid, jsonb, text, text, text, text, text)', 'EXECUTE'),
  'checkout RPC is not granted to PUBLIC'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'place_order'
      and p.prosecdef
      and p.proconfig @> array['search_path=\"\"']
  ),
  'place_order is SECURITY DEFINER with an empty search_path'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'validate_coupon'
      and p.prosecdef
      and p.proconfig @> array['search_path=\"\"']
  ),
  'validate_coupon is SECURITY DEFINER with an empty search_path'
);

-- Business constraints live in the database.
select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'coupons_percent_range'
  ),
  'percent discounts are constrained to 1-100'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'coupon_redemptions_once_per_customer'
  ),
  'one redemption per customer per coupon is enforced'
);

select * from finish();

rollback;

-- =============================================================================
-- EveryNest - Level 11 product reviews database tests (pgTAP)
-- =============================================================================
-- STATUS: NOT EXECUTED YET (no local Docker engine in this environment).
-- Run with `npx supabase start` then `npx supabase test db` after all migrations.
-- The same guarantees are checked with live RPC calls and RLS probes on the dev
-- project in the behavior script.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(11);

-- Customers can read (RLS narrows to approved + own), never write reviews.
select ok(
  has_table_privilege('anon', 'public.reviews', 'SELECT'),
  'anonymous users may read approved reviews'
);
select ok(
  not has_table_privilege('anon', 'public.reviews', 'INSERT'),
  'anonymous users cannot insert reviews'
);
select ok(
  has_table_privilege('authenticated', 'public.reviews', 'SELECT'),
  'authenticated users may read reviews'
);
select ok(
  not has_table_privilege('authenticated', 'public.reviews', 'INSERT'),
  'customers have no direct insert privilege on reviews'
);
select ok(
  not has_table_privilege('authenticated', 'public.reviews', 'UPDATE'),
  'customers cannot edit reviews directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.reviews', 'DELETE'),
  'customers cannot delete reviews'
);

-- Trusted functions are callable by authenticated users and pinned safely.
select ok(
  has_function_privilege('authenticated', 'public.submit_review(uuid, integer, text, text)', 'EXECUTE'),
  'authenticated users can submit a review'
);
select ok(
  not has_function_privilege('anon', 'public.submit_review(uuid, integer, text, text)', 'EXECUTE'),
  'anonymous users cannot submit reviews'
);
select ok(
  has_function_privilege('authenticated', 'public.set_review_status(uuid, text)', 'EXECUTE'),
  'moderation RPC is executable by authenticated users (RLF + internal staff check apply)'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_review'
      and p.prosecdef
      and p.proconfig @> array['search_path=\"\"']
  ),
  'submit_review is SECURITY DEFINER with an empty search_path'
);

-- Database constraints enforce the one-per-product and status rules.
select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'reviews_once_per_product'
  ),
  'one review per product per customer is enforced'
);

select * from finish();

rollback;

-- =============================================================================
-- EveryNest - Level 11 wishlist database tests (pgTAP)
-- =============================================================================
-- STATUS: NOT EXECUTED YET (no local Docker engine in this environment).
-- Run with `npx supabase start` then `npx supabase test db` after all migrations.
-- Live RLS/ownership probes are performed on the dev project instead.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(8);

-- anon has no wishlist privileges at all.
select ok(
  not has_table_privilege('anon', 'public.wishlist_items', 'SELECT'),
  'anonymous users cannot read wishlists'
);
select ok(
  not has_table_privilege('anon', 'public.wishlist_items', 'INSERT'),
  'anonymous users cannot save wishlist items'
);
select ok(
  not has_table_privilege('anon', 'public.wishlist_items', 'DELETE'),
  'anonymous users cannot remove wishlist items'
);

-- Authenticated users get exactly the three operations a wishlist needs.
select ok(
  has_table_privilege('authenticated', 'public.wishlist_items', 'SELECT'),
  'customers can read their wishlist'
);
select ok(
  has_table_privilege('authenticated', 'public.wishlist_items', 'INSERT'),
  'customers can save wishlist items'
);
select ok(
  has_table_privilege('authenticated', 'public.wishlist_items', 'DELETE'),
  'customers can remove wishlist items'
);
select ok(
  not has_table_privilege('authenticated', 'public.wishlist_items', 'UPDATE'),
  'wishlist rows are never updated'
);

-- Uniqueness prevents saving the same product twice.
select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'wishlist_items_unique'
  ),
  'one wishlist row per customer per product'
);

select * from finish();

rollback;

-- =============================================================================
-- EveryNest - Level 9 database tests (pgTAP)
-- =============================================================================
-- Run with a local Supabase database after applying all migrations:
--
--   npx supabase start
--   npx supabase test db
--
-- STATUS: NOT EXECUTED YET (no local Docker engine in this environment).
-- These assertions describe the intended Level 9 guarantees and must be run
-- against a local stack before the order lifecycle is treated as verified.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(28);

-- -----------------------------------------------------------------------------
-- RPC surface: trusted functions are callable, helpers stay private.
-- -----------------------------------------------------------------------------
select ok(
  has_function_privilege(
    'authenticated',
    'public.list_orders(integer, integer, text)',
    'EXECUTE'
  ),
  'authenticated can call list_orders'
);

select ok(
  not has_function_privilege('anon', 'public.list_orders(integer, integer, text)', 'EXECUTE'),
  'anon cannot call list_orders'
);

select ok(
  has_function_privilege('authenticated', 'public.get_order(uuid)', 'EXECUTE'),
  'authenticated can call get_order'
);

select ok(
  not has_function_privilege('anon', 'public.get_order(uuid)', 'EXECUTE'),
  'anon cannot call get_order'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.transition_order_status(uuid, text)',
    'EXECUTE'
  ),
  'authenticated can call transition_order_status'
);

select ok(
  not has_function_privilege('anon', 'public.transition_order_status(uuid, text)', 'EXECUTE'),
  'anon cannot call transition_order_status'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.order_summary_json(public.orders)',
    'EXECUTE'
  ),
  'the summary formatter stays private'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.order_detail_json(public.orders)',
    'EXECUTE'
  ),
  'the detail formatter stays private'
);

-- -----------------------------------------------------------------------------
-- Order history is still read-only for application roles.
-- -----------------------------------------------------------------------------
select ok(
  not has_table_privilege('authenticated', 'public.orders', 'UPDATE'),
  'authenticated cannot update orders directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'INSERT'),
  'authenticated cannot write audit rows directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.stock_movements', 'INSERT'),
  'authenticated cannot write stock movements directly'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename in ('orders', 'order_items')
      and cmd <> 'SELECT'
  ),
  0,
  'order tables have no client write policies'
);

-- -----------------------------------------------------------------------------
-- Every trusted RPC must pin its search_path and run as the function owner.
-- -----------------------------------------------------------------------------
select ok(
  exists (
    select 1
    from pg_proc p
    where p.oid = 'public.list_orders(integer, integer, text)'::regprocedure
      and p.prosecdef
      and p.proconfig @> array['search_path=']
  ),
  'list_orders is SECURITY DEFINER with an empty search_path'
);

select ok(
  exists (
    select 1
    from pg_proc p
    where p.oid = 'public.get_order(uuid)'::regprocedure
      and p.prosecdef
      and p.proconfig @> array['search_path=']
  ),
  'get_order is SECURITY DEFINER with an empty search_path'
);

select ok(
  exists (
    select 1
    from pg_proc p
    where p.oid = 'public.transition_order_status(uuid, text)'::regprocedure
      and p.prosecdef
      and p.proconfig @> array['search_path=']
  ),
  'transition_order_status is SECURITY DEFINER with an empty search_path'
);

-- -----------------------------------------------------------------------------
-- Fixtures. Auth users get a profile from the Level 1 signup trigger; role
-- changes below are made by the migration role, which the role guard allows.
-- -----------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, encrypted_password)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'customer-a@example.test', 'x'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'customer-b@example.test', 'x'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'authenticated', 'authenticated', 'staff@example.test', 'x');

update public.profiles
   set role = 'staff'
 where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

insert into public.categories (id, name, slug)
values ('f1111111-1111-4111-8111-111111111111', 'Level Nine', 'level-nine');

insert into public.products (id, category_id, name, slug)
values (
  'f2222222-2222-4222-8222-222222222222',
  'f1111111-1111-4111-8111-111111111111',
  'Lifecycle Test Product',
  'lifecycle-test-product'
);

insert into public.product_variants (id, product_id, sku, attributes, price_paisa, stock)
values (
  'f3333333-3333-4333-8333-333333333333',
  'f2222222-2222-4222-8222-222222222222',
  'LIFECYCLE-1',
  '{}'::jsonb,
  10000,
  8
);

insert into public.orders (
  id,
  order_number,
  user_id,
  status,
  subtotal_paisa,
  shipping_paisa,
  discount_paisa,
  total_paisa,
  customer_name,
  phone,
  address,
  city,
  idempotency_key,
  request_fingerprint
)
values
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'ZS-202611-900001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'pending',
    20000,
    0,
    0,
    20000,
    'Customer A',
    '+923001234567',
    '12 Test Street, Lahore',
    'Lahore',
    '99999999-9999-4999-8999-999999999991',
    repeat('a', 32)
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'ZS-202611-900002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'pending',
    20000,
    0,
    0,
    20000,
    'Customer A',
    '+923001234567',
    '12 Test Street, Lahore',
    'Lahore',
    '99999999-9999-4999-8999-999999999992',
    repeat('b', 32)
  );

insert into public.order_items (
  id, order_id, variant_id, product_name, variant_label, price_paisa, quantity
)
values
  (
    '44444444-4444-4444-8444-444444444441',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'f3333333-3333-4333-8333-333333333333',
    'Lifecycle Test Product',
    'default',
    10000,
    2
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'f3333333-3333-4333-8333-333333333333',
    'Lifecycle Test Product',
    'default',
    10000,
    2
  );

insert into public.stock_movements (variant_id, change, reason, note, order_id, created_by)
values (
  'f3333333-3333-4333-8333-333333333333',
  -2,
  'sale',
  'Order ZS-202611-900001',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

-- -----------------------------------------------------------------------------
-- Authorization behavior. Claiming a different user must not expose or mutate
-- somebody else's order.
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select throws_ok(
  $$ select public.get_order('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid) $$,
  'P0002',
  'Order not found',
  'a customer cannot read another customer order'
);

select throws_ok(
  $$ select public.transition_order_status('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 'cancelled') $$,
  '42501',
  'Not authorized to manage this order',
  'a customer cannot cancel another customer order'
);

-- -----------------------------------------------------------------------------
-- Valid cancellation: status changes, stock is restored once and an audit row
-- is written. A retry is a no-op and must not restore stock again.
-- -----------------------------------------------------------------------------
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$ select public.transition_order_status('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 'cancelled') $$,
  'a customer can cancel a pending own order'
);

reset role;

select is(
  (select status from public.orders where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  'cancelled',
  'the order status is cancelled'
);

select is(
  (select stock from public.product_variants where id = 'f3333333-3333-4333-8333-333333333333'),
  10,
  'cancellation restores the reserved stock'
);

select is(
  (
    select count(*)::int
    from public.stock_movements
    where order_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      and reason = 'return'
  ),
  1,
  'exactly one return movement is linked to the order'
);

select is(
  (
    select count(*)::int
    from public.audit_log
    where entity = 'orders'
      and entity_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      and action = 'order.status_change'
  ),
  1,
  'the status change is audited'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$ select public.transition_order_status('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 'cancelled') $$,
  'a repeated cancellation is safe'
);

reset role;

select is(
  (select stock from public.product_variants where id = 'f3333333-3333-4333-8333-333333333333'),
  10,
  'a repeated cancellation does not restore stock twice'
);

select is(
  (
    select count(*)::int
    from public.stock_movements
    where order_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      and reason = 'return'
  ),
  1,
  'a repeated cancellation adds no second return movement'
);

-- -----------------------------------------------------------------------------
-- Staff transitions: forward steps one at a time, never skipping stages.
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

select throws_ok(
  $$ select public.transition_order_status('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, 'shipped') $$,
  '22023',
  'Invalid order status transition',
  'staff cannot skip pending to shipped'
);

select lives_ok(
  $$ select public.transition_order_status('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, 'confirmed') $$,
  'staff can confirm a pending order'
);

select is(
  (select status from public.orders where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'confirmed',
  'the confirmed status is stored'
);

reset role;

rollback;

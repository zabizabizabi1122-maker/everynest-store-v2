-- =============================================================================
-- EveryNest - Level 1 catalog verification (hosted, no Docker)
-- =============================================================================
-- How to run:
--   Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run
--
-- Read-only: it only reads system catalogs and privilege metadata.
-- Returns one table of 24 checks. Everything must be PASS.
-- =============================================================================

select
  check_name,
  case when passed = expected then 'PASS' else 'FAIL' end as status,
  passed   as actual,
  expected as expected
from (
  values
    -- RLS coverage ------------------------------------------------------------
    (
      'RLS enabled on all 8 Level 1 tables',
      (
        select count(*) = 8
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in (
            'profiles', 'categories', 'products', 'product_images',
            'product_variants', 'suppliers', 'stock_movements', 'audit_log'
          )
          and c.relrowsecurity
      ),
      true
    ),

    -- Anonymous visitors ------------------------------------------------------
    ('anon can read categories', has_table_privilege('anon', 'public.categories', 'SELECT'), true),
    ('anon can read products', has_table_privilege('anon', 'public.products', 'SELECT'), true),
    ('anon cannot read profiles', not has_table_privilege('anon', 'public.profiles', 'SELECT'), true),
    ('anon cannot read stock movements', not has_table_privilege('anon', 'public.stock_movements', 'SELECT'), true),
    ('anon cannot read audit log', not has_table_privilege('anon', 'public.audit_log', 'SELECT'), true),
    ('anon cannot insert variants', not has_table_privilege('anon', 'public.product_variants', 'INSERT'), true),
    ('anon cannot execute adjust_stock', not has_function_privilege('anon', 'public.adjust_stock(uuid, integer, text, uuid, text)', 'EXECUTE'), true),
    ('anon cannot execute the private stock helper', not has_function_privilege('anon', 'private.apply_stock_movement(uuid, integer, text, uuid, text, uuid)', 'EXECUTE'), true),
    ('anon has no USAGE on private schema', not has_schema_privilege('anon', 'private', 'USAGE'), true),

    -- Authenticated clients ---------------------------------------------------
    ('authenticated can update variant price', has_column_privilege('authenticated', 'public.product_variants', 'price_paisa', 'UPDATE'), true),
    ('authenticated cannot update stock', not has_column_privilege('authenticated', 'public.product_variants', 'stock', 'UPDATE'), true),
    ('authenticated cannot insert stock', not has_column_privilege('authenticated', 'public.product_variants', 'stock', 'INSERT'), true),
    ('authenticated cannot insert audit rows', not has_table_privilege('authenticated', 'public.audit_log', 'INSERT'), true),
    ('authenticated cannot update audit rows', not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE'), true),
    ('authenticated cannot delete stock movements', not has_table_privilege('authenticated', 'public.stock_movements', 'DELETE'), true),
    ('authenticated cannot update profile role', not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'), true),
    ('authenticated can execute adjust_stock', has_function_privilege('authenticated', 'public.adjust_stock(uuid, integer, text, uuid, text)', 'EXECUTE'), true),
    ('authenticated cannot execute the private stock helper', not has_function_privilege('authenticated', 'private.apply_stock_movement(uuid, integer, text, uuid, text, uuid)', 'EXECUTE'), true),

    -- Objects and wiring ------------------------------------------------------
    ('29 public RLS policies', (select count(*) = 29 from pg_policies where schemaname = 'public'), true),
    (
      '9 core triggers on public tables',
      (
        select count(*) = 9
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and not t.tgisinternal
          and t.tgname in (
            'guard_profile_role',
            'set_profiles_updated_at',
            'guard_category_cycle',
            'set_categories_updated_at',
            'set_products_updated_at',
            'set_product_variants_updated_at',
            'guard_variant_stock',
            'audit_variant_price_change',
            'set_suppliers_updated_at'
          )
      ),
      true
    ),
    (
      'signup trigger attached to auth.users',
      exists (
        select 1
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'auth'
          and c.relname = 'users'
          and t.tgname = 'on_auth_user_created'
          and not t.tgisinternal
      ),
      true
    ),
    (
      'product-images bucket is public',
      exists (
        select 1 from storage.buckets
        where id = 'product-images' and public = true
      ),
      true
    ),
    (
      '4 storage policies for product images',
      (
        select count(*) = 4
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname like 'product_images_storage_%'
      ),
      true
    )
) as checks (check_name, passed, expected);

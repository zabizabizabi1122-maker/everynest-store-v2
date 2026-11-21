-- =============================================================================
-- EveryNest - Level 1
-- 0008: indexes for joins, filters and RLS checks
-- =============================================================================

-- profiles: RLS helper and staff lookups
create index profiles_role_idx on public.profiles (role);

-- categories
create index categories_parent_id_idx on public.categories (parent_id);
create index categories_is_active_idx on public.categories (is_active);

-- products
create index products_category_id_idx on public.products (category_id);
create index products_active_featured_idx on public.products (is_active, is_featured);

-- product images
create index product_images_product_sort_idx on public.product_images (product_id, sort_order);

-- variants
create index product_variants_product_id_idx on public.product_variants (product_id);
create index product_variants_is_active_idx on public.product_variants (is_active);
create index product_variants_stock_reorder_idx on public.product_variants (stock, reorder_level);
create index product_variants_attributes_gin_idx on public.product_variants using gin (attributes);

-- stock movements: variant history and links used by reports
create index stock_movements_variant_created_idx
  on public.stock_movements (variant_id, created_at desc);
create index stock_movements_supplier_id_idx on public.stock_movements (supplier_id);
create index stock_movements_created_by_idx on public.stock_movements (created_by);
create index stock_movements_order_id_idx on public.stock_movements (order_id);

-- suppliers
create index suppliers_is_active_idx on public.suppliers (is_active);

-- audit log: admin filtering by actor/entity/date
create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

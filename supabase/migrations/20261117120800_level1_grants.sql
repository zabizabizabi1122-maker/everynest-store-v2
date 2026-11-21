-- =============================================================================
-- EveryNest - Level 1
-- 0009: least-privilege grants
-- =============================================================================
-- Supabase grants broad default privileges on new public tables to `anon` and
-- `authenticated`. Every table is reset here and then only the minimum columns
-- that the application actually needs are granted.
--
-- Privileges and RLS are complementary:
--   * privileges decide which operations/columns are possible at all
--   * RLS decides which rows are visible/affected
-- =============================================================================

revoke all on table
  public.profiles,
  public.categories,
  public.products,
  public.product_images,
  public.product_variants,
  public.suppliers,
  public.stock_movements,
  public.audit_log
from anon, authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- Customers may read their own row and update only the two allowed columns.
-- Profiles are created by the signup trigger, never by clients, and are never
-- deleted by clients.
-- -----------------------------------------------------------------------------
grant select on table public.profiles to authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- catalogue reads
-- Every table has an explicit grant; anonymous visitors only see what RLS
-- allows them to see.
-- -----------------------------------------------------------------------------
grant select on table public.categories to anon, authenticated;
grant select on table public.products to anon, authenticated;
grant select on table public.product_images to anon, authenticated;
grant select on table public.product_variants to anon, authenticated;

-- -----------------------------------------------------------------------------
-- catalogue writes (RLS narrows these to staff/admin)
-- -----------------------------------------------------------------------------
grant insert, update on table public.categories to authenticated;
grant insert, update on table public.products to authenticated;
grant insert, update, delete on table public.product_images to authenticated;

-- Variants: column-level grants only. `stock` is deliberately absent from both
-- lists, so no client can insert or update stock directly.
grant insert (
  product_id,
  sku,
  attributes,
  price_paisa,
  sale_price_paisa,
  reorder_level,
  is_active
) on table public.product_variants to authenticated;

grant update (
  product_id,
  sku,
  attributes,
  price_paisa,
  sale_price_paisa,
  reorder_level,
  is_active
) on table public.product_variants to authenticated;

-- -----------------------------------------------------------------------------
-- suppliers (read for staff, write for admins via RLS)
-- -----------------------------------------------------------------------------
grant select on table public.suppliers to authenticated;
grant insert, update on table public.suppliers to authenticated;

-- -----------------------------------------------------------------------------
-- append-only history: read-only for staff/admin, no writes from clients
-- -----------------------------------------------------------------------------
grant select on table public.stock_movements to authenticated;
grant select on table public.audit_log to authenticated;

-- -----------------------------------------------------------------------------
-- function/schema privileges
-- -----------------------------------------------------------------------------
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

grant execute on function public.adjust_stock(uuid, integer, text, uuid, text)
  to authenticated;

-- `private.apply_stock_movement` and the trigger functions stay executable only
-- by their owner; no client grant is issued.

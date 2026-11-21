-- =============================================================================
-- EveryNest - Level 1
-- 0003: updated_at maintenance
-- =============================================================================
-- A single small trigger function keeps updated_at honest. The function runs as
-- the caller (SECURITY INVOKER) and only touches NEW.updated_at.
-- =============================================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.set_updated_at() from anon;
revoke all on function private.set_updated_at() from authenticated;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

create trigger set_products_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create trigger set_product_variants_updated_at
  before update on public.product_variants
  for each row execute function private.set_updated_at();

create trigger set_suppliers_updated_at
  before update on public.suppliers
  for each row execute function private.set_updated_at();

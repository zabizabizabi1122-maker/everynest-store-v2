-- =============================================================================
-- EveryNest - Level 1
-- 0007: audit triggers for price changes
-- =============================================================================
-- Application roles have no INSERT grant on audit_log, so this trigger must run
-- as its owner (SECURITY DEFINER) to append the record.
--
-- Role changes are audited by private.guard_profile_role() in migration 0004.
-- Order status changes are audited in Level 9.
-- =============================================================================

create or replace function private.audit_variant_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price_paisa is distinct from old.price_paisa
     or new.sale_price_paisa is distinct from old.sale_price_paisa then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (
      (select auth.uid()),
      'variant.price_change',
      'product_variants',
      new.id::text,
      jsonb_build_object(
        'old_price_paisa', old.price_paisa,
        'new_price_paisa', new.price_paisa,
        'old_sale_price_paisa', old.sale_price_paisa,
        'new_sale_price_paisa', new.sale_price_paisa
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_variant_price_change() from public;
revoke all on function private.audit_variant_price_change() from anon;
revoke all on function private.audit_variant_price_change() from authenticated;

create trigger audit_variant_price_change
  after update on public.product_variants
  for each row execute function private.audit_variant_price_change();

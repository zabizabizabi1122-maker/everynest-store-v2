-- =============================================================================
-- EveryNest - Level 1
-- 0006: stock protection and the trusted stock RPC
-- =============================================================================
-- Stock may only change through trusted database functions:
--
--   public.adjust_stock(...)           <- staff/admin RPC (this level)
--   private.apply_stock_movement(...)  <- internal helper (this level)
--   public.place_order(...)            <- customer checkout (Level 8)
--   cancellation function              <- restores stock (Level 9)
--
-- Layers of protection:
--   1. Column-level privileges: authenticated can never write `stock`
--      (see the grants migration).
--   2. This trigger rejects any stock change unless it runs in the trusted
--      owner context of a SECURITY DEFINER function.
--   3. Row locking + a non-negative check inside the helper.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Defensive trigger.
-- SECURITY INVOKER on purpose: `current_user` must be the real caller here.
-- A SECURITY DEFINER trigger would report the owner and defeat the check.
-- -----------------------------------------------------------------------------
create or replace function private.guard_variant_stock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.stock < 0 then
    raise exception 'Stock cannot be negative'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.stock <> 0 and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'New variants must start with zero stock; receive stock through adjust_stock()'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.stock is distinct from old.stock
       and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'Direct stock changes are not permitted; use adjust_stock()'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_variant_stock() from public;
revoke all on function private.guard_variant_stock() from anon;
revoke all on function private.guard_variant_stock() from authenticated;

create trigger guard_variant_stock
  before insert or update on public.product_variants
  for each row execute function private.guard_variant_stock();

-- -----------------------------------------------------------------------------
-- Internal helper.
-- Callable only by other trusted (SECURITY DEFINER) functions; EXECUTE is
-- revoked from every client role.
-- The actor is derived from auth.uid(), never accepted as a parameter.
-- -----------------------------------------------------------------------------
create or replace function private.apply_stock_movement(
  p_variant_id  uuid,
  p_change      integer,
  p_reason      text,
  p_supplier_id uuid default null,
  p_note        text default null,
  p_order_id    uuid default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant  public.product_variants;
  v_new_stock integer;
  v_movement public.stock_movements;
begin
  if p_change is null or p_change = 0 then
    raise exception 'Stock change must be a non-zero integer'
      using errcode = '22023';
  end if;

  if p_reason is null
     or p_reason not in ('purchase', 'sale', 'return', 'adjustment') then
    raise exception 'Invalid stock movement reason'
      using errcode = '22023';
  end if;

  -- Lock the row so concurrent checkouts cannot oversell the last unit.
  select *
    into v_variant
    from public.product_variants
   where id = p_variant_id
     for update;

  if not found then
    raise exception 'Variant not found'
      using errcode = 'P0002';
  end if;

  v_new_stock := v_variant.stock + p_change;

  if v_new_stock < 0 then
    raise exception 'Insufficient stock for variant %', p_variant_id
      using errcode = 'P0001';
  end if;

  update public.product_variants
     set stock = v_new_stock
   where id = p_variant_id;

  insert into public.stock_movements (
    variant_id,
    change,
    reason,
    supplier_id,
    note,
    order_id,
    created_by
  )
  values (
    p_variant_id,
    p_change,
    p_reason,
    p_supplier_id,
    p_note,
    p_order_id,
    (select auth.uid())
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function private.apply_stock_movement(uuid, integer, text, uuid, text, uuid) from public;
revoke all on function private.apply_stock_movement(uuid, integer, text, uuid, text, uuid) from anon;
revoke all on function private.apply_stock_movement(uuid, integer, text, uuid, text, uuid) from authenticated;

-- -----------------------------------------------------------------------------
-- Staff/admin RPC: receive stock or make a permitted adjustment.
-- Customers can never execute this function.
-- -----------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_variant_id  uuid,
  p_change      integer,
  p_reason      text,
  p_supplier_id uuid default null,
  p_note        text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'Not authorized to adjust stock'
      using errcode = '42501';
  end if;

  if p_reason is null
     or p_reason not in ('purchase', 'return', 'adjustment') then
    raise exception 'Reason must be purchase, return, or adjustment'
      using errcode = '22023';
  end if;

  return private.apply_stock_movement(
    p_variant_id,
    p_change,
    p_reason,
    p_supplier_id,
    p_note,
    null
  );
end;
$$;

revoke all on function public.adjust_stock(uuid, integer, text, uuid, text) from public;
revoke all on function public.adjust_stock(uuid, integer, text, uuid, text) from anon;

comment on function public.adjust_stock(uuid, integer, text, uuid, text) is
  'Staff/admin stock adjustment RPC. Appends a stock_movements row in the same transaction.';

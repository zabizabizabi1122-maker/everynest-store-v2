-- =============================================================================
-- EveryNest - Level 9
-- Order lifecycle: customer/admin views, secure transitions, cancellation and
-- exactly-once stock restoration.
-- =============================================================================
-- Security model:
--   * Order tables stay SELECT-only for client roles. No write grants or write
--     RLS policies are added; every state change goes through the RPC below.
--   * These functions are SECURITY DEFINER with an empty search_path and are
--     owned by the migration role, so the trusted stock helper and the stock
--     guard trigger behave exactly as they do for place_order.
--   * Authorization is checked explicitly inside each function using auth.uid()
--     and private.is_staff(); SECURITY DEFINER bypasses RLS, so the checks here
--     are the authority. No actor or owner id is accepted from the client.
--   * Monetary bigint columns are returned as decimal strings, never as JSON
--     numbers, so JavaScript cannot lose precision.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- JSON shapes shared by the order screens. Owner-only: only trusted functions
-- call these helpers.
-- -----------------------------------------------------------------------------
create or replace function private.order_summary_json(p_order public.orders)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_order.id,
    'orderNumber', p_order.order_number,
    'status', p_order.status,
    'totalPaisa', p_order.total_paisa::text,
    'customerName', p_order.customer_name,
    'city', p_order.city,
    'itemCount', (select count(*)::integer from public.order_items oi where oi.order_id = p_order.id),
    'createdAt', p_order.created_at
  );
$$;

revoke all on function private.order_summary_json(public.orders) from public;
revoke all on function private.order_summary_json(public.orders) from anon;
revoke all on function private.order_summary_json(public.orders) from authenticated;

create or replace function private.order_detail_json(p_order public.orders)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_order.id,
    'orderNumber', p_order.order_number,
    'status', p_order.status,
    'subtotalPaisa', p_order.subtotal_paisa::text,
    'shippingPaisa', p_order.shipping_paisa::text,
    'discountPaisa', p_order.discount_paisa::text,
    'totalPaisa', p_order.total_paisa::text,
    'customerName', p_order.customer_name,
    'phone', p_order.phone,
    'address', p_order.address,
    'city', p_order.city,
    'createdAt', p_order.created_at,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'productName', oi.product_name,
            'variantLabel', oi.variant_label,
            'pricePaisa', oi.price_paisa,
            'quantity', oi.quantity,
            'lineTotalPaisa', (oi.price_paisa::bigint * oi.quantity::bigint)::text
          )
          order by oi.id
        )
        from public.order_items oi
        where oi.order_id = p_order.id
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function private.order_detail_json(public.orders) from public;
revoke all on function private.order_detail_json(public.orders) from anon;
revoke all on function private.order_detail_json(public.orders) from authenticated;

-- -----------------------------------------------------------------------------
-- Paginated list. Customers see only their own orders; staff see all orders.
-- -----------------------------------------------------------------------------
create or replace function public.list_orders(
  p_page      integer default 1,
  p_page_size integer default 20,
  p_status    text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := (select auth.uid());
  v_is_staff  boolean;
  v_total     bigint;
  v_offset    integer;
  v_orders    jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to view orders'
      using errcode = '42501';
  end if;

  if p_page is null or p_page < 1 then
    raise exception 'Invalid page number'
      using errcode = '22023';
  end if;

  if p_page_size is null or p_page_size < 1 or p_page_size > 50 then
    raise exception 'Invalid page size'
      using errcode = '22023';
  end if;

  if p_status is not null
     and p_status not in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Invalid order status'
      using errcode = '22023';
  end if;

  v_is_staff := private.is_staff();
  v_offset := (p_page - 1) * p_page_size;

  select count(*)
    into v_total
    from public.orders o
   where (p_status is null or o.status = p_status)
     and (v_is_staff or o.user_id = v_user_id);

  select coalesce(
    jsonb_agg(private.order_summary_json(o) order by o.created_at desc, o.id desc),
    '[]'::jsonb
  )
    into v_orders
    from (
      select o.*
        from public.orders o
       where (p_status is null or o.status = p_status)
         and (v_is_staff or o.user_id = v_user_id)
       order by o.created_at desc, o.id desc
       limit p_page_size offset v_offset
    ) as o;

  return jsonb_build_object(
    'orders', v_orders,
    'total', v_total::text,
    'page', p_page,
    'pageSize', p_page_size
  );
end;
$$;

revoke all on function public.list_orders(integer, integer, text) from public;
revoke all on function public.list_orders(integer, integer, text) from anon;

comment on function public.list_orders(integer, integer, text) is
  'Paginated order list for the signed-in customer or for staff; monetary bigints are decimal strings.';

-- -----------------------------------------------------------------------------
-- Order detail / invoice. A customer asking for somebody else's order gets the
-- same "not found" response as a missing id, so order existence is not leaked.
-- -----------------------------------------------------------------------------
create or replace function public.get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := (select auth.uid());
  v_is_staff boolean;
  v_order    public.orders;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to view an order'
      using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'A valid order id is required'
      using errcode = '22023';
  end if;

  v_is_staff := private.is_staff();

  select o.*
    into v_order
    from public.orders o
   where o.id = p_order_id
     and (v_is_staff or o.user_id = v_user_id);

  if not found then
    raise exception 'Order not found'
      using errcode = 'P0002';
  end if;

  return private.order_detail_json(v_order);
end;
$$;

revoke all on function public.get_order(uuid) from public;
revoke all on function public.get_order(uuid) from anon;

comment on function public.get_order(uuid) is
  'Returns one authorized order with immutable invoice lines; bigint amounts are decimal strings.';

-- -----------------------------------------------------------------------------
-- The only writer of order status.
--
-- Allowed transitions:
--   customer: pending -> cancelled (own order only)
--   staff:    pending -> confirmed -> shipped -> delivered
--   staff:    pending/confirmed -> cancelled
-- A repeated cancellation is a no-op: status and FOR UPDATE locking make stock
-- restoration happen at most once.
-- -----------------------------------------------------------------------------
create or replace function public.transition_order_status(
  p_order_id     uuid,
  p_target_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid := (select auth.uid());
  v_is_staff   boolean;
  v_is_owner   boolean;
  v_order      public.orders;
  v_item       record;
  v_old_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to change an order'
      using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'A valid order id is required'
      using errcode = '22023';
  end if;

  if p_target_status is null
     or p_target_status not in ('confirmed', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Invalid order status'
      using errcode = '22023';
  end if;

  select o.*
    into v_order
    from public.orders o
   where o.id = p_order_id
   for update;

  if not found then
    raise exception 'Order not found'
      using errcode = 'P0002';
  end if;

  v_old_status := v_order.status;
  v_is_staff := private.is_staff();
  v_is_owner := v_order.user_id = v_user_id;

  if not (v_is_staff or v_is_owner) then
    raise exception 'Not authorized to manage this order'
      using errcode = '42501';
  end if;

  -- Customers may only cancel their own pending order. Repeated cancellation is
  -- allowed so a retried request stays idempotent.
  if not v_is_staff then
    if p_target_status <> 'cancelled' then
      raise exception 'Only staff may change an order to this status'
        using errcode = '42501';
    end if;

    if v_order.status not in ('pending', 'cancelled') then
      raise exception 'This order can no longer be cancelled'
        using errcode = '42501';
    end if;
  else
    -- Staff may cancel pending/confirmed orders, repeat a cancellation, or move
    -- a live order forward exactly one step.
    if p_target_status = 'cancelled' then
      if v_order.status not in ('pending', 'confirmed', 'cancelled') then
        raise exception 'This order can no longer be cancelled'
          using errcode = '22023';
      end if;
    elsif not (
      (v_order.status = 'pending' and p_target_status = 'confirmed')
      or (v_order.status = 'confirmed' and p_target_status = 'shipped')
      or (v_order.status = 'shipped' and p_target_status = 'delivered')
    ) then
      raise exception 'Invalid order status transition'
        using errcode = '22023';
    end if;
  end if;

  -- Already in the target status: no audit row and no stock movement. This is
  -- the idempotency guard for repeated cancellations.
  if v_order.status = p_target_status then
    return private.order_detail_json(v_order);
  end if;

  update public.orders
     set status = p_target_status
   where id = v_order.id
   returning * into v_order;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    v_user_id,
    'order.status_change',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'from', v_old_status,
      'to', p_target_status,
      'orderNumber', v_order.order_number
    )
  );

  -- Restoring stock is part of the same transaction and goes only through the
  -- private helper, which appends the matching 'return' ledger row.
  if p_target_status = 'cancelled' then
    for v_item in
      select oi.variant_id, oi.quantity
        from public.order_items oi
       where oi.order_id = v_order.id
       order by oi.variant_id
    loop
      perform private.apply_stock_movement(
        v_item.variant_id,
        v_item.quantity,
        'return',
        null,
        'Cancellation of order ' || v_order.order_number,
        v_order.id
      );
    end loop;
  end if;

  return private.order_detail_json(v_order);
end;
$$;

revoke all on function public.transition_order_status(uuid, text) from public;
revoke all on function public.transition_order_status(uuid, text) from anon;

comment on function public.transition_order_status(uuid, text) is
  'Atomic, role-checked order status change. Cancellation restores stock once through private.apply_stock_movement.';

-- Client roles may call the RPCs (role checks happen inside), but still have no
-- direct write access to orders, order_items, stock_movements or audit_log.
grant execute on function public.list_orders(integer, integer, text) to authenticated;
grant execute on function public.get_order(uuid) to authenticated;
grant execute on function public.transition_order_status(uuid, text) to authenticated;

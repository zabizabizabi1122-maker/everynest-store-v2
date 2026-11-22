-- =============================================================================
-- EveryNest - Guest checkout and admin-managed order workflow
-- =============================================================================
-- Business-rule change (approved by the owner):
--   * Customers no longer authenticate. `place_order` is callable by `anon`.
--   * Customer identity lives on the order itself (name, phone, optional email,
--     address, city, product requirements and notes). `orders.user_id` becomes
--     nullable and is no longer an ownership/authorization anchor.
--   * Idempotency is scoped to the client-generated key alone, because a guest
--     has no user_id. A UNIQUE constraint still makes concurrent retries safe.
--   * Statuses expand to the admin-managed lifecycle:
--     pending -> contacted -> verified -> processing -> shipped -> delivered,
--     with cancelled reachable from every non-terminal state.
--   * Only staff/admin may read, list or transition orders. Guests receive the
--     order result directly from `place_order`; they get no table SELECT and no
--     follow-up lookup RPC.
--
-- No destructive data change is performed: existing orders keep their user_id,
-- coupon columns and history. Only constraints, grants and functions change.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Schema changes
-- -----------------------------------------------------------------------------
alter table public.orders
  drop constraint if exists orders_customer_idempotency_unique,
  drop constraint if exists orders_status_check,
  alter column user_id drop not null,
  add column email text,
  add column requirements text,
  add column notes text,
  add constraint orders_idempotency_unique unique (idempotency_key),
  add constraint orders_status_check check (
    status in (
      'pending', 'contacted', 'verified', 'processing',
      'shipped', 'delivered', 'cancelled'
    )
  ),
  add constraint orders_email_format check (
    email is null
    or (
      char_length(email) between 3 and 254
      and email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
  ),
  add constraint orders_requirements_length check (
    requirements is null or char_length(requirements) <= 1000
  ),
  add constraint orders_notes_length check (
    notes is null or char_length(notes) <= 2000
  );

create index if not exists orders_phone_idx on public.orders (phone);

comment on column public.orders.user_id is
  'Legacy column. Null for guest orders; never used for client authorization.';
comment on column public.orders.email is
  'Optional guest email, lowercased and validated by place_order.';
comment on column public.orders.requirements is
  'Product specifications or special requirements supplied by the guest.';
comment on column public.orders.notes is
  'Optional order notes supplied by the guest.';

-- Customer-owned RLS is obsolete: there are no customer accounts any more.
-- Staff policies from Levels 8-9 remain, and all order RPCs are SECURITY DEFINER
-- with their own explicit staff checks.
drop policy if exists orders_select_own on public.orders;
drop policy if exists order_items_select_own on public.order_items;

-- -----------------------------------------------------------------------------
-- 2. Shared JSON helpers
-- -----------------------------------------------------------------------------
-- The checkout confirmation must show order id, product name, quantity,
-- customer name and status, so the result now carries immutable invoice lines.
create or replace function private.order_result_json(p_order public.orders)
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
    'email', p_order.email,
    'address', p_order.address,
    'city', p_order.city,
    'requirements', p_order.requirements,
    'notes', p_order.notes,
    'createdAt', p_order.created_at,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'productName', oi.product_name,
            'variantLabel', oi.variant_label,
            'quantity', oi.quantity,
            'pricePaisa', oi.price_paisa,
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

revoke all on function private.order_result_json(public.orders) from public;
revoke all on function private.order_result_json(public.orders) from anon;
revoke all on function private.order_result_json(public.orders) from authenticated;

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
    'email', p_order.email,
    'address', p_order.address,
    'city', p_order.city,
    'requirements', p_order.requirements,
    'notes', p_order.notes,
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
-- 3. Guest checkout RPC
-- -----------------------------------------------------------------------------
drop function if exists public.place_order(uuid, jsonb, text, text, text, text, text);

create or replace function public.place_order(
  p_idempotency_key uuid,
  p_items           jsonb,
  p_customer_name   text,
  p_phone           text,
  p_address         text,
  p_city            text,
  p_email           text default null,
  p_requirements    text default null,
  p_notes           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name           text := btrim(coalesce(p_customer_name, ''));
  v_address        text := btrim(coalesce(p_address, ''));
  v_city           text := btrim(coalesce(p_city, ''));
  v_phone          text := private.normalize_pakistani_phone(p_phone);
  v_email          text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_requirements   text := nullif(btrim(coalesce(p_requirements, '')), '');
  v_notes          text := nullif(btrim(coalesce(p_notes, '')), '');
  v_items          jsonb := '[]'::jsonb;
  v_sorted         jsonb := '[]'::jsonb;
  v_snapshot       jsonb := '[]'::jsonb;
  v_fingerprint    text;
  v_existing       public.orders;
  v_order          public.orders;
  v_item           jsonb;
  v_variant        public.product_variants;
  v_product        public.products;
  v_variant_id     uuid;
  v_quantity       integer;
  v_unit_price     integer;
  v_line_count     integer;
  v_attributes     text;
  v_shipping       bigint := 0;
  v_discount       bigint := 0;
  v_subtotal       bigint := 0;
  v_total          bigint;
begin
  if p_idempotency_key is null then
    raise exception 'A valid idempotency key is required'
      using errcode = '22023';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Invalid customer name'
      using errcode = '22023';
  end if;

  if v_phone is null then
    raise exception 'Invalid phone number'
      using errcode = '22023';
  end if;

  if v_email is not null
     and (
       char_length(v_email) < 3
       or char_length(v_email) > 254
       or v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
     ) then
    raise exception 'Invalid email address'
      using errcode = '22023';
  end if;

  if char_length(v_city) < 2 or char_length(v_city) > 100 then
    raise exception 'Invalid city'
      using errcode = '22023';
  end if;

  if char_length(v_address) < 10 or char_length(v_address) > 500 then
    raise exception 'Invalid delivery address'
      using errcode = '22023';
  end if;

  if v_requirements is not null and char_length(v_requirements) > 1000 then
    raise exception 'Product requirements are too long'
      using errcode = '22023';
  end if;

  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'Order notes are too long'
      using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be an array'
      using errcode = '22023';
  end if;

  v_line_count := jsonb_array_length(p_items);
  if v_line_count < 1 or v_line_count > 50 then
    raise exception 'An order must contain between 1 and 50 lines'
      using errcode = '22023';
  end if;

  -- Rebuild items from scratch. Browser-supplied prices/names are never trusted.
  for v_item in select value from jsonb_array_elements(p_items) as t(value)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or exists (select 1 from jsonb_each(v_item) as e(k, v)
                   where e.k not in ('variantId', 'quantity'))
       or not (v_item ? 'variantId')
       or not (v_item ? 'quantity')
       or jsonb_typeof(v_item -> 'variantId') <> 'string'
       or jsonb_typeof(v_item -> 'quantity') <> 'number'
       or (v_item ->> 'variantId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
       or (v_item ->> 'quantity') !~ '^[0-9]+$' then
      raise exception 'Invalid order item'
        using errcode = '22023';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Invalid order quantity'
        using errcode = '22023';
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'variantId', lower(v_item ->> 'variantId'),
      'quantity', v_quantity
    ));
  end loop;

  if (select count(distinct value ->> 'variantId')
        from jsonb_array_elements(v_items) as t(value)) <> v_line_count then
    raise exception 'Duplicate variants are not allowed in one order'
      using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(value order by value ->> 'variantId' asc), '[]'::jsonb)
    into v_sorted
    from jsonb_array_elements(v_items) as t(value);

  v_fingerprint := md5(jsonb_build_object(
    'name', v_name,
    'phone', v_phone,
    'email', v_email,
    'address', v_address,
    'city', v_city,
    'requirements', v_requirements,
    'notes', v_notes,
    'items', v_sorted
  )::text);

  -- Same key + same normalized payload is a retry, not a second order.
  select * into v_existing
    from public.orders
   where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception 'This checkout key was used with different order details'
        using errcode = 'P0003';
    end if;

    return private.order_result_json(v_existing);
  end if;

  -- Lightweight abuse guard for the public RPC. Retries above returned early.
  if (select count(*)
        from public.orders
       where phone = v_phone
         and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many recent orders from this phone number. Please try again later.'
      using errcode = 'P0001';
  end if;

  -- Lock every requested variant in ascending id order. Stock and price are
  -- read from these locked rows, never from the browser.
  for v_item in select value from jsonb_array_elements(v_sorted) as t(value)
  loop
    v_variant_id := (v_item ->> 'variantId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select * into v_variant
      from public.product_variants
     where id = v_variant_id
       for update;

    if not found then
      raise exception 'Variant not found'
        using errcode = 'P0002';
    end if;

    -- A concurrent twin may have committed while we waited for this lock.
    select * into v_existing
      from public.orders
     where idempotency_key = p_idempotency_key;

    if found then
      if v_existing.request_fingerprint is distinct from v_fingerprint then
        raise exception 'This checkout key was used with different order details'
          using errcode = 'P0003';
      end if;

      return private.order_result_json(v_existing);
    end if;

    if not v_variant.is_active then
      raise exception 'A selected variant is no longer available'
        using errcode = '22023';
    end if;

    select * into v_product
      from public.products
     where id = v_variant.product_id;

    if not found or not v_product.is_active then
      raise exception 'A selected product is no longer available'
        using errcode = '22023';
    end if;

    if v_variant.stock < v_quantity then
      raise exception 'Insufficient stock for a selected variant'
        using errcode = 'P0001';
    end if;

    v_unit_price := coalesce(v_variant.sale_price_paisa, v_variant.price_paisa);
    if v_unit_price < 0 then
      raise exception 'Invalid variant price'
        using errcode = '23514';
    end if;

    v_subtotal := v_subtotal + v_unit_price::bigint * v_quantity::bigint;

    select coalesce(
      string_agg(format('%s: %s', e.key, e.value), ', ' order by e.key),
      ''
    ) into v_attributes
      from jsonb_each_text(v_variant.attributes) as e(key, value);

    if v_attributes = '' then
      v_attributes := v_variant.sku;
    end if;

    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'variantId', v_variant.id,
      'productName', v_product.name,
      'variantLabel', v_attributes,
      'pricePaisa', v_unit_price,
      'quantity', v_quantity
    ));
  end loop;

  v_total := v_subtotal + v_shipping - v_discount;
  if v_total < 0 then
    raise exception 'Invalid order total'
      using errcode = '23514';
  end if;

  begin
    insert into public.orders (
      order_number,
      user_id,
      status,
      subtotal_paisa,
      shipping_paisa,
      discount_paisa,
      total_paisa,
      customer_name,
      phone,
      email,
      address,
      city,
      requirements,
      notes,
      idempotency_key,
      request_fingerprint
    )
    values (
      format(
        'ZS-%s-%s',
        to_char(now() at time zone 'Asia/Karachi', 'YYYYMM'),
        lpad(nextval('public.order_number_seq')::text, 6, '0')
      ),
      null,
      'pending',
      v_subtotal,
      v_shipping,
      v_discount,
      v_total,
      v_name,
      v_phone,
      v_email,
      v_address,
      v_city,
      v_requirements,
      v_notes,
      p_idempotency_key,
      v_fingerprint
    )
    returning * into v_order;
  exception when unique_violation then
    select * into v_order
      from public.orders
     where idempotency_key = p_idempotency_key;

    if not found then
      raise exception 'The order could not be confirmed'
        using errcode = 'P0001';
    end if;

    if v_order.request_fingerprint is distinct from v_fingerprint then
      raise exception 'This checkout key was used with different order details'
        using errcode = 'P0003';
    end if;

    return private.order_result_json(v_order);
  end;

  insert into public.order_items (
    order_id,
    variant_id,
    product_name,
    variant_label,
    price_paisa,
    quantity
  )
  select
    v_order.id,
    (s.value ->> 'variantId')::uuid,
    s.value ->> 'productName',
    s.value ->> 'variantLabel',
    (s.value ->> 'pricePaisa')::integer,
    (s.value ->> 'quantity')::integer
    from jsonb_array_elements(v_snapshot) as s(value);

  -- Stock changes and their ledger rows are appended in this same transaction.
  for v_item in select value from jsonb_array_elements(v_snapshot) as t(value)
  loop
    perform private.apply_stock_movement(
      (v_item ->> 'variantId')::uuid,
      - (v_item ->> 'quantity')::integer,
      'sale',
      null,
      'Order ' || v_order.order_number,
      v_order.id
    );
  end loop;

  return private.order_result_json(v_order);
end;
$$;

revoke all on function public.place_order(uuid, jsonb, text, text, text, text, text, text, text) from public;
revoke all on function public.place_order(uuid, jsonb, text, text, text, text, text, text, text) from anon;
revoke all on function public.place_order(uuid, jsonb, text, text, text, text, text, text, text) from authenticated;

comment on function public.place_order(uuid, jsonb, text, text, text, text, text, text, text) is
  'Atomic guest COD checkout. Validates all input server-side, snapshots prices and decrements stock in one transaction.';

-- Guests must be able to call checkout; admin/staff may also use it for testing.
grant execute on function public.place_order(uuid, jsonb, text, text, text, text, text, text, text)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Staff-only order list with search
-- -----------------------------------------------------------------------------
drop function if exists public.list_orders(integer, integer, text);

create or replace function public.list_orders(
  p_page      integer default 1,
  p_page_size integer default 20,
  p_status    text default null,
  p_search    text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search   text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_total    bigint;
  v_offset   integer;
  v_orders   jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to view orders'
      using errcode = '42501';
  end if;

  if not private.is_staff() then
    raise exception 'Only staff may view orders'
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
     and p_status not in (
       'pending', 'contacted', 'verified', 'processing',
       'shipped', 'delivered', 'cancelled'
     ) then
    raise exception 'Invalid order status'
      using errcode = '22023';
  end if;

  if v_search is not null and char_length(v_search) > 100 then
    raise exception 'Search text is too long'
      using errcode = '22023';
  end if;

  v_offset := (p_page - 1) * p_page_size;

  select count(*)
    into v_total
    from public.orders o
   where (p_status is null or o.status = p_status)
     and (
       v_search is null
       or o.order_number ilike '%' || v_search || '%'
       or o.customer_name ilike '%' || v_search || '%'
       or o.phone ilike '%' || v_search || '%'
     );

  select coalesce(
    jsonb_agg(private.order_summary_json(o) order by o.created_at desc, o.id desc),
    '[]'::jsonb
  )
    into v_orders
    from (
      select o.*
        from public.orders o
       where (p_status is null or o.status = p_status)
         and (
           v_search is null
           or o.order_number ilike '%' || v_search || '%'
           or o.customer_name ilike '%' || v_search || '%'
           or o.phone ilike '%' || v_search || '%'
         )
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

revoke all on function public.list_orders(integer, integer, text, text) from public;
revoke all on function public.list_orders(integer, integer, text, text) from anon;

comment on function public.list_orders(integer, integer, text, text) is
  'Staff-only paginated order list with optional status filter and order id/name/phone search.';

grant execute on function public.list_orders(integer, integer, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Staff-only order detail
-- -----------------------------------------------------------------------------
create or replace function public.get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to view an order'
      using errcode = '42501';
  end if;

  if not private.is_staff() then
    raise exception 'Only staff may view orders'
      using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'A valid order id is required'
      using errcode = '22023';
  end if;

  select o.*
    into v_order
    from public.orders o
   where o.id = p_order_id;

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
  'Staff-only order detail with immutable invoice lines and full guest contact information.';

grant execute on function public.get_order(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Admin-only status transitions
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
  v_order      public.orders;
  v_item       record;
  v_old_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to change an order'
      using errcode = '42501';
  end if;

  if not private.is_staff() then
    raise exception 'Only staff may change order status'
      using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'A valid order id is required'
      using errcode = '22023';
  end if;

  if p_target_status is null or p_target_status not in (
    'contacted', 'verified', 'processing', 'shipped', 'delivered', 'cancelled'
  ) then
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

  if v_order.status = p_target_status then
    return private.order_detail_json(v_order);
  end if;

  v_old_status := v_order.status;

  if not (
    (v_old_status = 'pending'     and p_target_status in ('contacted', 'cancelled'))
    or (v_old_status = 'contacted'  and p_target_status in ('verified', 'cancelled'))
    or (v_old_status = 'verified'   and p_target_status in ('processing', 'cancelled'))
    or (v_old_status = 'processing' and p_target_status in ('shipped', 'cancelled'))
    or (v_old_status = 'shipped'    and p_target_status = 'delivered')
  ) then
    raise exception 'Invalid order status transition'
      using errcode = '22023';
  end if;

  update public.orders
     set status = p_target_status
   where id = v_order.id
  returning * into v_order;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()),
    'order.status_change',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'from', v_old_status,
      'to', p_target_status,
      'orderNumber', v_order.order_number
    )
  );

  -- Cancelling an unpaid COD order returns its reserved stock exactly once.
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
  'Staff-only atomic status change. Cancellation restores stock once through private.apply_stock_movement.';

grant execute on function public.transition_order_status(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Reports: a sale now means an order the admin has verified and progressed.
-- -----------------------------------------------------------------------------
create or replace function public.get_reports_data(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today           date := (now() at time zone 'Asia/Karachi')::date;
  v_start_day       date;
  v_start_ts        timestamptz;
  v_end_ts          timestamptz;
  v_total_sales     bigint := 0;
  v_total_orders    bigint := 0;
  v_status_counts   jsonb;
  v_active_products bigint := 0;
  v_active_variants bigint := 0;
  v_low_stock_count bigint := 0;
  v_top_products    jsonb;
  v_low_stock       jsonb;
  v_recent_orders   jsonb;
  v_daily_sales     jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to view reports'
      using errcode = '42501';
  end if;

  if not private.is_staff() then
    raise exception 'Only staff may view reports'
      using errcode = '42501';
  end if;

  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'Invalid reporting period'
      using errcode = '22023';
  end if;

  v_start_day := v_today - (p_days - 1);
  v_start_ts  := v_start_day::timestamp at time zone 'Asia/Karachi';
  v_end_ts    := (v_today + 1)::timestamp at time zone 'Asia/Karachi';

  select coalesce(sum(o.total_paisa), 0), count(*)
    into v_total_sales, v_total_orders
    from public.orders o
   where o.status in ('verified', 'processing', 'shipped', 'delivered');

  select jsonb_build_object(
           'pending',    count(*) filter (where o.status = 'pending')::integer,
           'contacted',  count(*) filter (where o.status = 'contacted')::integer,
           'verified',   count(*) filter (where o.status = 'verified')::integer,
           'processing', count(*) filter (where o.status = 'processing')::integer,
           'shipped',    count(*) filter (where o.status = 'shipped')::integer,
           'delivered',  count(*) filter (where o.status = 'delivered')::integer,
           'cancelled',  count(*) filter (where o.status = 'cancelled')::integer,
           'all',        count(*)::integer
         )
    into v_status_counts
    from public.orders o;

  select count(distinct p.id) filter (where p.is_active),
         count(distinct v.id) filter (where v.is_active),
         count(distinct v.id) filter (where v.is_active and v.stock <= v.reorder_level)
    into v_active_products, v_active_variants, v_low_stock_count
    from public.products p
    join public.product_variants v on v.product_id = p.id;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'variantId',   x.variant_id,
               'productName', x.product_name,
               'variantLabel', x.variant_label,
               'sku',         coalesce(v.sku, ''),
               'unitsSold',   x.units_sold,
               'revenuePaisa', x.revenue_paisa::text
             )
             order by x.units_sold desc, x.revenue_paisa desc, x.product_name
           ),
           '[]'::jsonb
         )
    into v_top_products
    from (
      select oi.variant_id,
             oi.product_name,
             oi.variant_label,
             sum(oi.quantity)::integer as units_sold,
             sum(oi.price_paisa::bigint * oi.quantity::bigint) as revenue_paisa
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where o.status in ('verified', 'processing', 'shipped', 'delivered')
       group by oi.variant_id, oi.product_name, oi.variant_label
       order by units_sold desc, revenue_paisa desc
       limit 10
    ) as x
    left join public.product_variants v on v.id = x.variant_id;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'variantId',    v.id,
               'sku',          v.sku,
               'productName',  p.name,
               'stock',        v.stock,
               'reorderLevel', v.reorder_level
             )
             order by v.stock asc, v.sku
           ),
           '[]'::jsonb
         )
    into v_low_stock
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where v.is_active and v.stock <= v.reorder_level;

  select coalesce(
           jsonb_agg(private.order_summary_json(o) order by o.created_at desc, o.id desc),
           '[]'::jsonb
         )
    into v_recent_orders
    from (
      select o.*
        from public.orders o
       order by o.created_at desc, o.id desc
       limit 5
    ) as o;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'day',          to_char(d.day, 'YYYY-MM-DD'),
               'orders',       coalesce(s.order_count, 0),
               'revenuePaisa', coalesce(s.revenue_paisa, 0)::text
             )
             order by d.day
           ),
           '[]'::jsonb
         )
    into v_daily_sales
    from generate_series(v_start_day, v_today, interval '1 day') as d(day)
    left join (
      select (o.created_at at time zone 'Asia/Karachi')::date as day,
             count(*)::integer as order_count,
             sum(o.total_paisa) as revenue_paisa
        from public.orders o
       where o.status in ('verified', 'processing', 'shipped', 'delivered')
         and o.created_at >= v_start_ts
         and o.created_at < v_end_ts
       group by 1
    ) as s on s.day = d.day::date;

  return jsonb_build_object(
    'generatedAt',      now(),
    'timezone',         'Asia/Karachi',
    'days',             p_days,
    'totalSalesPaisa',  v_total_sales::text,
    'totalOrders',      v_total_orders::integer,
    'statusCounts',     v_status_counts,
    'activeProducts',   v_active_products::integer,
    'activeVariants',   v_active_variants::integer,
    'lowStockCount',    v_low_stock_count::integer,
    'topProducts',      v_top_products,
    'lowStock',         v_low_stock,
    'recentOrders',     v_recent_orders,
    'dailySales',       v_daily_sales
  );
end;
$$;

revoke all on function public.get_reports_data(integer) from public;
revoke all on function public.get_reports_data(integer) from anon;

comment on function public.get_reports_data(integer) is
  'Staff-only reports. Sales count verified/processing/shipped/delivered guest orders.';

grant execute on function public.get_reports_data(integer) to authenticated;

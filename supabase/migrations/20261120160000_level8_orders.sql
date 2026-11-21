-- =============================================================================
-- EveryNest - Level 8
-- 0001: orders, order items and the atomic COD checkout RPC
-- =============================================================================
-- The browser cart is never authoritative. `public.place_order` is the single
-- transaction that validates input, locks variants in a stable order, reads the
-- current catalogue prices, snapshots historical order items, inserts the order
-- and reduces stock through the same private stock helper used by staff
-- adjustments. Any failure rolls the whole checkout back.
--
-- No payment gateway is involved: payment method is Cash on Delivery only.
-- =============================================================================

-- Human-readable order numbers come from a database sequence rather than from
-- random application values, so they are unique under concurrent checkouts.
create sequence public.order_number_seq as bigint;

comment on sequence public.order_number_seq is
  'Monotonic source for public.orders.order_number; advanced only inside place_order.';

-- -----------------------------------------------------------------------------
-- Historical orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null unique,
  user_id            uuid not null references public.profiles (id) on delete restrict,
  status             text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  subtotal_paisa     bigint not null check (subtotal_paisa >= 0),
  shipping_paisa     bigint not null check (shipping_paisa >= 0),
  discount_paisa     bigint not null default 0 check (discount_paisa >= 0),
  total_paisa        bigint not null check (total_paisa >= 0),
  customer_name      text not null check (char_length(customer_name) between 2 and 100),
  phone              text not null check (phone ~ '^[+]923[0-9]{9}$'),
  address            text not null check (char_length(address) between 10 and 500),
  city               text not null check (char_length(city) between 2 and 100),
  idempotency_key    uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  created_at         timestamptz not null default now(),
  constraint orders_customer_idempotency_unique unique (user_id, idempotency_key)
);

comment on table public.orders is
  'Customer order. Money is integer paisa; totals are bigint. Rows are written only by trusted place_order.';

comment on column public.orders.request_fingerprint is
  'md5 hash of the normalized checkout payload, used to detect idempotency-key reuse with different details.';

-- -----------------------------------------------------------------------------
-- Immutable invoice lines: catalogue edits must never change a past order.
-- -----------------------------------------------------------------------------
create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete restrict,
  variant_id    uuid not null references public.product_variants (id) on delete restrict,
  product_name  text not null check (char_length(product_name) between 1 and 200),
  variant_label text not null check (char_length(variant_label) between 1 and 300),
  price_paisa   integer not null check (price_paisa >= 0),
  quantity      integer not null check (quantity > 0 and quantity <= 99),
  constraint order_items_order_variant_unique unique (order_id, variant_id)
);

comment on table public.order_items is
  'Historical order lines. Product name, variant label and unit price are snapshots, never live catalogue lookups.';

-- Stock movements created by place_order can now point at their order.
alter table public.stock_movements
  add constraint stock_movements_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete restrict;

-- -----------------------------------------------------------------------------
-- Indexes for customer lookups, staff operations and joins.
-- -----------------------------------------------------------------------------
create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

-- -----------------------------------------------------------------------------
-- Private helpers. No client role receives EXECUTE on these.
-- -----------------------------------------------------------------------------
create or replace function private.normalize_pakistani_phone(p_input text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_cleaned  text;
  v_national text;
begin
  if p_input is null then
    return null;
  end if;

  -- POSIX [[:space:]] is portable inside a bracket expression; \s is not.
  v_cleaned := regexp_replace(btrim(p_input), '[[:space:]().-]', '', 'g');

  if v_cleaned ~ '^0[0-9]{10}$' then
    v_national := substring(v_cleaned from 2);
  elsif v_cleaned ~ '^[+]92[0-9]{10}$' then
    v_national := substring(v_cleaned from 4);
  elsif v_cleaned ~ '^0092[0-9]{10}$' then
    v_national := substring(v_cleaned from 5);
  elsif v_cleaned ~ '^92[0-9]{10}$' then
    v_national := substring(v_cleaned from 3);
  else
    return null;
  end if;

  if v_national !~ '^3[0-9]{9}$' then
    return null;
  end if;

  return '+92' || v_national;
end;
$$;

revoke all on function private.normalize_pakistani_phone(text) from public;
revoke all on function private.normalize_pakistani_phone(text) from anon;
revoke all on function private.normalize_pakistani_phone(text) from authenticated;

-- Returns totals as decimal strings: bigint through PostgREST can otherwise be
-- coerced to a JavaScript Number and lose precision. The client validates these
-- strings with Zod before formatting.
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
    'address', p_order.address,
    'city', p_order.city,
    'createdAt', p_order.created_at
  );
$$;

revoke all on function private.order_result_json(public.orders) from public;
revoke all on function private.order_result_json(public.orders) from anon;
revoke all on function private.order_result_json(public.orders) from authenticated;

-- -----------------------------------------------------------------------------
-- The checkout transaction.
-- -----------------------------------------------------------------------------
create or replace function public.place_order(
  p_idempotency_key uuid,
  p_items           jsonb,
  p_customer_name   text,
  p_phone           text,
  p_address         text,
  p_city            text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id      uuid := (select auth.uid());
  v_name         text := btrim(coalesce(p_customer_name, ''));
  v_address      text := btrim(coalesce(p_address, ''));
  v_city         text := btrim(coalesce(p_city, ''));
  v_phone        text := private.normalize_pakistani_phone(p_phone);
  v_profile_ok   boolean;
  v_items        jsonb := '[]'::jsonb;
  v_sorted       jsonb := '[]'::jsonb;
  v_snapshot     jsonb := '[]'::jsonb;
  v_fingerprint  text;
  v_existing     public.orders;
  v_order        public.orders;
  v_item         jsonb;
  v_variant      public.product_variants;
  v_product      public.products;
  v_variant_id   uuid;
  v_quantity     integer;
  v_unit_price   integer;
  v_line_count   integer;
  v_attributes   text;
  -- Free shipping by default. This is the authoritative server-side value;
  -- src/lib/checkout.ts mirrors it for display only.
  v_shipping     bigint := 0;
  v_discount     bigint := 0;
  v_subtotal     bigint := 0;
  v_total        bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to place an order'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'A valid idempotency key is required'
      using errcode = '22023';
  end if;

  select exists(select 1 from public.profiles where id = v_user_id)
    into v_profile_ok;

  if not v_profile_ok then
    raise exception 'Customer profile not found'
      using errcode = 'P0002';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Invalid customer name'
      using errcode = '22023';
  end if;

  if v_phone is null then
    raise exception 'Invalid phone number'
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

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be an array'
      using errcode = '22023';
  end if;

  v_line_count := jsonb_array_length(p_items);
  if v_line_count < 1 or v_line_count > 50 then
    raise exception 'An order must contain between 1 and 50 lines'
      using errcode = '22023';
  end if;

  -- Rebuild the item list from scratch: only variantId and quantity are read,
  -- and anything else (including browser-supplied prices) is rejected.
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

  -- Stable order for deadlock-safe row locking and a deterministic fingerprint.
  select coalesce(jsonb_agg(value order by value ->> 'variantId' asc), '[]'::jsonb)
    into v_sorted
    from jsonb_array_elements(v_items) as t(value);

  v_fingerprint := md5(jsonb_build_object(
    'name', v_name,
    'phone', v_phone,
    'address', v_address,
    'city', v_city,
    'items', v_sorted
  )::text);

  -- Same key + same normalized payload is a retry, not a second order.
  select * into v_existing
    from public.orders
   where user_id = v_user_id
     and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception 'This checkout key was used with different order details'
        using errcode = 'P0003';
    end if;

    return private.order_result_json(v_existing);
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
    -- Return its order before validating stock so a 1-unit retry succeeds.
    select * into v_existing
      from public.orders
     where user_id = v_user_id
       and idempotency_key = p_idempotency_key;

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

  -- The unique constraint is the final guard against concurrent duplicate
  -- submissions. A loser that sent the same payload gets its original order.
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
      address,
      city,
      idempotency_key,
      request_fingerprint
    )
    values (
      format(
        'ZS-%s-%s',
        to_char(now() at time zone 'Asia/Karachi', 'YYYYMM'),
        lpad(nextval('public.order_number_seq')::text, 6, '0')
      ),
      v_user_id,
      'pending',
      v_subtotal,
      v_shipping,
      v_discount,
      v_total,
      v_name,
      v_phone,
      v_address,
      v_city,
      p_idempotency_key,
      v_fingerprint
    )
    returning * into v_order;
  exception when unique_violation then
    select * into v_order
      from public.orders
     where user_id = v_user_id
       and idempotency_key = p_idempotency_key;

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

revoke all on function public.place_order(uuid, jsonb, text, text, text, text) from public;
revoke all on function public.place_order(uuid, jsonb, text, text, text, text) from anon;

comment on function public.place_order(uuid, jsonb, text, text, text, text) is
  'Atomic COD checkout. Revalidates catalogue/stock, snapshots invoice lines and records sale stock movements.';

-- -----------------------------------------------------------------------------
-- Least privilege: customers read their own orders only; staff read all orders
-- for operations. Nobody gets direct write access to orders or order items.
-- -----------------------------------------------------------------------------
revoke all on table public.orders, public.order_items from anon, authenticated;
grant select on table public.orders, public.order_items to authenticated;

grant execute on function public.place_order(uuid, jsonb, text, text, text, text)
  to authenticated;

alter table public.orders enable row level security;

create policy orders_select_own
  on public.orders
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy orders_select_staff
  on public.orders
  for select
  to authenticated
  using (private.is_staff());

alter table public.order_items enable row level security;

create policy order_items_select_own
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = order_id
         and o.user_id = (select auth.uid())
    )
  );

create policy order_items_select_staff
  on public.order_items
  for select
  to authenticated
  using (private.is_staff());

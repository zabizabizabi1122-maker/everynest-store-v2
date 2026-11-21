-- =============================================================================
-- EveryNest - Level 11, feature 1 of 4
-- Coupons: validated discount codes applied inside the atomic checkout RPC.
-- =============================================================================
-- Security model:
--   * Coupon terms are never trusted from the browser. `place_order` reads the
--     coupon row itself, locks it, and computes the paisa discount in the same
--     transaction as the order, stock movements and redemption record.
--   * Customers can only learn a coupon's public terms by code through
--     `public.validate_coupon`; they receive no table SELECT and cannot enumerate
--     codes. Staff may read coupons; only admins may create/edit them.
--   * Redemptions are append-only and written only by the trusted checkout RPC.
--   * SECURITY DEFINER functions pin search_path = '' and derive the caller from
--     auth.uid(); no actor id is accepted from the client.
-- =============================================================================

create table public.coupons (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  description        text,
  discount_type      text not null check (discount_type in ('percent', 'fixed_paisa')),
  -- percent: 1..100. fixed_paisa: a positive integer number of paisa.
  discount_value     bigint not null check (discount_value > 0),
  min_subtotal_paisa bigint not null default 0 check (min_subtotal_paisa >= 0),
  max_uses           integer check (max_uses is null or max_uses > 0),
  used_count         integer not null default 0 check (used_count >= 0),
  starts_at          timestamptz not null default now(),
  ends_at            timestamptz,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint coupons_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,29}$'),
  constraint coupons_percent_range
    check (discount_type <> 'percent' or discount_value between 1 and 100),
  constraint coupons_window_valid
    check (ends_at is null or ends_at > starts_at),
  constraint coupons_usage_valid
    check (max_uses is null or used_count <= max_uses)
);

comment on table public.coupons is
  'Admin-managed discount codes. Money values are integer paisa; totals are bigint.';

create index coupons_active_code_idx on public.coupons (code) where is_active;

create trigger set_coupons_updated_at
  before update on public.coupons
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- One redemption per customer per coupon. Written only by place_order.
-- -----------------------------------------------------------------------------
create table public.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons (id) on delete restrict,
  user_id     uuid not null references public.profiles (id) on delete restrict,
  order_id    uuid not null references public.orders (id) on delete restrict,
  redeemed_at timestamptz not null default now(),
  constraint coupon_redemptions_once_per_customer unique (coupon_id, user_id)
);

create index coupon_redemptions_order_idx on public.coupon_redemptions (order_id);

comment on table public.coupon_redemptions is
  'Append-only record that a customer redeemed a coupon on one order. Written only by public.place_order.';

-- -----------------------------------------------------------------------------
-- Historic orders remember which coupon produced their discount.
-- -----------------------------------------------------------------------------
alter table public.orders
  add column coupon_id uuid references public.coupons (id) on delete restrict,
  add column coupon_code text,
  add column coupon_discount_paisa bigint not null default 0
    check (coupon_discount_paisa >= 0);

create index orders_coupon_id_idx on public.orders (coupon_id);

-- -----------------------------------------------------------------------------
-- Public, read-only coupon lookup by exact code.
-- Reveals only the marketing terms of one active, currently valid coupon.
-- -----------------------------------------------------------------------------
create or replace function public.validate_coupon(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_code    text := upper(btrim(coalesce(p_code, '')));
  v_coupon  public.coupons;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to check a coupon'
      using errcode = '42501';
  end if;

  if v_code !~ '^[A-Z0-9][A-Z0-9_-]{1,29}$' then
    raise exception 'Invalid coupon code'
      using errcode = '22023';
  end if;

  select * into v_coupon
    from public.coupons c
   where c.code = v_code
     and c.is_active
     and c.starts_at <= now()
     and (c.ends_at is null or c.ends_at > now())
     and (c.max_uses is null or c.used_count < c.max_uses);

  if not found then
    raise exception 'This coupon is not available'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'code',              v_coupon.code,
    'description',       coalesce(v_coupon.description, ''),
    'discountType',      v_coupon.discount_type,
    'discountValue',     v_coupon.discount_value::text,
    'minSubtotalPaisa',  v_coupon.min_subtotal_paisa::text
  );
end;
$$;

revoke all on function public.validate_coupon(text) from public;
revoke all on function public.validate_coupon(text) from anon;

comment on function public.validate_coupon(text) is
  'Authenticated coupon-term lookup by exact code. Never reveals inactive, expired or exhausted codes.';

grant execute on function public.validate_coupon(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Replace place_order with a coupon-aware version. The 6-argument form is
-- removed so there is exactly one RPC signature for the client to call.
-- Everything from Level 8 (validation, locking, idempotency, stock) is kept.
-- -----------------------------------------------------------------------------
drop function if exists public.place_order(uuid, jsonb, text, text, text, text);

create or replace function public.place_order(
  p_idempotency_key uuid,
  p_items           jsonb,
  p_customer_name   text,
  p_phone           text,
  p_address         text,
  p_city            text,
  p_coupon_code     text default null
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
  v_coupon_code  text := nullif(upper(btrim(coalesce(p_coupon_code, ''))), '');
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
  v_coupon       public.coupons;
  v_variant_id   uuid;
  v_quantity     integer;
  v_unit_price   integer;
  v_line_count   integer;
  v_attributes   text;
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

  if v_coupon_code is not null and v_coupon_code !~ '^[A-Z0-9][A-Z0-9_-]{1,29}$' then
    raise exception 'Invalid coupon code'
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
    'address', v_address,
    'city', v_city,
    'items', v_sorted,
    'coupon', v_coupon_code
  )::text);

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

  -- Coupon is validated and locked only after every variant is locked, so a
  -- duplicate checkout has already returned above and cannot consume a use.
  if v_coupon_code is not null then
    select * into v_coupon
      from public.coupons c
     where c.code = v_coupon_code
       for update;

    if not found
       or not v_coupon.is_active
       or v_coupon.starts_at > now()
       or (v_coupon.ends_at is not null and v_coupon.ends_at <= now())
       or (v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses)
       or v_subtotal < v_coupon.min_subtotal_paisa then
      raise exception 'This coupon is not valid for your order'
        using errcode = 'P0002';
    end if;

    if exists (
      select 1 from public.coupon_redemptions r
       where r.coupon_id = v_coupon.id and r.user_id = v_user_id
    ) then
      raise exception 'You have already used this coupon'
        using errcode = 'P0002';
    end if;

    if v_coupon.discount_type = 'percent' then
      v_discount := (v_subtotal * v_coupon.discount_value) / 100;
    else
      v_discount := least(v_coupon.discount_value, v_subtotal);
    end if;

    if v_discount < 0 or v_discount > v_subtotal then
      raise exception 'Invalid coupon discount'
        using errcode = '23514';
    end if;
  end if;

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
      address,
      city,
      idempotency_key,
      request_fingerprint,
      coupon_id,
      coupon_code,
      coupon_discount_paisa
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
      v_fingerprint,
      v_coupon.id,
      v_coupon_code,
      v_discount
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

  if v_coupon.id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
      values (v_coupon.id, v_user_id, v_order.id);

    update public.coupons
       set used_count = used_count + 1
     where id = v_coupon.id;
  end if;

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

revoke all on function public.place_order(uuid, jsonb, text, text, text, text, text) from public;
revoke all on function public.place_order(uuid, jsonb, text, text, text, text, text) from anon;

comment on function public.place_order(uuid, jsonb, text, text, text, text, text) is
  'Atomic COD checkout with validated coupon support. Recomputes all money in the database.';

-- -----------------------------------------------------------------------------
-- Least privilege and RLS. Customers get NO table privilege on coupons.
-- -----------------------------------------------------------------------------
revoke all on table public.coupons, public.coupon_redemptions from anon, authenticated;

grant select on table public.coupons to authenticated;
grant insert, update on table public.coupons to authenticated;
grant select on table public.coupon_redemptions to authenticated;

grant execute on function public.place_order(uuid, jsonb, text, text, text, text, text)
  to authenticated;

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

create policy coupons_select_staff
  on public.coupons
  for select
  to authenticated
  using (private.is_staff());

create policy coupons_insert_admin
  on public.coupons
  for insert
  to authenticated
  with check (private.is_admin());

create policy coupons_update_admin
  on public.coupons
  for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy coupon_redemptions_select_staff
  on public.coupon_redemptions
  for select
  to authenticated
  using (private.is_staff());

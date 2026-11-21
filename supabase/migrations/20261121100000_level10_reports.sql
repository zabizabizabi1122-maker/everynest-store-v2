-- =============================================================================
-- EveryNest - Level 10
-- Reports and dashboard data, derived only from real order/catalogue rows.
-- =============================================================================
-- Security model:
--   * One read-only SECURITY DEFINER RPC returns every figure. It is owned by the
--     migration role, pinned to an empty search_path, and checks auth.uid() and
--     private.is_staff() explicitly (SECURITY DEFINER bypasses RLS).
--   * No new table grants, write policies or direct client reads are added.
--   * bigint money columns are returned as decimal strings, never JSON numbers,
--     so JavaScript cannot lose precision.
--   * "Sales" means a real order in confirmed/shipped/delivered status. Pending
--     and cancelled orders are excluded from revenue and top-product figures;
--     their counts are still reported separately.
--   * Day boundaries use Asia/Karachi, the store's reporting timezone.
-- =============================================================================

create or replace function public.get_reports_data(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id        uuid := (select auth.uid());
  v_today          date := (now() at time zone 'Asia/Karachi')::date;
  v_start_day      date;
  v_start_ts       timestamptz;
  v_end_ts         timestamptz;
  v_total_sales    bigint := 0;
  v_total_orders   bigint := 0;
  v_status_counts  jsonb;
  v_active_products bigint := 0;
  v_active_variants bigint := 0;
  v_low_stock_count bigint := 0;
  v_top_products   jsonb;
  v_low_stock      jsonb;
  v_recent_orders  jsonb;
  v_daily_sales    jsonb;
begin
  if v_user_id is null then
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
   where o.status in ('confirmed', 'shipped', 'delivered');

  select jsonb_build_object(
           'pending',   count(*) filter (where o.status = 'pending')::integer,
           'confirmed', count(*) filter (where o.status = 'confirmed')::integer,
           'shipped',   count(*) filter (where o.status = 'shipped')::integer,
           'delivered', count(*) filter (where o.status = 'delivered')::integer,
           'cancelled', count(*) filter (where o.status = 'cancelled')::integer,
           'all',       count(*)::integer
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
       where o.status in ('confirmed', 'shipped', 'delivered')
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
           jsonb_agg(
             private.order_summary_json(o)
             order by o.created_at desc, o.id desc
           ),
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
       where o.status in ('confirmed', 'shipped', 'delivered')
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
  'Staff-only real sales/dashboard data for the last 7/30/90 Asia/Karachi days; bigint money returned as decimal strings.';

grant execute on function public.get_reports_data(integer) to authenticated;

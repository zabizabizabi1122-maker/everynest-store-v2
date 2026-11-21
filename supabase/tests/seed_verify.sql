select
  (select count(*) from public.categories) as categories,
  (select count(*) from public.products) as products,
  (select count(*) from public.product_variants) as variants,
  (select count(*) from public.suppliers) as suppliers,
  (select count(*) from public.stock_movements) as movements,
  (
    select count(*)
    from public.product_variants v
    where v.stock is distinct from (
      select coalesce(sum(m.change), 0)
      from public.stock_movements m
      where m.variant_id = v.id
    )
  ) as stock_ledger_mismatches,
  (select count(*) from public.product_variants where stock <= reorder_level) as low_stock,
  (
    select count(*)
    from public.product_variants
    where sale_price_paisa is not null and sale_price_paisa >= price_paisa
  ) as bad_sale_prices;

-- =============================================================================
-- EveryNest - DEVELOPMENT SEED (dummy data only)
-- =============================================================================
-- NEVER run this against a production project.
--
-- What it creates:
--   * 10 categories  (6 roots + 4 children)
--   * 12 products
--   * 25 variants    (realistic stock, including low-stock and 0-stock rows)
--   * 3 suppliers
--   * 22 stock movements matching the opening stock
--   * 12 product images (local product photos in public/products/)
--
-- Conventions:
--   * Fixed UUIDs + `on conflict do nothing`, so re-running is safe.
--   * Prices are integer paisa (Rs 2,999.00 = 299900).
--   * Attribute values are normalized (lowercase) while `attribute_schema`
--     keeps the display labels.
--   * A child category stores the *effective* schema: inherited parent
--     attributes plus its own. It may not remove an inherited key.
--   * No auth users: accounts are created through signup.
--   * Image URLs are local static product photos served by Next.js from /public.
--     They render in the catalogue, gallery and cart.
--
-- Applied to a linked project with:
--   npx supabase db query --remote --file supabase/seed.sql --yes
-- Locally it also runs on `supabase db reset` (see supabase/config.toml).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------
insert into public.categories (id, parent_id, name, slug, attribute_schema, is_active)
values
  (
    'c0000000-0000-4000-8000-000000000001',
    null,
    'Clothes',
    'clothes',
    '[
       {"key":"size","label":"Size","options":["s","m","l","xl"]},
       {"key":"color","label":"Color","options":["black","white","blue"]}
     ]'::jsonb,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    null,
    'Stationery',
    'stationery',
    '[{"key":"pack","label":"Pack size","options":["single","pack of 5","pack of 10"]}]'::jsonb,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000003',
    null,
    'Shoes',
    'shoes',
    '[
       {"key":"size","label":"Size","options":["39","40","41","42","43"]},
       {"key":"color","label":"Color","options":["black","white"]}
     ]'::jsonb,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000004',
    'c0000000-0000-4000-8000-000000000001',
    'Men''s Shirts',
    'mens-shirts',
    '[
       {"key":"size","label":"Size","options":["s","m","l","xl"]},
       {"key":"color","label":"Color","options":["black","white","blue"]},
       {"key":"fit","label":"Fit","options":["regular","slim"]}
     ]'::jsonb,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000005',
    'c0000000-0000-4000-8000-000000000002',
    'Notebooks',
    'notebooks',
    '[
       {"key":"pack","label":"Pack size","options":["single","pack of 5","pack of 10"]},
       {"key":"ruling","label":"Ruling","options":["single line","squared"]}
     ]'::jsonb,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000006',
    'c0000000-0000-4000-8000-000000000003',
    'Sneakers',
    'sneakers',
    '[
       {"key":"size","label":"Size","options":["39","40","41","42","43"]},
       {"key":"color","label":"Color","options":["black","white"]}
     ]'::jsonb,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000007',
    null,
    'Bags',
    'bags',
    '[{"key":"color","label":"Color","options":["tan","black","navy"]}]'::jsonb,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000008',
    null,
    'Accessories',
    'accessories',
    '[{"key":"color","label":"Color","options":["brown","black"]}]'::jsonb,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000009',
    null,
    'Home & Living',
    'home-and-living',
    '[{"key":"color","label":"Color","options":["amber","white","charcoal"]}]'::jsonb,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000010',
    'c0000000-0000-4000-8000-000000000001',
    'T-Shirts',
    't-shirts',
    '[
       {"key":"size","label":"Size","options":["s","m","l","xl"]},
       {"key":"color","label":"Color","options":["black","white","blue","amber"]},
       {"key":"fit","label":"Fit","options":["regular","slim"]}
     ]'::jsonb,
    true
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Suppliers
-- -----------------------------------------------------------------------------
insert into public.suppliers (id, name, phone, address, is_active)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    'Karachi Textile Mills',
    '+922112345678',
    'SITE Area, Karachi',
    true
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'Lahore Stationery House',
    '+924212345678',
    'Urdu Bazaar, Lahore',
    true
  ),
  (
    'd0000000-0000-4000-8000-000000000003',
    'EveryNest General Suppliers',
    '+923112345678',
    'Main Boulevard, Lahore',
    true
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------
insert into public.products (id, category_id, name, slug, brand, description, is_featured, is_active)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000004',
    'Classic Cotton Shirt',
    'classic-cotton-shirt',
    'EveryNest Basics',
    'Soft combed-cotton shirt with a clean collar. Everyday wear for work or university.',
    true,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000004',
    'Oxford Formal Shirt',
    'oxford-formal-shirt',
    'EveryNest Basics',
    'Structured Oxford weave with a button-down collar. Pairs with formal trousers.',
    false,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000005',
    'A5 Ruled Notebook',
    'a5-ruled-notebook',
    'EveryNest Stationery',
    '160-page A5 notebook with a hard cover and a ribbon marker.',
    true,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'c0000000-0000-4000-8000-000000000002',
    'Gel Pen Set',
    'gel-pen-set',
    'EveryNest Stationery',
    'Smooth 0.7 mm gel pens in assorted blue and black ink.',
    false,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000005',
    'c0000000-0000-4000-8000-000000000006',
    'Everyday Sneakers',
    'everyday-sneakers',
    'EveryNest Walk',
    'Lightweight sneakers with a cushioned sole for daily use.',
    true,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000006',
    'c0000000-0000-4000-8000-000000000003',
    'Canvas Slip-On Shoes',
    'canvas-slip-on-shoes',
    'EveryNest Walk',
    'Easy slip-on canvas shoes with a flexible rubber sole.',
    false,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000007',
    'c0000000-0000-4000-8000-000000000010',
    'Essential Cotton T-Shirt',
    'essential-cotton-tshirt',
    'EveryNest Basics',
    'Breathable crew-neck tee in a warm amber shade. A dependable everyday layer.',
    true,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000008',
    'c0000000-0000-4000-8000-000000000001',
    'Slim Fit Chinos',
    'slim-fit-chinos',
    'EveryNest Basics',
    'Clean, tapered chinos with a comfortable stretch waistband.',
    false,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000009',
    'c0000000-0000-4000-8000-000000000005',
    'Hardcover Journal',
    'hardcover-journal',
    'EveryNest Stationery',
    'A premium journal with a durable cover, elastic band and ribbon marker.',
    true,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000010',
    'c0000000-0000-4000-8000-000000000007',
    'Everyday Canvas Backpack',
    'canvas-backpack',
    'EveryNest Carry',
    'Roomy canvas backpack with padded straps and a secure front pocket.',
    false,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000011',
    'c0000000-0000-4000-8000-000000000008',
    'Leather Card Wallet',
    'leather-card-wallet',
    'EveryNest Accessories',
    'Slim leather wallet with stitched card slots and a compact profile.',
    false,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000012',
    'c0000000-0000-4000-8000-000000000009',
    'Ceramic Coffee Mug',
    'ceramic-coffee-mug',
    'EveryNest Living',
    'Glossy ceramic mug with a comfortable handle and a warm amber glaze.',
    true,
    true
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Variants
--   `stock` is inserted directly here because this seed runs as the database
--   owner (postgres). Application roles can never do this: the
--   guard_variant_stock trigger rejects it and `stock` is not granted.
-- -----------------------------------------------------------------------------
insert into public.product_variants (
  id, product_id, sku, attributes, price_paisa, sale_price_paisa, stock, reorder_level, is_active
)
values
  -- Classic Cotton Shirt
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'ZS-SHIRT-COT-M-WHT', '{"size":"m","color":"white","fit":"regular"}', 299900, 249900, 18, 5, true),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'ZS-SHIRT-COT-L-BLU', '{"size":"l","color":"blue","fit":"regular"}', 299900, null, 9, 5, true),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'ZS-SHIRT-COT-M-BLK', '{"size":"m","color":"black","fit":"slim"}', 349900, null, 4, 8, true),

  -- Oxford Formal Shirt
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002',
   'ZS-SHIRT-OXF-M-WHT', '{"size":"m","color":"white","fit":"regular"}', 459900, null, 6, 5, true),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
   'ZS-SHIRT-OXF-L-BLU', '{"size":"l","color":"blue","fit":"slim"}', 459900, 399900, 12, 5, true),

  -- A5 Ruled Notebook
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003',
   'ZS-NOTE-A5-LINE', '{"pack":"pack of 5","ruling":"single line"}', 85000, null, 40, 10, true),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000003',
   'ZS-NOTE-A5-SQ', '{"pack":"pack of 5","ruling":"squared"}', 85000, null, 0, 10, true),

  -- Gel Pen Set
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000004',
   'ZS-PEN-GEL-5', '{"pack":"pack of 5"}', 45000, null, 25, 10, true),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004',
   'ZS-PEN-GEL-10', '{"pack":"pack of 10"}', 80000, 70000, 3, 10, true),

  -- Everyday Sneakers
  ('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000005',
   'ZS-SNEAK-42-BLK', '{"size":"42","color":"black"}', 749900, null, 7, 5, true),
  ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000005',
   'ZS-SNEAK-43-WHT', '{"size":"43","color":"white"}', 749900, null, 11, 5, true),

  -- Canvas Slip-On Shoes
  ('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000006',
   'ZS-CANVAS-41-BLK', '{"size":"41","color":"black"}', 399900, null, 5, 5, true),
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000006',
   'ZS-CANVAS-42-WHT', '{"size":"42","color":"white"}', 399900, null, 0, 5, true),

  -- Essential Cotton T-Shirt
  ('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000007',
   'EN-TEE-ESS-M-AMB', '{"size":"m","color":"amber","fit":"regular"}', 129900, null, 30, 8, true),
  ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000007',
   'EN-TEE-ESS-L-BLK', '{"size":"l","color":"black","fit":"regular"}', 129900, 99900, 14, 8, true),
  ('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000007',
   'EN-TEE-ESS-M-WHT', '{"size":"m","color":"white","fit":"slim"}', 139900, null, 6, 8, true),

  -- Slim Fit Chinos
  ('b0000000-0000-4000-8000-000000000017', 'a0000000-0000-4000-8000-000000000008',
   'EN-CHINO-SLM-M-BLK', '{"size":"m","color":"black"}', 249900, null, 12, 6, true),
  ('b0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000008',
   'EN-CHINO-SLM-L-BLU', '{"size":"l","color":"blue"}', 249900, 199900, 9, 6, true),

  -- Hardcover Journal
  ('b0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-000000000009',
   'EN-JRN-HC-SNG-LINE', '{"pack":"single","ruling":"single line"}', 120000, null, 22, 6, true),
  ('b0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000009',
   'EN-JRN-HC-SNG-SQ', '{"pack":"single","ruling":"squared"}', 120000, null, 0, 6, true),

  -- Everyday Canvas Backpack
  ('b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000010',
   'EN-BAG-CNV-TAN', '{"color":"tan"}', 219900, 179900, 8, 4, true),

  -- Leather Card Wallet
  ('b0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000011',
   'EN-WLT-LTH-BRN', '{"color":"brown"}', 159900, null, 15, 5, true),
  ('b0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000011',
   'EN-WLT-LTH-BLK', '{"color":"black"}', 159900, null, 7, 5, true),

  -- Ceramic Coffee Mug
  ('b0000000-0000-4000-8000-000000000024', 'a0000000-0000-4000-8000-000000000012',
   'EN-MUG-CER-AMB', '{"color":"amber"}', 65000, null, 35, 10, true),
  ('b0000000-0000-4000-8000-000000000025', 'a0000000-0000-4000-8000-000000000012',
   'EN-MUG-CER-WHT', '{"color":"white"}', 65000, null, 28, 10, true)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Initial stock movements (append-only ledger).
-- `created_by` is null: the seed has no signed-in actor. Zero-stock variants
-- intentionally have no opening movement.
-- -----------------------------------------------------------------------------
insert into public.stock_movements (id, variant_id, change, reason, supplier_id, note, created_by)
values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 18, 'purchase', 'd0000000-0000-4000-8000-000000000001', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 9,  'purchase', 'd0000000-0000-4000-8000-000000000001', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 4,  'purchase', 'd0000000-0000-4000-8000-000000000001', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 6,  'purchase', 'd0000000-0000-4000-8000-000000000001', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 12, 'purchase', 'd0000000-0000-4000-8000-000000000001', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000006', 40, 'purchase', 'd0000000-0000-4000-8000-000000000002', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000008', 25, 'purchase', 'd0000000-0000-4000-8000-000000000002', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000009', 3,  'purchase', 'd0000000-0000-4000-8000-000000000002', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000010', 7,  'purchase', 'd0000000-0000-4000-8000-000000000001', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000011', 11, 'purchase', 'd0000000-0000-4000-8000-000000000001', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000012', 5,  'purchase', 'd0000000-0000-4000-8000-000000000001', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000014', 30, 'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000015', 14, 'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000016', 6,  'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000017', 12, 'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000018', 9,  'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000019', 22, 'purchase', 'd0000000-0000-4000-8000-000000000002', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000019', 'b0000000-0000-4000-8000-000000000021', 8,  'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000022', 15, 'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000023', 7,  'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000024', 35, 'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null),
  ('e0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000025', 28, 'purchase', 'd0000000-0000-4000-8000-000000000003', 'Development seed: opening stock', null)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Product gallery images (local product photographs).
-- -----------------------------------------------------------------------------
insert into public.product_images (id, product_id, url, alt_text, sort_order)
values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '/products/classic-cotton-shirt.jpg', 'Classic Cotton Shirt', 0),
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', '/products/oxford-formal-shirt.jpg', 'Oxford Formal Shirt', 0),
  ('f0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', '/products/a5-ruled-notebook.jpg', 'A5 Ruled Notebook', 0),
  ('f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', '/products/gel-pen-set.jpg', 'Gel Pen Set', 0),
  ('f0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', '/products/everyday-sneakers.jpg', 'Everyday Sneakers', 0),
  ('f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', '/products/canvas-slip-on-shoes.jpg', 'Canvas Slip-On Shoes', 0),
  ('f0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', '/products/essential-cotton-tshirt.jpg', 'Essential Cotton T-Shirt', 0),
  ('f0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000008', '/products/slim-fit-chinos.jpg', 'Slim Fit Chinos', 0),
  ('f0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000009', '/products/hardcover-journal.jpg', 'Hardcover Journal', 0),
  ('f0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010', '/products/canvas-backpack.jpg', 'Everyday Canvas Backpack', 0),
  ('f0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000011', '/products/leather-card-wallet.jpg', 'Leather Card Wallet', 0),
  ('f0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000012', '/products/ceramic-coffee-mug.jpg', 'Ceramic Coffee Mug', 0)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Brand repair for the original six products.
-- The remote dev database still carries legacy "ZABI ..." brand strings from
-- an earlier seed. These targeted, idempotent updates restore EveryNest
-- branding without touching names, prices, stock or any user data.
-- -----------------------------------------------------------------------------
update public.products set brand = 'EveryNest Basics'
where slug in ('classic-cotton-shirt', 'oxford-formal-shirt', 'essential-cotton-tshirt', 'slim-fit-chinos')
  and brand is distinct from 'EveryNest Basics';

update public.products set brand = 'EveryNest Stationery'
where slug in ('a5-ruled-notebook', 'gel-pen-set', 'hardcover-journal')
  and brand is distinct from 'EveryNest Stationery';

update public.products set brand = 'EveryNest Walk'
where slug in ('everyday-sneakers', 'canvas-slip-on-shoes')
  and brand is distinct from 'EveryNest Walk';

update public.products set brand = 'EveryNest Carry'
where slug = 'canvas-backpack' and brand is distinct from 'EveryNest Carry';

update public.products set brand = 'EveryNest Accessories'
where slug = 'leather-card-wallet' and brand is distinct from 'EveryNest Accessories';

update public.products set brand = 'EveryNest Living'
where slug = 'ceramic-coffee-mug' and brand is distinct from 'EveryNest Living';

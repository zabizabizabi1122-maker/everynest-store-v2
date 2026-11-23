-- Correct two seeded hero slide images that referenced files not present in
-- public/products. These paths produced 400 responses from the Next image
-- optimizer and a visible broken image on the storefront.
update public.hero_slides
set image = '/products/classic-cotton-shirt.jpg'
where image = '/products/cotton-shirt.jpg';

update public.hero_slides
set image = '/products/a5-ruled-notebook.jpg'
where image = '/products/notebook.jpg';

-- The first slide's secondary CTA duplicated the primary destination. Point it
-- at a distinct, real catalogue view instead.
update public.hero_slides
set secondary_label = 'View new arrivals',
    secondary_href = '/products?sort=newest'
where primary_label = 'Shop all products'
  and secondary_href = '/products';

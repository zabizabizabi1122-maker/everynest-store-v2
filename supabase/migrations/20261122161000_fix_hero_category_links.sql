-- Make stored hero CTAs match their labels and avoid duplicate destinations.
-- Category links use live category UUIDs because the catalogue filters by id.
update public.hero_slides
set primary_href = '/products?category=' || (
  select id::text from public.categories
  where slug = 'clothes' and parent_id is null
  limit 1
)
where primary_label = 'Explore clothing';

update public.hero_slides
set primary_href = '/products?category=' || (
  select id::text from public.categories
  where slug = 'stationery' and parent_id is null
  limit 1
),
secondary_label = 'View new arrivals',
secondary_href = '/products?sort=newest'
where primary_label = 'Shop stationery';

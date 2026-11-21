-- =============================================================================
-- EveryNest - Level 1
-- 0011: product image storage bucket and policies
-- =============================================================================
-- Bucket: `product-images`
--   * public read (product images are public catalogue content)
--   * staff/admin write, update and delete only
--   * JPEG, PNG and WebP only; SVG is rejected by the application layer, and
--     the bucket restricts allowed MIME types as a second line of defence.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Public read for the product image bucket.
-- -----------------------------------------------------------------------------
create policy product_images_storage_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- -----------------------------------------------------------------------------
-- Staff/admin writes.
-- `private.is_staff()` reads the caller's profile role; storage policies run as
-- the authenticated role, so the helper grant from the grants migration applies.
-- -----------------------------------------------------------------------------
create policy product_images_storage_staff_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and private.is_staff()
  );

create policy product_images_storage_staff_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and private.is_staff()
  )
  with check (
    bucket_id = 'product-images'
    and private.is_staff()
  );

create policy product_images_storage_staff_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and private.is_staff()
  );

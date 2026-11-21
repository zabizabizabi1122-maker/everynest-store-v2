-- =============================================================================
-- EveryNest - Level 11, feature 2 of 4
-- Product reviews: purchase-verified, staff-moderated customer feedback.
-- =============================================================================
-- Security model:
--   * Only approved reviews are public. Customers may read their own reviews in
--     any state; staff may read all for moderation.
--   * Customers never receive INSERT/UPDATE/DELETE on the table. All writes go
--     through `public.submit_review`, which derives the author from auth.uid(),
--     requires a delivered purchase of that product, and stores a non-sensitive
--     author label snapshot instead of exposing the profiles table.
--   * Moderation is a staff-only RPC; status cannot be set at insert time by a
--     client. SECURITY DEFINER functions pin search_path = ''.
-- =============================================================================

create table public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products (id) on delete restrict,
  user_id             uuid not null references public.profiles (id) on delete restrict,
  order_item_id       uuid references public.order_items (id) on delete set null,
  author_label        text not null check (char_length(author_label) between 2 and 100),
  rating              integer not null check (rating between 1 and 5),
  title               text not null check (char_length(title) between 2 and 120),
  body                text not null check (char_length(body) between 10 and 2000),
  is_verified_purchase boolean not null default false,
  status              text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint reviews_once_per_product unique (user_id, product_id)
);

comment on table public.reviews is
  'Customer product reviews. Only approved rows are public; writes go through trusted RPCs.';

create index reviews_product_status_idx on public.reviews (product_id, status, created_at desc);
create index reviews_user_idx on public.reviews (user_id);
create index reviews_status_idx on public.reviews (status, created_at desc);

create trigger set_reviews_updated_at
  before update on public.reviews
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Submit a review. Requires a delivered order line for the same product.
-- -----------------------------------------------------------------------------
create or replace function public.submit_review(
  p_product_id uuid,
  p_rating     integer,
  p_title      text,
  p_body       text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := (select auth.uid());
  v_title         text := btrim(coalesce(p_title, ''));
  v_body          text := btrim(coalesce(p_body, ''));
  v_order_item_id uuid;
  v_author        text;
  v_review        public.reviews;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to write a review'
      using errcode = '42501';
  end if;

  if p_product_id is null
     or not exists (select 1 from public.products p where p.id = p_product_id and p.is_active) then
    raise exception 'Product not found'
      using errcode = 'P0002';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5'
      using errcode = '22023';
  end if;

  if char_length(v_title) < 2 or char_length(v_title) > 120 then
    raise exception 'Invalid review title'
      using errcode = '22023';
  end if;

  if char_length(v_body) < 10 or char_length(v_body) > 2000 then
    raise exception 'Invalid review body'
      using errcode = '22023';
  end if;

  select oi.id
    into v_order_item_id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.product_variants v on v.id = oi.variant_id
   where o.user_id = v_user_id
     and o.status = 'delivered'
     and v.product_id = p_product_id
   order by o.created_at desc
   limit 1;

  if v_order_item_id is null then
    raise exception 'A delivered purchase is required to review this product'
      using errcode = 'P0002';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'Verified customer')
    into v_author
    from public.profiles p
   where p.id = v_user_id;

  insert into public.reviews (
    product_id, user_id, order_item_id, author_label,
    rating, title, body, is_verified_purchase, status
  )
  values (
    p_product_id, v_user_id, v_order_item_id, v_author,
    p_rating, v_title, v_body, true, 'pending'
  )
  returning * into v_review;

  return jsonb_build_object(
    'id', v_review.id,
    'status', v_review.status,
    'productId', v_review.product_id
  );
end;
$$;

revoke all on function public.submit_review(uuid, integer, text, text) from public;
revoke all on function public.submit_review(uuid, integer, text, text) from anon;

comment on function public.submit_review(uuid, integer, text, text) is
  'Creates a pending review for a delivered purchase. Author is derived from auth.uid(); status is never client-supplied.';

grant execute on function public.submit_review(uuid, integer, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Moderation. Staff/admin may approve or reject; customers may not.
-- -----------------------------------------------------------------------------
create or replace function public.set_review_status(
  p_review_id uuid,
  p_status    text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to moderate reviews'
      using errcode = '42501';
  end if;

  if not private.is_staff() then
    raise exception 'Only staff may moderate reviews'
      using errcode = '42501';
  end if;

  if p_review_id is null or p_status not in ('approved', 'rejected') then
    raise exception 'Invalid review status'
      using errcode = '22023';
  end if;

  update public.reviews r
     set status = p_status
   where r.id = p_review_id;

  if not found then
    raise exception 'Review not found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_review_status(uuid, text) from public;
revoke all on function public.set_review_status(uuid, text) from anon;

comment on function public.set_review_status(uuid, text) is
  'Staff-only moderation: approve or reject one review.';

grant execute on function public.set_review_status(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Least privilege and RLS. No client write privilege on reviews at all.
-- -----------------------------------------------------------------------------
revoke all on table public.reviews from anon, authenticated;
grant select on table public.reviews to anon, authenticated;

alter table public.reviews enable row level security;

create policy reviews_select_public
  on public.reviews
  for select
  to anon, authenticated
  using (status = 'approved');

create policy reviews_select_own
  on public.reviews
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy reviews_select_staff
  on public.reviews
  for select
  to authenticated
  using (private.is_staff());

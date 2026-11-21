-- =============================================================================
-- EveryNest - Level 11, feature 3 of 4
-- Wishlist: per-customer saved products.
-- =============================================================================
-- Security model:
--   * A wishlist row belongs to exactly one profile. `user_id` defaults to
--     auth.uid() and RLS additionally requires it to match the caller on every
--     SELECT/INSERT/DELETE, so one customer can never see or change another's.
--   * There is no UPDATE policy: an item is either saved or removed.
--   * anon receives no table privilege at all. No SECURITY DEFINER helper is
--     needed because there is no business rule beyond ownership and uniqueness.
-- =============================================================================

create table public.wishlist_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint wishlist_items_unique unique (user_id, product_id)
);

comment on table public.wishlist_items is
  'Saved products for one customer. Ownership is enforced by RLS; items are added or removed, never edited.';

create index wishlist_items_user_idx on public.wishlist_items (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Least privilege and RLS.
-- -----------------------------------------------------------------------------
revoke all on table public.wishlist_items from anon, authenticated;
grant select, insert, delete on table public.wishlist_items to authenticated;

alter table public.wishlist_items enable row level security;

create policy wishlist_select_own
  on public.wishlist_items
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy wishlist_insert_own
  on public.wishlist_items
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy wishlist_delete_own
  on public.wishlist_items
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

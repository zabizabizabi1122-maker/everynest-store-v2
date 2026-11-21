-- =============================================================================
-- EveryNest - Level 11, feature 4 of 4
-- Saved addresses: reusable delivery addresses for one customer.
-- =============================================================================
-- Security model:
--   * Rows belong to one profile. `user_id` defaults to auth.uid() and RLS
--     requires it to match the caller for SELECT/INSERT/UPDATE/DELETE.
--   * Phone numbers are stored in the same normalized +92 form used by orders,
--     enforced by an immutable private helper. Money is not involved here.
--   * At most one address per customer can be the default (partial unique
--     index). Changing the default goes through `public.set_default_address`,
--     a SECURITY DEFINER RPC that checks ownership explicitly and updates both
--     rows in one transaction. SECURITY DEFINER functions pin search_path = ''.
-- =============================================================================

create table public.saved_addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references public.profiles (id) on delete cascade,
  label      text not null check (char_length(btrim(label)) between 2 and 50),
  full_name  text not null check (char_length(btrim(full_name)) between 2 and 100),
  phone      text not null,
  address    text not null check (char_length(btrim(address)) between 10 and 500),
  city       text not null check (char_length(btrim(city)) between 2 and 100),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Canonical +92 form, matching the orders table. Inlined as a regex (rather
  -- than calling private.normalize_pakistani_phone) because check constraints
  -- run as the invoking role and that helper is intentionally not executable
  -- by authenticated users.
  constraint saved_addresses_phone_valid check (phone ~ '^[+]923[0-9]{9}$')
);

comment on table public.saved_addresses is
  'Reusable delivery addresses owned by one customer. Only one can be the default.';

create index saved_addresses_user_idx on public.saved_addresses (user_id, created_at desc);

-- At most one default per customer. NULLs are not unique, so a partial index is
-- the correct way to express "one true row per user".
create unique index saved_addresses_one_default_per_user
  on public.saved_addresses (user_id)
  where is_default;

create trigger set_saved_addresses_updated_at
  before update on public.saved_addresses
  for each row execute function private.set_updated_at();

-- The first address a customer saves becomes their default automatically.
create or replace function private.set_first_saved_address_default()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.saved_addresses where user_id = new.user_id
  ) then
    new.is_default := true;
  end if;
  return new;
end;
$$;

revoke all on function private.set_first_saved_address_default() from public;
revoke all on function private.set_first_saved_address_default() from anon;
revoke all on function private.set_first_saved_address_default() from authenticated;

create trigger set_first_saved_address_default
  before insert on public.saved_addresses
  for each row execute function private.set_first_saved_address_default();

-- -----------------------------------------------------------------------------
-- Change the default address atomically. Ownership is checked explicitly
-- because SECURITY DEFINER bypasses the table's RLS policies.
-- -----------------------------------------------------------------------------
create or replace function public.set_default_address(p_address_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication is required to change your address'
      using errcode = '42501';
  end if;

  if p_address_id is null then
    raise exception 'A valid address id is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.saved_addresses
     where id = p_address_id and user_id = v_user_id
  ) then
    raise exception 'Address not found'
      using errcode = 'P0002';
  end if;

  update public.saved_addresses
     set is_default = false
   where user_id = v_user_id and is_default;

  update public.saved_addresses
     set is_default = true
   where id = p_address_id and user_id = v_user_id;
end;
$$;

revoke all on function public.set_default_address(uuid) from public;
revoke all on function public.set_default_address(uuid) from anon;

comment on function public.set_default_address(uuid) is
  'Sets one of the caller''s saved addresses as default, clearing any previous default atomically.';

grant execute on function public.set_default_address(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Least privilege and RLS.
-- -----------------------------------------------------------------------------
revoke all on table public.saved_addresses from anon, authenticated;
grant select, insert, update, delete on table public.saved_addresses to authenticated;

alter table public.saved_addresses enable row level security;

create policy saved_addresses_select_own
  on public.saved_addresses
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy saved_addresses_insert_own
  on public.saved_addresses
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy saved_addresses_update_own
  on public.saved_addresses
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy saved_addresses_delete_own
  on public.saved_addresses
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

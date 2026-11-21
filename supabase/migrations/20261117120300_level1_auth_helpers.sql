-- =============================================================================
-- EveryNest - Level 1
-- 0004: authorization helpers, signup trigger and role protection
-- =============================================================================
-- Execution-context assumptions (verify on the first local Supabase run):
--   * Migrations are applied by the `postgres` role, so SECURITY DEFINER
--     functions created here are owned by `postgres`.
--   * `current_user` inside a SECURITY DEFINER function is the function owner.
--   * Supabase's `anon`/`authenticated` roles reach the API through
--     `authenticator`, which switches role, so `current_user` reflects the
--     caller for SECURITY INVOKER code.
-- If a hosted project applies migrations as `supabase_admin` instead, add that
-- role to the trusted lists below and record the change.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Staff/admin checks used by RLS policies.
-- SECURITY DEFINER avoids recursive RLS evaluation on profiles.
-- -----------------------------------------------------------------------------
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('staff', 'admin')
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function private.is_staff() from public;
revoke all on function private.is_staff() from anon;
revoke all on function private.is_admin() from public;
revoke all on function private.is_admin() from anon;

-- -----------------------------------------------------------------------------
-- Signup trigger: create a profile for every new auth user.
-- The role is always the database default ('customer'). Signup metadata can
-- supply a display name and phone only, never a role.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
  v_phone     text;
begin
  v_full_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_phone     := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');

  insert into public.profiles (id, full_name, phone, role)
  values (new.id, v_full_name, v_phone, 'customer')
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Role protection: nobody may change a profile role from the API.
--
-- This trigger runs as the caller (SECURITY INVOKER) on purpose. If it were
-- SECURITY DEFINER, `current_user` would always be the owner and the check
-- would be meaningless.
--
-- Trusted database-owner contexts (Dashboard SQL editor, migrations) may change
-- roles; those changes are written to audit_log with a null actor when there is
-- no authenticated session.
-- -----------------------------------------------------------------------------
create or replace function private.guard_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'Changing a profile role is not permitted'
        using errcode = '42501';
    end if;

    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (
      (select auth.uid()),
      'profile.role_change',
      'profiles',
      new.id::text,
      jsonb_build_object('from', old.role, 'to', new.role)
    );
  end if;

  return new;
end;
$$;

revoke all on function private.guard_profile_role() from public;
revoke all on function private.guard_profile_role() from anon;
revoke all on function private.guard_profile_role() from authenticated;

create trigger guard_profile_role
  before update on public.profiles
  for each row execute function private.guard_profile_role();

-- =============================================================================
-- EveryNest - Password recovery rate limiting
-- =============================================================================
-- Supabase Auth owns the secure, single-use, time-limited reset tokens. This
-- migration only adds a small server-side throttle so repeated requests for the
-- same address are ignored for 60 seconds. The table is never exposed to
-- clients; only the trusted function below is callable from the forgot-password
-- Server Action.
-- =============================================================================

create table public.password_reset_throttle (
  email        text primary key
               check (char_length(email) between 3 and 254),
  requested_at timestamptz not null,
  created_at   timestamptz not null default now()
);

alter table public.password_reset_throttle enable row level security;

revoke all on table public.password_reset_throttle from anon, authenticated;

create or replace function public.can_request_password_reset(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');

  if v_email is null
     or char_length(v_email) > 254
     or v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  then
    -- Invalid input is treated as not allowed, but the UI still shows a generic
    -- success message so this endpoint cannot be used to probe addresses.
    return false;
  end if;

  delete from public.password_reset_throttle
   where requested_at < now() - interval '1 day';

  if exists (
    select 1
    from public.password_reset_throttle t
    where t.email = v_email
      and t.requested_at > now() - interval '60 seconds'
  ) then
    return false;
  end if;

  insert into public.password_reset_throttle (email, requested_at)
  values (v_email, now())
  on conflict (email)
  do update set requested_at = excluded.requested_at;

  return true;
end;
$$;

revoke all on function public.can_request_password_reset(text) from public;
grant execute on function public.can_request_password_reset(text) to anon, authenticated;

comment on function public.can_request_password_reset(text) is
  'Server-side 60-second throttle for password reset emails. Always return a generic response to the browser.';

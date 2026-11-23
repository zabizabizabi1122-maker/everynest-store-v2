-- =============================================================================
-- EveryNest - Authentication hardening
-- =============================================================================
-- Supabase Auth owns identity, password hashing, sessions, email confirmation
-- and all verification/reset tokens. This migration deliberately does NOT
-- duplicate those models. It only adds:
--   1. an app-level login throttle (per email + pseudonymous client digest);
--   2. a resend cooldown for signup confirmation emails.
-- Both tables are private to trusted SECURITY DEFINER functions and never store
-- credentials or tokens.
-- =============================================================================

create table if not exists public.auth_login_throttle (
  key            text primary key
                 check (char_length(key) between 3 and 320),
  failures       integer not null default 0 check (failures >= 0),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  blocked_until  timestamptz
);

create index if not exists auth_login_throttle_cleanup_idx
  on public.auth_login_throttle (last_failed_at);

alter table public.auth_login_throttle enable row level security;

revoke all on table public.auth_login_throttle from anon, authenticated;

create or replace function public.check_login_allowed(p_email text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_ip text;
  v_key text;
  v_blocked_until timestamptz;
begin
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_ip := nullif(btrim(coalesce(p_ip_hash, '')), '');

  if v_email is null or v_ip is null
     or char_length(v_email) > 254 or char_length(v_ip) > 64
  then
    return false;
  end if;

  v_key := v_email || ':' || v_ip;

  delete from public.auth_login_throttle
   where last_failed_at < now() - interval '1 day'
     and (blocked_until is null or blocked_until < now());

  select t.blocked_until into v_blocked_until
    from public.auth_login_throttle t
   where t.key = v_key;

  return v_blocked_until is null or v_blocked_until <= now();
end;
$$;

create or replace function public.record_login_attempt(
  p_email text,
  p_ip_hash text,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_ip text;
  v_key text;
  v_failures integer;
begin
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_ip := nullif(btrim(coalesce(p_ip_hash, '')), '');

  if v_email is null or v_ip is null
     or char_length(v_email) > 254 or char_length(v_ip) > 64
  then
    return;
  end if;

  v_key := v_email || ':' || v_ip;

  if coalesce(p_success, false) then
    delete from public.auth_login_throttle where key = v_key;
    return;
  end if;

  insert into public.auth_login_throttle (key, failures, first_failed_at, last_failed_at)
  values (v_key, 1, now(), now())
  on conflict (key) do update
    set failures = auth_login_throttle.failures + 1,
        last_failed_at = now(),
        blocked_until = case
          when auth_login_throttle.failures + 1 >= 5
            then now() + interval '15 minutes'
          else auth_login_throttle.blocked_until
        end;
end;
$$;

revoke all on function public.check_login_allowed(text, text) from public;
revoke all on function public.record_login_attempt(text, text, boolean) from public;
grant execute on function public.check_login_allowed(text, text) to anon, authenticated;
grant execute on function public.record_login_attempt(text, text, boolean) to anon, authenticated;

comment on function public.check_login_allowed(text, text) is
  'Returns false while a login email/client pair is locked out after repeated failures.';

comment on function public.record_login_attempt(text, text, boolean) is
  'Records a login result. Five failures lock the pair for 15 minutes; success clears it.';

-- Resend cooldown for email verification ---------------------------------------

create table if not exists public.email_verification_throttle (
  email        text primary key
               check (char_length(email) between 3 and 254),
  requested_at timestamptz not null,
  created_at   timestamptz not null default now()
);

alter table public.email_verification_throttle enable row level security;

revoke all on table public.email_verification_throttle from anon, authenticated;

create or replace function public.can_request_email_verification(p_email text)
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
    return false;
  end if;

  delete from public.email_verification_throttle
   where requested_at < now() - interval '1 day';

  if exists (
    select 1
      from public.email_verification_throttle t
     where t.email = v_email
       and t.requested_at > now() - interval '60 seconds'
  ) then
    return false;
  end if;

  insert into public.email_verification_throttle (email, requested_at)
  values (v_email, now())
  on conflict (email)
  do update set requested_at = excluded.requested_at;

  return true;
end;
$$;

revoke all on function public.can_request_email_verification(text) from public;
grant execute on function public.can_request_email_verification(text) to anon, authenticated;

comment on function public.can_request_email_verification(text) is
  'Server-side 60-second throttle for verification-email resends. Always return a generic response to the browser.';

-- =============================================================================
-- EveryNest - Admin Management trusted RPCs
-- =============================================================================
-- Admin accounts are sensitive: every read and write below re-checks the exact
-- permission with private.has_permission() inside a SECURITY DEFINER function.
-- Hidden UI is never the security layer.
--
-- Auth user creation/password changes are performed by server-only Server
-- Actions using SUPABASE_SERVICE_ROLE_KEY. This migration owns the profile,
-- permission grants, guards and audit trail around those Auth operations.
-- =============================================================================

create index if not exists profiles_role_active_idx
  on public.profiles (role, is_active);

-- -----------------------------------------------------------------------------
-- 1. Read helpers
-- -----------------------------------------------------------------------------
create or replace function public.list_admin_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_permissions jsonb;
  v_defaults    jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if not private.has_permission('admins.view')
     and not private.has_permission('admins.manage') then
    raise exception 'Admin view permission is required'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', pm.key,
        'label', pm.label,
        'description', pm.description,
        'category', pm.category
      )
      order by pm.category, pm.label
    ),
    '[]'::jsonb
  )
    into v_permissions
    from public.permissions pm
   where pm.is_active;

  select coalesce(
    jsonb_agg(rp.permission_key order by rp.permission_key),
    '[]'::jsonb
  )
    into v_defaults
    from public.role_permissions rp
   where rp.role = 'admin';

  return jsonb_build_object(
    'permissions', v_permissions,
    'roleDefaults', v_defaults
  );
end;
$$;

revoke all on function public.list_admin_permissions() from public, anon;
grant execute on function public.list_admin_permissions() to authenticated;

create or replace function public.list_admin_accounts(
  p_search text default null,
  p_role   text default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text;
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if not private.has_permission('admins.view') then
    raise exception 'Admin view permission is required'
      using errcode = '42501';
  end if;

  if p_role is not null and p_role not in ('admin', 'super_admin') then
    raise exception 'Invalid role filter'
      using errcode = '22023';
  end if;

  if p_status is not null and p_status not in ('active', 'inactive') then
    raise exception 'Invalid status filter'
      using errcode = '22023';
  end if;

  v_search := nullif(lower(btrim(coalesce(p_search, ''))), '');
  if char_length(coalesce(v_search, '')) > 120 then
    raise exception 'Search text is too long'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'email', coalesce(u.email, ''),
        'fullName', p.full_name,
        'phone', p.phone,
        'role', p.role,
        'isActive', p.is_active,
        'createdAt', p.created_at,
        'updatedAt', p.updated_at,
        'permissions', coalesce((
          select jsonb_agg(ap.permission_key order by ap.permission_key)
            from public.admin_permissions ap
           where ap.admin_id = p.id
        ), '[]'::jsonb)
      )
      order by p.role desc, lower(coalesce(u.email, p.full_name, p.id::text))
    ),
    '[]'::jsonb
  )
    into v_result
    from public.profiles p
    left join auth.users u on u.id = p.id
   where p.role in ('admin', 'super_admin')
     and (p_role is null or p.role = p_role)
     and (
       p_status is null
       or (p_status = 'active' and p.is_active)
       or (p_status = 'inactive' and not p.is_active)
     )
     and (
       v_search is null
       or lower(coalesce(u.email, '')) like '%' || v_search || '%'
       or lower(coalesce(p.full_name, '')) like '%' || v_search || '%'
       or lower(coalesce(p.phone, '')) like '%' || v_search || '%'
     );

  return v_result;
end;
$$;

revoke all on function public.list_admin_accounts(text, text, text) from public, anon;
grant execute on function public.list_admin_accounts(text, text, text) to authenticated;

create or replace function public.get_admin_account(p_admin_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result     jsonb;
  v_account    public.profiles;
  v_permission jsonb;
  v_defaults   jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if not private.has_permission('admins.view') then
    raise exception 'Admin view permission is required'
      using errcode = '42501';
  end if;

  if p_admin_id is null then
    raise exception 'A valid admin id is required'
      using errcode = '22023';
  end if;

  select p.* into v_account
    from public.profiles p
   where p.id = p_admin_id
     and p.role in ('admin', 'super_admin');

  if not found then
    raise exception 'Admin account not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(ap.permission_key order by ap.permission_key),
    '[]'::jsonb
  )
    into v_permission
    from public.admin_permissions ap
   where ap.admin_id = p_admin_id;

  select coalesce(
    jsonb_agg(rp.permission_key order by rp.permission_key),
    '[]'::jsonb
  )
    into v_defaults
    from public.role_permissions rp
   where rp.role = 'admin';

  select jsonb_build_object(
    'id', v_account.id,
    'email', coalesce(u.email, ''),
    'fullName', v_account.full_name,
    'phone', v_account.phone,
    'role', v_account.role,
    'isActive', v_account.is_active,
    'createdAt', v_account.created_at,
    'updatedAt', v_account.updated_at,
    'permissions', v_permission,
    'roleDefaults', v_defaults
  )
    into v_result
    from auth.users u
   where u.id = p_admin_id;

  return coalesce(
    v_result,
    jsonb_build_object(
      'id', v_account.id,
      'email', '',
      'fullName', v_account.full_name,
      'phone', v_account.phone,
      'role', v_account.role,
      'isActive', v_account.is_active,
      'createdAt', v_account.created_at,
      'updatedAt', v_account.updated_at,
      'permissions', v_permission,
      'roleDefaults', v_defaults
    )
  );
end;
$$;

revoke all on function public.get_admin_account(uuid) from public, anon;
grant execute on function public.get_admin_account(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Shared validation and guards
-- -----------------------------------------------------------------------------
create or replace function private.validate_admin_permissions(p_permissions text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invalid bigint;
begin
  select count(*)
    into v_invalid
    from unnest(coalesce(p_permissions, '{}'::text[])) as requested(key)
   where not exists (
     select 1
       from public.permissions pm
      where pm.key = requested.key
        and pm.is_active
   );

  if v_invalid > 0 then
    raise exception 'One or more selected permissions are no longer available'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_admin_permissions(text[]) from public, anon, authenticated;

create or replace function private.guard_admin_target(
  p_admin_id  uuid,
  p_new_role  text default null,
  p_new_active boolean default null,
  p_is_delete boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
  v_active_super_admins bigint;
begin
  select p.* into v_target
    from public.profiles p
   where p.id = p_admin_id;

  if not found then
    raise exception 'Admin account not found'
      using errcode = 'P0002';
  end if;

  if v_target.role not in ('admin', 'super_admin') then
    raise exception 'That account is not an administrator'
      using errcode = '22023';
  end if;

  if p_admin_id = (select auth.uid()) and (p_is_delete or p_new_role is not null or p_new_active is not null) then
    raise exception 'You cannot change the role, status or existence of your own account'
      using errcode = '42501';
  end if;

  if not (select private.is_super_admin())
     and (v_target.role = 'super_admin' or p_new_role = 'super_admin') then
    raise exception 'Only a Super Admin can manage Super Admin accounts'
      using errcode = '42501';
  end if;

  if v_target.role = 'super_admin' then
    select count(*) into v_active_super_admins
      from public.profiles p
     where p.role = 'super_admin'
       and p.is_active;

    if v_active_super_admins <= 1
       and (
         p_is_delete
         or (p_new_active is not null and not p_new_active)
         or (p_new_role is not null and p_new_role <> 'super_admin')
       )
    then
      raise exception 'The last active Super Admin cannot be removed or demoted'
        using errcode = '23514';
    end if;
  end if;

  return v_target;
end;
$$;

revoke all on function private.guard_admin_target(uuid, text, boolean, boolean) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Writes
-- -----------------------------------------------------------------------------
create or replace function public.claim_admin_account(
  p_user_id     uuid,
  p_full_name   text,
  p_phone       text default null,
  p_role        text default 'admin',
  p_permissions text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_email   text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if not private.has_permission('admins.manage') then
    raise exception 'Admin management permission is required'
      using errcode = '42501';
  end if;

  if p_user_id is null or p_role not in ('admin', 'super_admin') then
    raise exception 'A valid account id and role are required'
      using errcode = '22023';
  end if;

  if p_role = 'super_admin' and not (select private.is_super_admin()) then
    raise exception 'Only a Super Admin can create another Super Admin'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_full_name, ''))) < 2
     or char_length(btrim(p_full_name)) > 80 then
    raise exception 'A full name between 2 and 80 characters is required'
      using errcode = '22023';
  end if;

  if char_length(coalesce(p_phone, '')) > 30 then
    raise exception 'Phone number is too long'
      using errcode = '22023';
  end if;

  perform private.validate_admin_permissions(p_permissions);

  select p.* into v_profile
    from public.profiles p
   where p.id = p_user_id;

  if not found then
    raise exception 'The new account profile is not ready yet'
      using errcode = 'P0002';
  end if;

  if v_profile.role <> 'customer' then
    raise exception 'That account is already an administrator'
      using errcode = '23505';
  end if;

  update public.profiles
     set full_name = btrim(p_full_name),
         phone = nullif(btrim(coalesce(p_phone, '')), ''),
         role = p_role,
         is_active = true
   where id = p_user_id
  returning * into v_profile;

  delete from public.admin_permissions where admin_id = p_user_id;

  if p_role = 'admin' then
    insert into public.admin_permissions (admin_id, permission_key, granted_by)
    select p_user_id, requested.key, (select auth.uid())
      from unnest(coalesce(p_permissions, '{}'::text[])) as requested(key)
      on conflict do nothing;
  end if;

  select u.email into v_email
    from auth.users u
   where u.id = p_user_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()),
    'admin.create',
    'profiles',
    p_user_id::text,
    jsonb_build_object(
      'email', coalesce(v_email, ''),
      'role', p_role,
      'fullName', v_profile.full_name
    )
  );

  return jsonb_build_object(
    'id', p_user_id,
    'email', coalesce(v_email, ''),
    'role', p_role,
    'fullName', v_profile.full_name
  );
end;
$$;

revoke all on function public.claim_admin_account(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.claim_admin_account(uuid, text, text, text, text[]) to authenticated;

create or replace function public.update_admin_account(
  p_admin_id    uuid,
  p_full_name   text,
  p_phone       text default null,
  p_role        text default 'admin',
  p_permissions text[] default '{}'::text[],
  p_is_active   boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
  v_email  text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if not private.has_permission('admins.manage') then
    raise exception 'Admin management permission is required'
      using errcode = '42501';
  end if;

  if p_admin_id is null or p_role not in ('admin', 'super_admin') or p_is_active is null then
    raise exception 'A valid account id, role and status are required'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_full_name, ''))) < 2
     or char_length(btrim(p_full_name)) > 80 then
    raise exception 'A full name between 2 and 80 characters is required'
      using errcode = '22023';
  end if;

  if char_length(coalesce(p_phone, '')) > 30 then
    raise exception 'Phone number is too long'
      using errcode = '22023';
  end if;

  perform private.validate_admin_permissions(p_permissions);
  v_target := private.guard_admin_target(p_admin_id, p_role, p_is_active, false);

  update public.profiles
     set full_name = btrim(p_full_name),
         phone = nullif(btrim(coalesce(p_phone, '')), ''),
         role = p_role,
         is_active = p_is_active
   where id = p_admin_id;

  delete from public.admin_permissions where admin_id = p_admin_id;

  if p_role = 'admin' then
    insert into public.admin_permissions (admin_id, permission_key, granted_by)
    select p_admin_id, requested.key, (select auth.uid())
      from unnest(coalesce(p_permissions, '{}'::text[])) as requested(key)
      on conflict do nothing;
  end if;

  select u.email into v_email
    from auth.users u
   where u.id = p_admin_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()),
    'admin.update',
    'profiles',
    p_admin_id::text,
    jsonb_build_object(
      'email', coalesce(v_email, ''),
      'roleFrom', v_target.role,
      'roleTo', p_role,
      'isActive', p_is_active,
      'permissions', coalesce(p_permissions, '{}'::text[])
    )
  );

  return jsonb_build_object(
    'id', p_admin_id,
    'email', coalesce(v_email, ''),
    'role', p_role,
    'isActive', p_is_active
  );
end;
$$;

revoke all on function public.update_admin_account(uuid, text, text, text, text[], boolean) from public, anon;
grant execute on function public.update_admin_account(uuid, text, text, text, text[], boolean) to authenticated;

create or replace function public.set_admin_active(
  p_admin_id   uuid,
  p_is_active  boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if not private.has_permission('admins.manage') then
    raise exception 'Admin management permission is required'
      using errcode = '42501';
  end if;

  if p_admin_id is null or p_is_active is null then
    raise exception 'A valid account id and status are required'
      using errcode = '22023';
  end if;

  v_target := private.guard_admin_target(p_admin_id, null, p_is_active, false);

  update public.profiles
     set is_active = p_is_active
   where id = p_admin_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()),
    case when p_is_active then 'admin.activate' else 'admin.deactivate' end,
    'profiles',
    p_admin_id::text,
    jsonb_build_object('role', v_target.role)
  );

  return jsonb_build_object('id', p_admin_id, 'isActive', p_is_active);
end;
$$;

revoke all on function public.set_admin_active(uuid, boolean) from public, anon;
grant execute on function public.set_admin_active(uuid, boolean) to authenticated;

create or replace function public.delete_admin_account(p_admin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
  v_email  text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if not private.has_permission('admins.manage') then
    raise exception 'Admin management permission is required'
      using errcode = '42501';
  end if;

  if p_admin_id is null then
    raise exception 'A valid account id is required'
      using errcode = '22023';
  end if;

  v_target := private.guard_admin_target(p_admin_id, null, null, true);

  select u.email into v_email
    from auth.users u
   where u.id = p_admin_id;

  -- Deleting the Auth user cascades to public.profiles and admin_permissions.
  -- Keeping this inside the same transaction as the audit row means a failed
  -- audit write rolls the destructive change back.
  delete from auth.users where id = p_admin_id;

  if not found then
    raise exception 'Auth account not found'
      using errcode = 'P0002';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()),
    'admin.delete',
    'profiles',
    p_admin_id::text,
    jsonb_build_object(
      'email', coalesce(v_email, ''),
      'role', v_target.role,
      'fullName', v_target.full_name
    )
  );

  return jsonb_build_object('id', p_admin_id, 'email', coalesce(v_email, ''));
end;
$$;

revoke all on function public.delete_admin_account(uuid) from public, anon;
grant execute on function public.delete_admin_account(uuid) to authenticated;

comment on function public.list_admin_accounts(text, text, text) is
  'Permission-checked admin directory with search, role and status filters.';
comment on function public.get_admin_account(uuid) is
  'Permission-checked single admin account with individual permission grants.';
comment on function public.claim_admin_account(uuid, text, text, text, text[]) is
  'Promotes a freshly created Auth user into a guarded administrator profile.';
comment on function public.update_admin_account(uuid, text, text, text, text[], boolean) is
  'Permission-checked admin profile, role, status and permission update.';
comment on function public.set_admin_active(uuid, boolean) is
  'Permission-checked admin activate/deactivate with self and last-super-admin guards.';
comment on function public.delete_admin_account(uuid) is
  'Permission-checked hard delete of an admin Auth account with audit logging.';

-- =============================================================================
-- EveryNest - Level 4
-- 0001: attribute-schema validation and safe schema changes
-- =============================================================================
-- The categories table already exists from Level 1. This migration adds the
-- database-side rules that the admin UI cannot be trusted to enforce:
--   1. attribute_schema must have a valid, canonical shape
--   2. once variants exist in a category subtree, existing keys cannot be
--      removed/renamed, options cannot be removed, optional keys cannot become
--      required, new keys must be optional, and the parent cannot be changed
--
-- Both functions are SECURITY DEFINER with an empty search path, so they do not
-- depend on the caller's RLS view of the category tree and cannot be hijacked by
-- search_path manipulation. Neither is executable by application roles; they
-- are only reached through triggers.
-- =============================================================================

create or replace function private.validate_category_attribute_schema(p_schema jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attr       jsonb;
  v_opt        jsonb;
  v_key        text;
  v_label      text;
  v_option     text;
  v_seen_keys  text[] := '{}';
  v_seen_opts  text[] := '{}';
  v_count      integer := 0;
begin
  if p_schema is null or jsonb_typeof(p_schema) <> 'array' then
    raise exception 'Attribute schema must be a JSON array.'
      using errcode = '23514';
  end if;

  if jsonb_array_length(p_schema) > 20 then
    raise exception 'A category can define at most 20 attributes.'
      using errcode = '23514';
  end if;

  for v_attr in select value from jsonb_array_elements(p_schema) as t(value) loop
    v_count := v_count + 1;

    if jsonb_typeof(v_attr) <> 'object' then
      raise exception 'Attribute % must be an object.', v_count
        using errcode = '23514';
    end if;

    if jsonb_typeof(v_attr -> 'key') is distinct from 'string'
       or jsonb_typeof(v_attr -> 'label') is distinct from 'string'
       or jsonb_typeof(v_attr -> 'options') is distinct from 'array' then
      raise exception 'Attribute % needs a key, label and options array.', v_count
        using errcode = '23514';
    end if;

    if v_attr ? 'required' and jsonb_typeof(v_attr -> 'required') <> 'boolean' then
      raise exception 'Attribute % has an invalid required flag.', v_count
        using errcode = '23514';
    end if;

    v_key := btrim(v_attr ->> 'key');

    if v_key !~ '^[a-z][a-z0-9_]*$' or length(v_key) > 40 then
      raise exception 'Attribute key "%" must use lowercase letters, numbers and underscores.', v_key
        using errcode = '23514';
    end if;

    if v_key = any(v_seen_keys) then
      raise exception 'Attribute key "%" is duplicated.', v_key
        using errcode = '23514';
    end if;
    v_seen_keys := array_append(v_seen_keys, v_key);

    v_label := btrim(v_attr ->> 'label');

    if length(v_label) = 0 or length(v_label) > 60 then
      raise exception 'Attribute "%" needs a label of 1 to 60 characters.', v_key
        using errcode = '23514';
    end if;

    if jsonb_array_length(v_attr -> 'options') = 0
       or jsonb_array_length(v_attr -> 'options') > 30 then
      raise exception 'Attribute "%" needs between 1 and 30 options.', v_key
        using errcode = '23514';
    end if;

    v_seen_opts := '{}'::text[];

    for v_opt in select value from jsonb_array_elements(v_attr -> 'options') as t(value) loop
      if jsonb_typeof(v_opt) <> 'string' then
        raise exception 'Attribute "%" has a non-text option.', v_key
          using errcode = '23514';
      end if;

      v_option := btrim(v_opt #>> '{}');

      if length(v_option) = 0 or length(v_option) > 60 then
        raise exception 'Attribute "%" has an empty or overly long option.', v_key
          using errcode = '23514';
      end if;

      if lower(v_option) = any(v_seen_opts) then
        raise exception 'Option "%" is duplicated in attribute "%".', v_option, v_key
          using errcode = '23514';
      end if;
      v_seen_opts := array_append(v_seen_opts, lower(v_option));
    end loop;
  end loop;
end;
$$;

revoke all on function private.validate_category_attribute_schema(jsonb) from public;
revoke all on function private.validate_category_attribute_schema(jsonb) from anon;
revoke all on function private.validate_category_attribute_schema(jsonb) from authenticated;


create or replace function private.guard_category_schema_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schema       jsonb := coalesce(new.attribute_schema, '[]'::jsonb);
  v_old_schema   jsonb := coalesce(old.attribute_schema, '[]'::jsonb);
  v_old_attr     jsonb;
  v_new_attr     jsonb;
  v_opt          jsonb;
  v_key          text;
  v_has_variants boolean := false;
begin
  perform private.validate_category_attribute_schema(v_schema);

  if tg_op = 'INSERT' then
    return new;
  end if;

  if old.attribute_schema is distinct from new.attribute_schema
     or old.parent_id is distinct from new.parent_id then

    -- Include descendants: a parent's schema is inherited by its children.
    with recursive subtree (id, depth) as (
      select new.id, 0
      union all
      select c.id, s.depth + 1
      from public.categories c
      join subtree s on c.parent_id = s.id
      where s.depth < 64
    )
    select exists (
      select 1
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where p.category_id in (select id from subtree)
    )
    into v_has_variants;

    if v_has_variants then
      if old.parent_id is distinct from new.parent_id then
        raise exception
          'The parent cannot be changed because variants in this category tree already depend on its schema.'
          using errcode = '23514';
      end if;

      if old.attribute_schema is distinct from new.attribute_schema then
        for v_old_attr in
          select value from jsonb_array_elements(v_old_schema) as t(value)
        loop
          v_key := v_old_attr ->> 'key';
          v_new_attr := null;

          select value
            into v_new_attr
            from jsonb_array_elements(v_schema) as t(value)
           where value ->> 'key' = v_key
           limit 1;

          if v_new_attr is null then
            raise exception
              'Attribute "%" cannot be removed or renamed because variants already use this category.',
              v_key
              using errcode = '23514';
          end if;

          for v_opt in
            select value from jsonb_array_elements(v_old_attr -> 'options') as t(value)
          loop
            if not (v_new_attr -> 'options' @> jsonb_build_array(v_opt)) then
              raise exception
                'Option "%" cannot be removed from attribute "%" because variants already use it.',
                v_opt #>> '{}', v_key
                using errcode = '23514';
            end if;
          end loop;

          if coalesce((v_old_attr ->> 'required')::boolean, true) = false
             and coalesce((v_new_attr ->> 'required')::boolean, true) = true then
            raise exception
              'Attribute "%" cannot become required because existing variants may not have a value for it.',
              v_key
              using errcode = '23514';
          end if;
        end loop;

        for v_new_attr in
          select value from jsonb_array_elements(v_schema) as t(value)
        loop
          v_key := v_new_attr ->> 'key';

          if not exists (
            select 1
            from jsonb_array_elements(v_old_schema) as t(value)
            where value ->> 'key' = v_key
          ) and coalesce((v_new_attr ->> 'required')::boolean, true) then
            raise exception
              'New attribute "%" must be optional until existing variants have been updated.',
              v_key
              using errcode = '23514';
          end if;
        end loop;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_category_schema_change() from public;
revoke all on function private.guard_category_schema_change() from anon;
revoke all on function private.guard_category_schema_change() from authenticated;

drop trigger if exists guard_category_schema_change on public.categories;

create trigger guard_category_schema_change
  before insert or update of attribute_schema, parent_id on public.categories
  for each row execute function private.guard_category_schema_change();

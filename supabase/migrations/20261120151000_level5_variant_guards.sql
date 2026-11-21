-- =============================================================================
-- EveryNest - Level 5
-- 0001: trusted variant-attribute validation and catalogue guards
-- =============================================================================
-- Browser input is never trusted for attributes or category changes. These
-- triggers normalize variant attributes against the effective inherited schema
-- and block moving a product to another category once variants exist (that
-- would require an atomic attribute migration, which is deliberately out of
-- scope for this level).
-- =============================================================================

create or replace function private.effective_attribute_schema(p_category_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain (id, parent_id, attribute_schema, depth) as (
    select c.id, c.parent_id, c.attribute_schema, 0
    from public.categories c
    where c.id = p_category_id

    union all

    select parent.id, parent.parent_id, parent.attribute_schema, chain.depth + 1
    from public.categories parent
    join chain on parent.id = chain.parent_id
    where chain.depth < 64
  ),
  flat as (
    select a.value as attribute, chain.depth
    from chain
    cross join jsonb_array_elements(chain.attribute_schema) as a(value)
  ),
  dedup as (
    select distinct on (flat.attribute ->> 'key') flat.attribute
    from flat
    -- A child definition (lower depth) wins over an inherited one.
    order by flat.attribute ->> 'key', flat.depth asc
  )
  select coalesce(jsonb_agg(attribute), '[]'::jsonb)
  from dedup;
$$;

revoke all on function private.effective_attribute_schema(uuid) from public;
revoke all on function private.effective_attribute_schema(uuid) from anon;
revoke all on function private.effective_attribute_schema(uuid) from authenticated;


create or replace function private.guard_variant_attributes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_id uuid;
  v_schema      jsonb;
  v_attribute   jsonb;
  v_key         text;
  v_label       text;
  v_value       text;
  v_canonical   text;
  v_required    boolean;
  v_options     text[];
  v_normalized  jsonb := '{}'::jsonb;
begin
  select p.category_id
    into v_category_id
    from public.products p
   where p.id = new.product_id;

  if not found then
    raise exception 'The selected product does not exist.'
      using errcode = '23503';
  end if;

  v_schema := private.effective_attribute_schema(v_category_id);

  if jsonb_typeof(new.attributes) is distinct from 'object' then
    raise exception 'Variant attributes must be a JSON object.'
      using errcode = '23514';
  end if;

  for v_key in select key from jsonb_object_keys(new.attributes) as k(key) loop
    if not exists (
      select 1
      from jsonb_array_elements(v_schema) as a(value)
      where a.value ->> 'key' = v_key
    ) then
      raise exception 'Attribute "%" is not part of this category schema.', v_key
        using errcode = '23514';
    end if;
  end loop;

  for v_attribute in select value from jsonb_array_elements(v_schema) as a(value) loop
    v_key := v_attribute ->> 'key';
    v_label := v_attribute ->> 'label';
    v_required := coalesce((v_attribute ->> 'required')::boolean, true);
    v_value := nullif(btrim(new.attributes ->> v_key), '');

    if v_value is null then
      if v_required then
        raise exception 'Attribute "%" is required for this category.', v_label
          using errcode = '23514';
      end if;

      continue;
    end if;

    select array_agg(btrim(o.value #>> '{}'))
      into v_options
      from jsonb_array_elements(v_attribute -> 'options') as o(value);

    select option
      into v_canonical
      from unnest(v_options) as option
     where lower(option) = lower(v_value)
     limit 1;

    if v_canonical is null then
      raise exception '"%" is not a valid option for "%".', v_value, v_label
        using errcode = '23514';
    end if;

    v_normalized := v_normalized || jsonb_build_object(v_key, v_canonical);
  end loop;

  new.attributes := v_normalized;
  return new;
end;
$$;

revoke all on function private.guard_variant_attributes() from public;
revoke all on function private.guard_variant_attributes() from anon;
revoke all on function private.guard_variant_attributes() from authenticated;

drop trigger if exists guard_variant_attributes on public.product_variants;

create trigger guard_variant_attributes
  before insert or update of attributes, product_id on public.product_variants
  for each row execute function private.guard_variant_attributes();


create or replace function private.guard_product_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.category_id is distinct from new.category_id
     and exists (
       select 1
       from public.product_variants v
       where v.product_id = new.id
     ) then
    raise exception
      'A product category cannot be changed once variants exist. Archive this product and create a replacement instead.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_product_category_change() from public;
revoke all on function private.guard_product_category_change() from anon;
revoke all on function private.guard_product_category_change() from authenticated;

drop trigger if exists guard_product_category_change on public.products;

create trigger guard_product_category_change
  before update of category_id on public.products
  for each row execute function private.guard_product_category_change();

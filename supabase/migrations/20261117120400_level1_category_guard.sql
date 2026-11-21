-- =============================================================================
-- EveryNest - Level 1
-- 0005: category hierarchy protection
-- =============================================================================
-- Prevents a category from becoming its own ancestor. Cycle detection walks the
-- parent chain; the depth cap also protects against runaway loops in damaged
-- data.
--
-- The function is SECURITY DEFINER because it only reads the category tree and
-- must not depend on the caller's RLS view of another category row.
-- =============================================================================

create or replace function private.guard_category_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent uuid;
  v_depth  integer := 0;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent'
      using errcode = '23514';
  end if;

  v_parent := new.parent_id;

  while v_parent is not null loop
    v_depth := v_depth + 1;

    if v_depth > 64 then
      raise exception 'Category hierarchy is too deep'
        using errcode = '23514';
    end if;

    if v_parent = new.id then
      raise exception 'Category hierarchy would contain a cycle'
        using errcode = '23514';
    end if;

    select c.parent_id
      into v_parent
      from public.categories c
     where c.id = v_parent;
  end loop;

  return new;
end;
$$;

revoke all on function private.guard_category_cycle() from public;
revoke all on function private.guard_category_cycle() from anon;
revoke all on function private.guard_category_cycle() from authenticated;

create trigger guard_category_cycle
  before insert or update of parent_id on public.categories
  for each row execute function private.guard_category_cycle();

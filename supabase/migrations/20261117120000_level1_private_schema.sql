-- =============================================================================
-- EveryNest - Level 1
-- 0001: internal schema for trusted helper functions
-- =============================================================================
-- Everything in `private` is intentionally NOT exposed through the Supabase
-- Data API. Helper functions that must be callable from RLS policies get
-- narrowly scoped EXECUTE grants in a later migration.
-- =============================================================================

create schema if not exists private;

comment on schema private is
  'Internal helpers for EveryNest. Not part of the public Data API.';

-- Start from a clean slate: nothing is reachable by anonymous or logged-in
-- clients until an explicit grant is added.
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

-- New functions are executable by PUBLIC by default in PostgreSQL. That default
-- is the classic Supabase footgun: a helper created later becomes callable from
-- the browser the moment it exists. Revoke it now for every future function in
-- both schemas so each function must receive an explicit grant.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

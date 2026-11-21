-- =============================================================================
-- Level 11 (follow-up) - saved addresses phone check constraint fix
-- =============================================================================
-- The original constraint called private.normalize_pakistani_phone() from a
-- CHECK. Check constraints execute as the invoking role, and that helper is
-- deliberately NOT executable by authenticated users (Level 8), so every
-- customer INSERT failed with 42501. Replace it with the same self-contained
-- canonical-form regex used by public.orders.
-- =============================================================================

alter table public.saved_addresses
  drop constraint if exists saved_addresses_phone_valid;

alter table public.saved_addresses
  add constraint saved_addresses_phone_valid
  check (phone ~ '^[+]923[0-9]{9}$');

comment on constraint saved_addresses_phone_valid on public.saved_addresses is
  'Stored phone numbers are canonical +92 mobile numbers; normalization happens in the application layer before insert.';

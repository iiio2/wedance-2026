-- Hangout "Where?" picked from Google Places: keep the place id, address and
-- coordinates next to the display name (venue). Additive, idempotent.
-- Rollback: ALTER TABLE hangouts DROP COLUMN place_id, DROP COLUMN place_address,
--           DROP COLUMN place_lat, DROP COLUMN place_lng;
ALTER TABLE "hangouts" ADD COLUMN IF NOT EXISTS "place_id" text;
ALTER TABLE "hangouts" ADD COLUMN IF NOT EXISTS "place_address" text;
ALTER TABLE "hangouts" ADD COLUMN IF NOT EXISTS "place_lat" double precision;
ALTER TABLE "hangouts" ADD COLUMN IF NOT EXISTS "place_lng" double precision;

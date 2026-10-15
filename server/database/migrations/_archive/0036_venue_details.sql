-- Venue details (business mode), from what v3 venues had and v4 planned:
-- amenities (v3's list), capacity, opening hours (day → hours), a floor plan
-- image (map_url keeps the Google Maps link most imported venues carry), and
-- booking contacts (phone, email, WhatsApp, Telegram) that only signed-in
-- organizers see — never on the public page. lat / lng: where the venue is
-- (from its Google listing in v3, scripts/sync-v3-venue-details.ts).
-- Venue type now uses v3's values (DanceStudio, Club, OpenAir…); old free-text
-- values stay as they are and still show.
-- Additive: columns with defaults or nullable.
-- Rollback: ALTER TABLE "profiles" DROP COLUMN IF EXISTS "amenities", DROP COLUMN IF EXISTS "capacity",
--           DROP COLUMN IF EXISTS "opening_hours", DROP COLUMN IF EXISTS "floor_plan", DROP COLUMN IF EXISTS "contact",
--           DROP COLUMN IF EXISTS "lat", DROP COLUMN IF EXISTS "lng";
--           ALTER TABLE "dancers" DROP COLUMN IF EXISTS "old_usernames";
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "amenities" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "capacity" integer;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "opening_hours" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "floor_plan" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "contact" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lat" double precision;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lng" double precision;
-- Readable handles (scripts/readable-handles.ts): a dancer's earlier handles,
-- so old /u/<handle> links forward. (Profiles keep theirs in source_ref.oldHandles.)
ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "old_usernames" jsonb DEFAULT '[]'::jsonb NOT NULL;

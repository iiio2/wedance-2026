-- Festivals are events (ADR-006): what a festival page shows beyond an event —
-- logo and colour, links, practical info, passes, the programme of workshops
-- and parties, and teacher videos — moves from hardcoded files into the event.
-- `key` is the festival's old slug: dancers' plans, picks, sign-ups, dinners,
-- rides and reviews are keyed by it, so it never changes.
-- Additive: one nullable column.
-- Rollback: ALTER TABLE "events" DROP COLUMN IF EXISTS "festival";
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "festival" jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS "events_festival_key_uidx" ON "events" USING btree (("festival"->>'key')) WHERE "festival" IS NOT NULL;

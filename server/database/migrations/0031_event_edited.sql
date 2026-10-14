-- Every event is editable (business mode): who last checked an event on
-- WeDance and when. Shown as "Checked by … " on the event page (an edited event
-- is more trustworthy), and the v3 sync stops overwriting an event once a
-- person has edited it here.
-- Additive: two nullable columns.
-- Rollback: ALTER TABLE "events" DROP COLUMN IF EXISTS "edited_at", DROP COLUMN IF EXISTS "edited_by";
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "edited_at" timestamp;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "edited_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL;

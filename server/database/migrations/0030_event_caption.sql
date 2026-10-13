-- Event caption (business mode): the Instagram caption written for an event's
-- flyer, with the lines it was written from, so the editor can tell when it's
-- out of date. Additive: one nullable column.
-- Rollback: ALTER TABLE "events" DROP COLUMN IF EXISTS "caption";
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "caption" jsonb;

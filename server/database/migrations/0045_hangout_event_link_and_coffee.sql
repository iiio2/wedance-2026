-- Add event_id FK so hangouts can be linked to a specific event.
-- Add index for the listByEvent query.
ALTER TABLE "hangouts"
  ADD COLUMN IF NOT EXISTS "event_id" uuid REFERENCES "events" ("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "hangouts_event_idx"
  ON "hangouts" ("event_id") WHERE "event_id" IS NOT NULL;

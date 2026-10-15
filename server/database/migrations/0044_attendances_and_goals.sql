-- RAZ-312 Phase 4 expand: attendances (ADR-008) and dancer_goals (ADR-009).
--
-- This is the EXPAND step: new tables alongside the old ones. plan_items and
-- festival_signups continue to be read and written; the new tables receive
-- dual-writes from plan.add (festival/event) so they accumulate data for the
-- eventual switch. No reads change yet.
--
-- order_id has no FK: the orders table (Phase 3 Step 22) doesn't exist yet.
-- The FK is added when orders ship.

-- attendances: replaces plan_items (festival/event rows) + festival_signups.
CREATE TABLE IF NOT EXISTS "attendances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events" ("id") ON DELETE CASCADE,
  "dancer_id" uuid REFERENCES "dancers" ("id") ON DELETE CASCADE,
  "buyer_email" text,
  "status" text NOT NULL CHECK ("status" IN ('interested', 'going', 'ticket_holder')),
  "source" text NOT NULL DEFAULT 'click' CHECK ("source" IN ('click', 'free_pass', 'social_pass', 'stripe', 'tickettailor', 'claim')),
  "order_id" uuid,
  "visibility" text NOT NULL DEFAULT 'hidden' CHECK ("visibility" IN ('hidden', 'public_minimal', 'public_full')),
  "partner_status" text CHECK ("partner_status" IN ('looking', 'found')),
  "travel_booked_at" timestamp,
  "stay_booked_at" timestamp,
  "vacation_booked_at" timestamp,
  "checked_in_at" timestamp,
  "verified_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "attendances_has_identity" CHECK ("dancer_id" IS NOT NULL OR "buyer_email" IS NOT NULL)
);

-- One attendance per dancer per event.
CREATE UNIQUE INDEX IF NOT EXISTS "attendances_event_dancer"
  ON "attendances" ("event_id", "dancer_id");

-- One unclaimed stub per email per event.
CREATE UNIQUE INDEX IF NOT EXISTS "attendances_event_email_uidx"
  ON "attendances" ("event_id", lower("buyer_email"))
  WHERE "dancer_id" IS NULL;

-- Public list: visible attendees by event.
CREATE INDEX IF NOT EXISTS "attendances_event_status_idx"
  ON "attendances" ("event_id", "status")
  WHERE "visibility" <> 'hidden';

-- My attendance lookups.
CREATE INDEX IF NOT EXISTS "attendances_dancer_idx"
  ON "attendances" ("dancer_id");


-- dancer_goals: replaces plan_items with item_type='goal'.
CREATE TABLE IF NOT EXISTS "dancer_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dancer_id" uuid NOT NULL REFERENCES "dancers" ("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "target" text,
  "period_year" integer,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "dancer_goals_dancer_idx"
  ON "dancer_goals" ("dancer_id");

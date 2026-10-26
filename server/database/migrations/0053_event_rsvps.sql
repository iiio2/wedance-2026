-- Event RSVPs (RAZ-718): the organiser's poll as the RSVP ("Yes, with my
-- partner · Yes, I need a leader · Yes, I need a follower · Next time").
-- One answer per dancer, or per anonymous browser (guest_token) until the
-- magic link confirms it (schema.ts eventRsvps, shared/utils/rsvp.ts).
--
-- New table only, nothing else touched. Additive and idempotent: re-running is
-- a no-op. Applied by scripts/db-migrate.ts on the first production deploy after merge.
--
-- Rollback:
--   DROP TABLE IF EXISTS event_rsvps;

BEGIN;

CREATE TABLE IF NOT EXISTS "event_rsvps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "dancer_id" uuid REFERENCES "dancers"("id") ON DELETE CASCADE,
  "guest_token" text,
  "answer" text NOT NULL,
  "confirmed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "event_rsvps_event_dancer" UNIQUE ("event_id", "dancer_id"),
  CONSTRAINT "event_rsvps_event_guest" UNIQUE ("event_id", "guest_token"),
  CONSTRAINT "event_rsvps_dancer_or_guest" CHECK (num_nonnulls("dancer_id", "guest_token") >= 1)
);

CREATE INDEX IF NOT EXISTS "event_rsvps_event_idx" ON "event_rsvps" ("event_id");

COMMIT;

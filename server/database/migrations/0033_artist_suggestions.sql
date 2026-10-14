-- Artist confirmation (business mode): an organizer's photos, video and name
-- for an artist in their line-up become pending suggestions on the artist's
-- profile; the artist approves them through a personal link (and can create an
-- account to own an unclaimed page). Profiles get a video list.
-- Additive: two new tables, one column with a default.
-- Rollback: DROP TABLE IF EXISTS "profile_suggestions", "profile_invites";
--           ALTER TABLE "profiles" DROP COLUMN IF EXISTS "videos";
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "videos" jsonb DEFAULT '[]'::jsonb NOT NULL;

CREATE TABLE IF NOT EXISTS "profile_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL,
  "suggested_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "decided_at" timestamp,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "profile_suggestions_profile_idx" ON "profile_suggestions" USING btree ("profile_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "profile_suggestions_pending_uidx" ON "profile_suggestions" USING btree ("profile_id", "kind", "value") WHERE "status" = 'pending';

CREATE TABLE IF NOT EXISTS "profile_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "event_id" uuid REFERENCES "events"("id") ON DELETE CASCADE,
  "created_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "last_used_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "profile_invites_token_uidx" ON "profile_invites" USING btree ("token");
CREATE UNIQUE INDEX IF NOT EXISTS "profile_invites_event_profile_uidx" ON "profile_invites" USING btree ("event_id", "profile_id");

-- Business mode, teams: join a profile's team with a role, reclaim a profile,
-- public titles on team members, and an access history log.
-- Additive: new columns have defaults or are nullable; one new table.
-- Rollback: DROP TABLE IF EXISTS "profile_access_log";
--   ALTER TABLE "profile_claims" DROP COLUMN IF EXISTS "kind", DROP COLUMN IF EXISTS "requested_role",
--     DROP COLUMN IF EXISTS "title", DROP COLUMN IF EXISTS "decided_by";
--   ALTER TABLE "profile_members" DROP COLUMN IF EXISTS "title", DROP COLUMN IF EXISTS "added_by";
ALTER TABLE "profile_claims" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'claim' NOT NULL;
ALTER TABLE "profile_claims" ADD COLUMN IF NOT EXISTS "requested_role" text DEFAULT 'owner' NOT NULL;
ALTER TABLE "profile_claims" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "profile_claims" ADD COLUMN IF NOT EXISTS "decided_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL;
ALTER TABLE "profile_members" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "profile_members" ADD COLUMN IF NOT EXISTS "added_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS "profile_access_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "actor_id" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "subject_id" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "role" text,
  "note" text,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "profile_access_log_profile_idx" ON "profile_access_log" USING btree ("profile_id", "created_at");

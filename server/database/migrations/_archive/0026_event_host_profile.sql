-- Business mode: events created in /host belong to a profile (organizer, venue or
-- artist) whose managers can edit them. Synced v3 events keep host_profile_id NULL.
-- Additive: one nullable column + index; touches no existing rows.
-- Rollback: ALTER TABLE "events" DROP COLUMN IF EXISTS "host_profile_id";
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "host_profile_id" uuid REFERENCES "profiles"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "events_host_profile_idx" ON "events" USING btree ("host_profile_id");

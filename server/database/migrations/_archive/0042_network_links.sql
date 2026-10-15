-- RAZ-408: Business "Network" — the artists, venues and organizers a page
-- works with. Most of the network is derived from shared events (no table);
-- this table holds what a page's team curated on top: someone they ADDED by
-- hand, or a derived contact they HID. One row per (my page, their page).
-- Also indexes events.artists so "events this artist played" is not a scan.
-- Rollback: DROP TABLE IF EXISTS "network_links"; DROP INDEX IF EXISTS "events_artists_gin";
CREATE TABLE IF NOT EXISTS "network_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "other_profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "created_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "network_links_pair" UNIQUE ("profile_id", "other_profile_id"),
  CONSTRAINT "network_links_status" CHECK ("status" IN ('added', 'hidden')),
  CONSTRAINT "network_links_not_self" CHECK ("profile_id" <> "other_profile_id")
);

CREATE INDEX IF NOT EXISTS "network_links_profile_idx" ON "network_links" ("profile_id");
CREATE INDEX IF NOT EXISTS "events_artists_gin" ON "events" USING gin ("artists");

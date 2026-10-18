-- MCP server, phase 2 (docs/proposals/2026-10-18-mcp-server.md, schema.ts
-- "MCP server, phase 2"): promoter tracked links and what they brought, gig
-- applications, giveaway proposals.
--
-- Four new tables, nothing else touched. Additive and idempotent: re-running is
-- a no-op. The influencer flag needs no column: it is the 'influencer' entry in
-- the existing profiles.roles list of a promoter page.
-- Applied by scripts/db-migrate.ts on the first production deploy after merge.
--
-- Rollback (drops the links and their counts, applications and proposals; an
-- approved proposal's giveaway stays in `giveaways`):
--   DROP TABLE IF EXISTS tracked_link_actions, tracked_links, gig_applications,
--     giveaway_proposals;

BEGIN;

CREATE TABLE IF NOT EXISTS "tracked_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "event_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "created_by" uuid,
  "caption" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "tracked_links_code_unique" UNIQUE ("code"),
  CONSTRAINT "tracked_links_event_profile" UNIQUE ("event_id", "profile_id"),
  CONSTRAINT "tracked_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events" ("id") ON DELETE CASCADE,
  CONSTRAINT "tracked_links_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles" ("id") ON DELETE CASCADE,
  CONSTRAINT "tracked_links_created_by_dancers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."dancers" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "tracked_links_profile_idx" ON "tracked_links" ("profile_id");

CREATE TABLE IF NOT EXISTS "tracked_link_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "link_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "dancer_id" uuid,
  "visitor_id" text,
  "ref" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "tracked_link_actions_link_id_tracked_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."tracked_links" ("id") ON DELETE CASCADE,
  CONSTRAINT "tracked_link_actions_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_link_actions_dancer_uidx" ON "tracked_link_actions" ("link_id", "kind", "dancer_id") WHERE "dancer_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tracked_link_actions_visitor_uidx" ON "tracked_link_actions" ("link_id", "kind", "visitor_id") WHERE "dancer_id" IS NULL AND "visitor_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "tracked_link_actions_link_idx" ON "tracked_link_actions" ("link_id", "kind");

CREATE TABLE IF NOT EXISTS "gig_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "gig_id" uuid NOT NULL,
  "dancer_id" uuid NOT NULL,
  "profile_id" uuid,
  "message" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "decided_by" uuid,
  "decided_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "gig_applications_gig_dancer" UNIQUE ("gig_id", "dancer_id"),
  CONSTRAINT "gig_applications_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs" ("id") ON DELETE CASCADE,
  CONSTRAINT "gig_applications_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers" ("id") ON DELETE CASCADE,
  CONSTRAINT "gig_applications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles" ("id") ON DELETE SET NULL,
  CONSTRAINT "gig_applications_decided_by_dancers_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."dancers" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "gig_applications_dancer_idx" ON "gig_applications" ("dancer_id");

CREATE TABLE IF NOT EXISTS "giveaway_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "proposed_by" uuid,
  "profile_id" uuid NOT NULL,
  "prize" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "sponsor_name" text,
  "ends_at" timestamp,
  "status" text NOT NULL DEFAULT 'pending',
  "note" text,
  "giveaway_id" uuid,
  "decided_by" uuid,
  "decided_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "giveaway_proposals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events" ("id") ON DELETE CASCADE,
  CONSTRAINT "giveaway_proposals_proposed_by_dancers_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."dancers" ("id") ON DELETE SET NULL,
  CONSTRAINT "giveaway_proposals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles" ("id") ON DELETE CASCADE,
  CONSTRAINT "giveaway_proposals_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways" ("id") ON DELETE SET NULL,
  CONSTRAINT "giveaway_proposals_decided_by_dancers_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."dancers" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "giveaway_proposals_event_idx" ON "giveaway_proposals" ("event_id", "status");
CREATE INDEX IF NOT EXISTS "giveaway_proposals_profile_idx" ON "giveaway_proposals" ("profile_id");

COMMIT;

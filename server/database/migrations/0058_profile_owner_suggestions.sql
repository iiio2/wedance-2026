-- Who probably runs a business page nobody manages yet. Pages came over without
-- their teams; these are leads for an admin, shown in Admin → Users with "Make
-- owner" — never access by themselves, and never in the claims queue (that stays
-- for requests people actually sent). Read from wedance.vip (v3, live) by
-- scripts/import-page-owner-suggestions.ts. source: 'v3-own' (the page is their
-- own account) · 'v3-team' (Team Members) · 'v3-creator' (created it).
--
-- Additive and idempotent. Applied by scripts/db-migrate.ts on the first
-- production deploy after merge.
--
-- Rollback:
--   DROP TABLE IF EXISTS profile_owner_suggestions;

BEGIN;

CREATE TABLE IF NOT EXISTS "profile_owner_suggestions" (
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "dancer_id" uuid NOT NULL REFERENCES "dancers"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  PRIMARY KEY ("profile_id", "dancer_id")
);

CREATE INDEX IF NOT EXISTS "profile_owner_suggestions_dancer_idx" ON "profile_owner_suggestions" ("dancer_id");

COMMIT;

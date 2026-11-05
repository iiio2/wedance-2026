-- Version history of profiles' websites (RAZ-412): every save from the web
-- editor or an AI app (MCP update_my_site) keeps the whole site, who saved it,
-- from where and a short summary of what changed. Business → page → Website →
-- History lists them; restoring saves an old version again as a new one.
-- The last 100 versions per site are kept (server/utils/siteVersions.ts).
--
-- Each existing site gets its current content as the first version.
--
-- Additive and idempotent. Applied by scripts/db-migrate.ts on the first
-- production deploy after merge.
--
-- Rollback:
--   DROP TABLE IF EXISTS profile_site_versions;

BEGIN;

CREATE TABLE IF NOT EXISTS "profile_site_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "content" jsonb NOT NULL,
  "saved_at" timestamp NOT NULL DEFAULT now(),
  "saved_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "via" text NOT NULL DEFAULT 'web',
  "client_app" text,
  "summary" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "restored_from" uuid
);

CREATE INDEX IF NOT EXISTS "profile_site_versions_profile_idx" ON "profile_site_versions" ("profile_id", "saved_at");

INSERT INTO "profile_site_versions" ("profile_id", "content", "saved_at", "saved_by", "via", "summary")
SELECT s."profile_id", s."content", s."updated_at", s."updated_by", 'backfill', '["The site when version history started"]'::jsonb
FROM "profile_sites" s
WHERE NOT EXISTS (SELECT 1 FROM "profile_site_versions" v WHERE v."profile_id" = s."profile_id");

COMMIT;

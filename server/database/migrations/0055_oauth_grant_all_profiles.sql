-- oauth_grants.all_profiles: the dancer ticked "All my pages" on the consent
-- screen (#457), so the app may act for every page they're on the team of —
-- including pages they make or join after connecting. Resolved per request
-- (server/oauth/tokens.ts); profile_ids still holds the pages at consent time.
--
-- Column only, nothing else touched. Additive and idempotent: re-running is
-- a no-op. Applied by scripts/db-migrate.ts on the first production deploy after merge.
--
-- Rollback:
--   ALTER TABLE oauth_grants DROP COLUMN IF EXISTS all_profiles;

BEGIN;

ALTER TABLE "oauth_grants" ADD COLUMN IF NOT EXISTS "all_profiles" boolean NOT NULL DEFAULT false;

COMMIT;

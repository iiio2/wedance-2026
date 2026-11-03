-- One handle per person (#474, ADR-012): a dancer can mark one page they own
-- (artist / organiser) as "this is me". That page's /@handle becomes their public
-- identity: /u/<username> and /@<username> forward to it, and it shows their
-- dancer side. One page per person, one person per page (UNIQUE).
--
-- Additive and idempotent. Applied by scripts/db-migrate.ts on the first
-- production deploy after merge.
--
-- Rollback:
--   ALTER TABLE dancers DROP COLUMN IF EXISTS page_profile_id;

BEGIN;

ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "page_profile_id" uuid
  REFERENCES "profiles"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "dancers_page_profile_id_unique" ON "dancers" ("page_profile_id");

COMMIT;

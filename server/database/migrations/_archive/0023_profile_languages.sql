-- RAZ-66 added profiles.languages to schema.ts without a migration; production
-- was missing the column and /artists returned 0 rows. Applied to production
-- manually on 2026-10-12 (idempotent).
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "languages" json DEFAULT '[]'::json;

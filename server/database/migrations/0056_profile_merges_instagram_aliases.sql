-- Duplicate business profiles (#458, RAZ-746):
--   * profiles.instagram_aliases — other Instagram accounts a business has had
--     (lowercased handles). The main one stays in socials; dedupe matches both.
--   * profile_merges — audit trail of "merge this copy into that page": who, when,
--     the ids of every row moved and the kept page's fields before, so a merge
--     can be undone. The copy itself is hidden with source_ref.mergedInto, which
--     /@copy already forwards on.
--
-- Additive and idempotent: a new column with a constant default (no rewrite), a
-- new table and indexes. Applied by scripts/db-migrate.ts on the first
-- production deploy after merge.
--
-- Rollback:
--   DROP TABLE IF EXISTS profile_merges;
--   DROP INDEX IF EXISTS profiles_instagram_aliases_idx;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS instagram_aliases;

BEGIN;

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "instagram_aliases" jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS "profiles_instagram_aliases_idx" ON "profiles" USING gin ("instagram_aliases");

CREATE TABLE IF NOT EXISTS "profile_merges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "to_profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "from_username" text NOT NULL,
  "to_username" text NOT NULL,
  "merged_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "merged_at" timestamp DEFAULT now(),
  "moved" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "before" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "undone_at" timestamp,
  "undone_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "profile_merges_from_idx" ON "profile_merges" ("from_profile_id");
CREATE INDEX IF NOT EXISTS "profile_merges_to_idx" ON "profile_merges" ("to_profile_id");

COMMIT;

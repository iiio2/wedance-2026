-- Reconcile the follow graph with ADR-004 (schema.ts `follows`).
--
-- 0044 Step 15 assumed `follows` did not exist and renamed `artist_follows`
-- into it. But the v4 import (scripts/migrate/00-schema.mjs) had already
-- created a `follows` table of a different shape (follower_id, target_username),
-- so the rename failed and production kept:
--   follows        (follower_id, target_username, source_ref)  ← v4 import
--   artist_follows (dancer_id, profile_id)                     ← 0022, real follows
-- while the app queries follows(dancer_id, profile_id, target_dancer_id) →
-- every follow.* call 500s ("Failed query … follows.profile_id"), so Follow
-- on /@handle does nothing.
--
-- This migration converges ANY of these states to the ADR-004 shape, in one
-- transaction (all or nothing), and is a no-op when re-run:
--   v4 follows ± artist_follows ± a partial 0044 run · artist_follows only ·
--   neither · already correct.
-- v4 edges are converted: target handle → profile (following a merge to the
-- surviving profile) → profile_id; else → dancer → target_dancer_id; else →
-- legacy_follows. The v4 table is kept as `follows_v4` for provenance.
--
-- Rollback (after checking nothing new was written you want to keep):
--   BEGIN;
--   DELETE FROM legacy_follows WHERE source = 'v4';
--   ALTER TABLE follows RENAME TO artist_follows;
--   ALTER TABLE follows_v4 RENAME TO follows;
--   COMMIT;
-- (artist_follows then also holds the converted v4 rows and nullable profile_id.)

BEGIN;

DO $$
BEGIN
  -- 1 · Move the v4-shaped table out of the way.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'follows' AND column_name = 'follower_id'
  ) THEN
    ALTER TABLE "follows" RENAME TO "follows_v4";
    -- A partial 0044 run may have added these to the v4 table; their names
    -- belong to the real table.
    ALTER TABLE "follows_v4" DROP COLUMN IF EXISTS "target_dancer_id";
    IF to_regclass('public.follows_pkey') IS NOT NULL THEN
      ALTER INDEX "follows_pkey" RENAME TO "follows_v4_pkey";
    END IF;
  END IF;

  -- 2 · The real follow table: rename artist_follows, or create it.
  IF to_regclass('public.follows') IS NULL THEN
    IF to_regclass('public.artist_follows') IS NOT NULL THEN
      ALTER TABLE "artist_follows" RENAME TO "follows";
    ELSE
      CREATE TABLE "follows" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "dancer_id" uuid NOT NULL REFERENCES "dancers"("id"),
        "profile_id" uuid REFERENCES "profiles"("id"),
        "created_at" timestamp DEFAULT now()
      );
    END IF;
  END IF;
END $$;

-- 3 · ADR-004 columns, constraints and indexes.
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "target_dancer_id" uuid REFERENCES "dancers"("id");
ALTER TABLE "follows" ALTER COLUMN "profile_id" DROP NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.artist_follows_pkey') IS NOT NULL THEN
    ALTER INDEX "artist_follows_pkey" RENAME TO "follows_pkey";
  END IF;

  -- (dancer, profile) uniqueness — 0022's constraint, under either name.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_follows_dancer_profile') THEN
    ALTER TABLE "follows" RENAME CONSTRAINT "artist_follows_dancer_profile" TO "follows_dancer_profile";
  ELSIF to_regclass('public.artist_follows_dancer_profile') IS NOT NULL THEN
    ALTER INDEX "artist_follows_dancer_profile" RENAME TO "follows_dancer_profile";
  END IF;
  IF to_regclass('public.follows_dancer_profile') IS NULL THEN
    ALTER TABLE "follows" ADD CONSTRAINT "follows_dancer_profile" UNIQUE ("dancer_id", "profile_id");
  END IF;

  -- (dancer, dancer) uniqueness — 0044 used a partial index; either satisfies it.
  IF to_regclass('public.follows_dancer_dancer') IS NULL
     AND to_regclass('public.follows_dancer_dancer_uidx') IS NULL THEN
    ALTER TABLE "follows" ADD CONSTRAINT "follows_dancer_dancer" UNIQUE ("dancer_id", "target_dancer_id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'follows_exactly_one_target') THEN
    ALTER TABLE "follows" ADD CONSTRAINT "follows_exactly_one_target"
      CHECK (num_nonnulls("profile_id", "target_dancer_id") = 1);
  END IF;

  IF to_regclass('public.artist_follows_profile_idx') IS NOT NULL THEN
    ALTER INDEX "artist_follows_profile_idx" RENAME TO "follows_profile_idx";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "follows_profile_idx" ON "follows" ("profile_id");
CREATE INDEX IF NOT EXISTS "follows_target_dancer_idx" ON "follows" ("target_dancer_id");

CREATE TABLE IF NOT EXISTS "legacy_follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dancer_id" uuid NOT NULL REFERENCES "dancers"("id"),
  "target_username" text NOT NULL,
  "source" text NOT NULL DEFAULT 'v4',
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "legacy_follows_dancer_target" UNIQUE ("dancer_id", "target_username")
);

-- 4 · Convert the v4 edges (idempotent: ON CONFLICT DO NOTHING).
DO $$
BEGIN
  IF to_regclass('public.follows_v4') IS NULL THEN RETURN; END IF;

  -- → profile (a merged profile resolves to the one it was merged into).
  INSERT INTO "follows" ("dancer_id", "profile_id", "created_at")
  SELECT DISTINCT ON (v.follower_id, COALESCE(m.id, p.id))
         v.follower_id, COALESCE(m.id, p.id), v.created_at
  FROM "follows_v4" v
  JOIN "profiles" p ON p.username = v.target_username
  LEFT JOIN "profiles" m ON m.username = p.source_ref->>'mergedInto'
  ON CONFLICT DO NOTHING;

  -- → dancer (no profile with that handle; never a self-follow).
  INSERT INTO "follows" ("dancer_id", "target_dancer_id", "created_at")
  SELECT v.follower_id, d.id, v.created_at
  FROM "follows_v4" v
  JOIN "dancers" d ON d.username = v.target_username
  WHERE d.id <> v.follower_id
    AND NOT EXISTS (SELECT 1 FROM "profiles" p WHERE p.username = v.target_username)
  ON CONFLICT DO NOTHING;

  -- → unresolved, kept for provenance.
  INSERT INTO "legacy_follows" ("dancer_id", "target_username", "source", "created_at")
  SELECT v.follower_id, v.target_username, 'v4', v.created_at
  FROM "follows_v4" v
  WHERE NOT EXISTS (SELECT 1 FROM "profiles" p WHERE p.username = v.target_username)
    AND NOT EXISTS (SELECT 1 FROM "dancers" d WHERE d.username = v.target_username)
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;

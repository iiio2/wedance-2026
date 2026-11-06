-- Admin → Users: "last logged in" and "days used".
--   * dancer_active_days — one row per user per day they used WeDance while
--     signed in (web session or a connected app). Written by createContext
--     (server/utils/activeDays.ts), at most once per user per day per instance.
--   * Backfilled from sessions.created_at, so history counts the days people
--     logged in; from now on every signed-in day counts.
--   * sessions_dancer_id_idx — "last logged in" is max(sessions.created_at).
--
-- Additive and idempotent. Applied by scripts/db-migrate.ts on the first
-- production deploy after merge.
--
-- Rollback:
--   DROP TABLE IF EXISTS dancer_active_days;
--   DROP INDEX IF EXISTS sessions_dancer_id_idx;

BEGIN;

CREATE TABLE IF NOT EXISTS "dancer_active_days" (
  "dancer_id" uuid NOT NULL REFERENCES "dancers"("id") ON DELETE CASCADE,
  "day" date NOT NULL,
  PRIMARY KEY ("dancer_id", "day")
);

CREATE INDEX IF NOT EXISTS "sessions_dancer_id_idx" ON "sessions" ("dancer_id", "created_at");

INSERT INTO "dancer_active_days" ("dancer_id", "day")
SELECT DISTINCT "dancer_id", "created_at"::date
FROM "sessions" WHERE "created_at" IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;

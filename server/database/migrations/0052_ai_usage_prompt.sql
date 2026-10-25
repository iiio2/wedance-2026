-- AI usage log: the request as sent (schema.ts aiUsage), so admins can read
-- every prompt on /admin/ai-usage and spot mistakes in it.
--
-- Two nullable columns, nothing else touched. Additive and idempotent: re-running
-- is a no-op. Older rows stay without a prompt.
-- Applied by scripts/db-migrate.ts on the first production deploy after merge.
--
-- Rollback:
--   ALTER TABLE ai_usage DROP COLUMN IF EXISTS prompt, DROP COLUMN IF EXISTS images;

BEGIN;

ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "prompt" text;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "images" jsonb;

COMMIT;

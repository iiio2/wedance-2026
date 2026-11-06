-- mcp_audit: where each MCP call came from — the app (ChatGPT, Claude,
-- Cursor…, server/mcp/caller.ts), the raw User-Agent (to reclassify later) and
-- Vercel's country code. Never the IP. Set for anonymous /mcp/public calls too.
--
-- Columns only, nothing else touched. Additive and idempotent: re-running is
-- a no-op. Applied by scripts/db-migrate.ts on the first production deploy after merge.
--
-- Rollback:
--   ALTER TABLE mcp_audit DROP COLUMN IF EXISTS client_app,
--     DROP COLUMN IF EXISTS user_agent, DROP COLUMN IF EXISTS country;

BEGIN;

ALTER TABLE "mcp_audit" ADD COLUMN IF NOT EXISTS "client_app" text;
ALTER TABLE "mcp_audit" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE "mcp_audit" ADD COLUMN IF NOT EXISTS "country" text;

COMMIT;

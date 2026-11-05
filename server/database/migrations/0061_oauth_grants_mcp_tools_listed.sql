-- Which MCP tool list a connected app was last served (tools/list), per grant:
-- { "version": "<hash>", "names": [...], "at": "<iso>" }. When a later tool
-- call comes from an older list, the result tells the app to refresh the
-- connector (server/mcp/version.ts). NULL = never seen a tools/list.
--
-- Additive and idempotent. Applied by scripts/db-migrate.ts on the first
-- production deploy after merge.
--
-- Rollback:
--   ALTER TABLE oauth_grants DROP COLUMN IF EXISTS mcp_tools_listed;

BEGIN;

ALTER TABLE "oauth_grants" ADD COLUMN IF NOT EXISTS "mcp_tools_listed" jsonb;

-- Apps connected before this have a list from before the website tools
-- (get_my_site / update_my_site): mark it unknown-old, so their next call
-- says to refresh once. Their next tools/list replaces it.
UPDATE "oauth_grants" SET "mcp_tools_listed" = jsonb_build_object('version', 'before-0061', 'names', '[]'::jsonb, 'at', now())
  WHERE "mcp_tools_listed" IS NULL AND "revoked_at" IS NULL;

COMMIT;

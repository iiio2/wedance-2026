-- MCP server, phase 1: WeDance as its own OAuth 2.1 authorization server
-- (docs/proposals/2026-10-18-mcp-server.md, schema.ts "MCP server").
--
-- Six new tables, nothing else touched. Additive and idempotent: re-running is
-- a no-op. Tokens and codes are stored as sha256 hashes, never in plain text.
-- Applied by scripts/db-migrate.ts on the first production deploy after merge.
--
-- Rollback (drops every connected app and token; nothing else depends on them):
--   DROP TABLE IF EXISTS mcp_rate_limits, mcp_audit, oauth_tokens, oauth_codes,
--     oauth_grants, oauth_clients;

BEGIN;

CREATE TABLE IF NOT EXISTS "oauth_clients" (
  "id" text PRIMARY KEY,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "redirect_uris" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "client_uri" text,
  "logo_uri" text,
  "token_endpoint_auth_method" text NOT NULL DEFAULT 'none',
  "client_secret_hash" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "metadata_fetched_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "oauth_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dancer_id" uuid NOT NULL,
  "client_id" text NOT NULL,
  "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "profile_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "revoked_at" timestamp,
  "revoked_reason" text,
  "last_used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "oauth_grants_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers" ("id") ON DELETE CASCADE,
  CONSTRAINT "oauth_grants_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "oauth_grants_dancer_idx" ON "oauth_grants" ("dancer_id");
CREATE INDEX IF NOT EXISTS "oauth_grants_client_idx" ON "oauth_grants" ("client_id");

CREATE TABLE IF NOT EXISTS "oauth_codes" (
  "code_hash" text PRIMARY KEY,
  "grant_id" uuid NOT NULL,
  "client_id" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "code_challenge" text NOT NULL,
  "resource" text NOT NULL,
  "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "oauth_codes_grant_id_oauth_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."oauth_grants" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "oauth_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "grant_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "token_hash" text NOT NULL,
  "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "resource" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "oauth_tokens_token_hash_unique" UNIQUE ("token_hash"),
  CONSTRAINT "oauth_tokens_grant_id_oauth_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."oauth_grants" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "oauth_tokens_grant_idx" ON "oauth_tokens" ("grant_id");

CREATE TABLE IF NOT EXISTS "mcp_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "grant_id" uuid,
  "dancer_id" uuid,
  "client_id" text,
  "tool" text NOT NULL,
  "target" text,
  "profile_id" uuid,
  "input_hash" text NOT NULL,
  "result" text NOT NULL,
  "error_code" text,
  "latency_ms" integer,
  "confirm_nonce" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "mcp_audit_confirm_nonce_unique" UNIQUE ("confirm_nonce"),
  CONSTRAINT "mcp_audit_grant_id_oauth_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."oauth_grants" ("id") ON DELETE SET NULL,
  CONSTRAINT "mcp_audit_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers" ("id") ON DELETE SET NULL,
  CONSTRAINT "mcp_audit_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "mcp_audit_grant_idx" ON "mcp_audit" ("grant_id", "created_at");
CREATE INDEX IF NOT EXISTS "mcp_audit_profile_idx" ON "mcp_audit" ("profile_id", "created_at");

CREATE TABLE IF NOT EXISTS "mcp_rate_limits" (
  "key" text NOT NULL,
  "window_start" timestamp NOT NULL,
  "count" integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_rate_limits_key_window_uidx" ON "mcp_rate_limits" ("key", "window_start");

COMMIT;

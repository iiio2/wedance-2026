-- Discover deck on /my-plan: persist Yes / Skip per card so a decided card
-- never returns. Additive and idempotent. Rollback: DROP TABLE discover_swipes.
CREATE TABLE IF NOT EXISTS "discover_swipes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dancer_id" uuid NOT NULL REFERENCES "dancers" ("id") ON DELETE CASCADE,
  "target_kind" text NOT NULL,
  "target_id" text NOT NULL,
  "decision" text NOT NULL,
  "festival_slug" text,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "discover_swipes_unique" UNIQUE ("dancer_id", "target_kind", "target_id")
);

CREATE INDEX IF NOT EXISTS "discover_swipes_dancer_idx" ON "discover_swipes" ("dancer_id");

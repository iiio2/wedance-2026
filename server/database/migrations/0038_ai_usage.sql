-- AI usage log (admin): every Gemini call — what it was for, where it came
-- from, the event / flyer / person, the model, ok / refused / error, how long
-- it took, the exact tokens Gemini reported, and the cost from Google's price
-- list (shared/utils/aiPricing.ts). Shown on /admin/ai-usage.
-- Rollback: DROP TABLE IF EXISTS "ai_usage";
CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "purpose" text NOT NULL,
  "source" text,
  "model" text NOT NULL,
  "model_version" text,
  "status" text NOT NULL,
  "duration_ms" integer NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_text_tokens" integer DEFAULT 0 NOT NULL,
  "output_image_tokens" integer DEFAULT 0 NOT NULL,
  "thought_tokens" integer DEFAULT 0 NOT NULL,
  "cost_usd" numeric(12, 6),
  "event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL,
  "flyer_id" uuid REFERENCES "event_flyers"("id") ON DELETE SET NULL,
  "dancer_id" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "error" text
);
CREATE INDEX IF NOT EXISTS "ai_usage_created_idx" ON "ai_usage" ("created_at");
CREATE INDEX IF NOT EXISTS "ai_usage_purpose_idx" ON "ai_usage" ("purpose");

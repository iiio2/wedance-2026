-- Event flyers (business mode): the agenda and per-artist flyer photo on events,
-- a profile's saved looks, and every flyer painted for an event.
-- Additive: two nullable-with-default columns on events, two new tables.
-- Rollback: DROP TABLE IF EXISTS "event_flyers", "brand_looks";
--           ALTER TABLE "events" DROP COLUMN IF EXISTS "agenda", DROP COLUMN IF EXISTS "flyer_options";
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "agenda" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "flyer_options" jsonb DEFAULT '{}'::jsonb NOT NULL;

CREATE TABLE IF NOT EXISTS "brand_looks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "palette" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "references" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source" text,
  "created_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "brand_looks_profile_idx" ON "brand_looks" USING btree ("profile_id");

CREATE TABLE IF NOT EXISTS "event_flyers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "batch_id" uuid NOT NULL,
  "look_id" uuid REFERENCES "brand_looks"("id") ON DELETE SET NULL,
  "look" jsonb NOT NULL,
  "mode" text DEFAULT 'paint' NOT NULL,
  "base_flyer_id" uuid,
  "status" text DEFAULT 'painting' NOT NULL,
  "url" text,
  "width" integer,
  "height" integer,
  "lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "pictured" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "prompt" text,
  "model" text,
  "check" jsonb,
  "error" text,
  "kept_at" timestamp,
  "created_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "event_flyers_event_idx" ON "event_flyers" USING btree ("event_id", "created_at");
CREATE INDEX IF NOT EXISTS "event_flyers_batch_idx" ON "event_flyers" USING btree ("batch_id");

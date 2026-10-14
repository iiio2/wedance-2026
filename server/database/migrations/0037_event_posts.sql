-- Content plan (business mode): an event's posts — the announcement flyer, one
-- per artist, the line-up poster, passes, programme, countdown, last tickets,
-- thank you. Each post has its own flyer versions (event_flyers.post_id), one
-- kept per post, a due date and a status. Existing flyers become each event's
-- announcement post (nothing repainted).
-- Rollback: ALTER TABLE "event_flyers" DROP COLUMN IF EXISTS "post_id"; DROP TABLE IF EXISTS "event_posts";
CREATE TABLE IF NOT EXISTS "event_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "subject" text,
  "due_on" date,
  "format" text DEFAULT 'post' NOT NULL,
  "status" text DEFAULT 'planned' NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "caption" jsonb,
  "created_by" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "event_posts_event_idx" ON "event_posts" ("event_id");
-- caption: the post's Instagram caption (the announcement's stays events.caption).
ALTER TABLE "event_posts" ADD COLUMN IF NOT EXISTS "caption" jsonb;
ALTER TABLE "event_flyers" ADD COLUMN IF NOT EXISTS "post_id" uuid REFERENCES "event_posts"("id") ON DELETE CASCADE;
INSERT INTO "event_posts" ("event_id", "kind", "format")
  SELECT DISTINCT f."event_id", 'announcement', 'story' FROM "event_flyers" f
  WHERE NOT EXISTS (SELECT 1 FROM "event_posts" p WHERE p."event_id" = f."event_id" AND p."kind" = 'announcement');
UPDATE "event_flyers" f SET "post_id" = p."id" FROM "event_posts" p
  WHERE p."event_id" = f."event_id" AND p."kind" = 'announcement' AND f."post_id" IS NULL;

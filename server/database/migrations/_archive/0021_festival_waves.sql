-- RAZ-82: festival waves — lightweight pre-event social gesture.
--
-- A "wave" lets a dancer express interest in meeting another attendee
-- at a specific festival. Mutual waves = "festival friends" — the
-- connection that makes arriving alone feel like arriving with friends.
CREATE TABLE IF NOT EXISTS "festival_waves" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "festival_slug" text NOT NULL,
  "dancer_id" uuid NOT NULL REFERENCES "dancers"("id"),
  "target_dancer_id" uuid NOT NULL REFERENCES "dancers"("id"),
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "festival_wave_unique" UNIQUE("festival_slug", "dancer_id", "target_dancer_id")
);

CREATE INDEX IF NOT EXISTS "festival_waves_target_idx" ON "festival_waves" ("festival_slug", "target_dancer_id");

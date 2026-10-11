CREATE TABLE IF NOT EXISTS "artist_follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dancer_id" uuid NOT NULL REFERENCES "dancers"("id"),
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id"),
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "artist_follows_dancer_profile" UNIQUE("dancer_id","profile_id")
);

CREATE INDEX IF NOT EXISTS "artist_follows_profile_idx" ON "artist_follows" ("profile_id");

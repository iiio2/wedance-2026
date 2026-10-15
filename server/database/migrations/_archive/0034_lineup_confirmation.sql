-- Line-up confirmation (business mode): an artist's answer on their invite for
-- an event — whether they're in, whether their programme is right (or a note
-- saying what's wrong), and their OK for the posts that use their photo.
-- Until they confirm, the public page shows them as "to be confirmed".
-- Additive: columns with defaults or nullable.
-- Rollback: ALTER TABLE "profile_invites" DROP COLUMN IF EXISTS "status", DROP COLUMN IF EXISTS "responded_at",
--           DROP COLUMN IF EXISTS "programme_ok", DROP COLUMN IF EXISTS "programme_note", DROP COLUMN IF EXISTS "posts_ok_at", DROP COLUMN IF EXISTS "message";
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'invited' NOT NULL;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "responded_at" timestamp;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "programme_ok" boolean;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "programme_note" text;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "posts_ok_at" timestamp;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "message" text;

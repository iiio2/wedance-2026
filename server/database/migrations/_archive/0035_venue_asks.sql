-- Asking venues (business mode): the organizer's link to a venue for an event
-- uses profile_invites like the artist link, with `kind` = 'venue'. It carries
-- what the organizer asks for (guests, needs, a note), the venue's answer
-- (status: confirmed = can host, proposed = another date, declined = can't),
-- its terms and the other dates it offers, and the outcome once the organizer
-- books one venue (booked / elsewhere). `notified_at`: when the people who run
-- the page were last emailed about this link (artists and venues), at most daily.
-- Additive: columns with defaults or nullable.
-- Rollback: ALTER TABLE "profile_invites" DROP COLUMN IF EXISTS "kind", DROP COLUMN IF EXISTS "request",
--           DROP COLUMN IF EXISTS "terms", DROP COLUMN IF EXISTS "alternative", DROP COLUMN IF EXISTS "outcome",
--           DROP COLUMN IF EXISTS "notified_at";
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'artist' NOT NULL;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "request" jsonb;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "terms" jsonb;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "alternative" text;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "outcome" text;
ALTER TABLE "profile_invites" ADD COLUMN IF NOT EXISTS "notified_at" timestamp;

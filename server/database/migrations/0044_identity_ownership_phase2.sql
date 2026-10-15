-- RAZ-310: Phase 2 — Identity and ownership (ADR-004, ADR-005, ADR-010).
-- Steps 12–16 of the architecture migration plan.
-- Rollback: see individual DROP statements per section below.

-- =========================================================================
-- Step 12 · Handle registry
-- Rollback: DROP TABLE IF EXISTS "handles"; DROP EXTENSION IF EXISTS citext;
-- =========================================================================

-- Case-insensitive text for handle uniqueness ("Alosha" = "alosha").
CREATE EXTENSION IF NOT EXISTS citext;

-- One namespace: dancer handles (/u/<handle>) and profile handles (/@<handle>)
-- both resolve through this table. Exactly one FK is set per row.
CREATE TABLE IF NOT EXISTS "handles" (
  "handle" citext PRIMARY KEY,
  "dancer_id" uuid UNIQUE REFERENCES "dancers"("id") ON DELETE CASCADE,
  "profile_id" uuid UNIQUE REFERENCES "profiles"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "handles_exactly_one_target"
    CHECK (num_nonnulls("dancer_id", "profile_id") = 1)
);

-- =========================================================================
-- Step 13 · Profile memberships and claims — extend existing tables
-- Rollback: ALTER TABLE "profile_members" DROP COLUMN IF EXISTS "term_start";
--           ALTER TABLE "profile_members" DROP COLUMN IF EXISTS "term_end";
-- (moderator role removal needs a data check — don't drop without verifying)
-- =========================================================================

-- Add moderator term boundaries to profile_members (owner/editor rows leave
-- these null). election.close grants a moderator membership with the term.
ALTER TABLE "profile_members" ADD COLUMN IF NOT EXISTS "term_start" date;
ALTER TABLE "profile_members" ADD COLUMN IF NOT EXISTS "term_end" date;

-- =========================================================================
-- Step 14 · Artist roles, affiliations, venue address; one artist model
-- Rollback: DROP TABLE IF EXISTS "profile_affiliations";
--           ALTER TABLE "profiles" DROP COLUMN IF EXISTS "roles";
--           ALTER TABLE "gigs" DROP COLUMN IF EXISTS "poster_profile_id";
-- =========================================================================

-- Profile roles: teacher, dj, performer, mc, band, photographer, videographer,
-- school, promoter, festival, community. GIN for "all DJs in Munich".
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "roles" jsonb NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS "profiles_roles_gin" ON "profiles" USING gin ("roles");

-- Artist ↔ organiser affiliations.
CREATE TABLE IF NOT EXISTS "profile_affiliations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "artist_profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "organizer_profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "profile_affiliations_pair"
    UNIQUE ("artist_profile_id", "organizer_profile_id"),
  CONSTRAINT "profile_affiliations_kind_check"
    CHECK ("kind" IN ('teaches_at', 'resident', 'member')),
  CONSTRAINT "profile_affiliations_not_self"
    CHECK ("artist_profile_id" <> "organizer_profile_id")
);

CREATE INDEX IF NOT EXISTS "profile_affiliations_organizer_idx"
  ON "profile_affiliations" ("organizer_profile_id");

-- Link a gig to the professional profile who posted it.
ALTER TABLE "gigs" ADD COLUMN IF NOT EXISTS "poster_profile_id" uuid
  REFERENCES "profiles"("id") ON DELETE SET NULL;

-- =========================================================================
-- Step 15 · One follow graph
-- Rollback: ALTER TABLE "follows" RENAME TO "artist_follows";
--           ALTER TABLE "follows" DROP COLUMN IF EXISTS "target_dancer_id";
--           DROP TABLE IF EXISTS "legacy_follows";
--           (restore constraints and indexes manually)
-- =========================================================================

-- Rename artist_follows → follows.
ALTER TABLE IF EXISTS "artist_follows" RENAME TO "follows";

-- Add dancer→dancer follow target (RAZ-319 decided: mutual = friends).
ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "target_dancer_id" uuid
  REFERENCES "dancers"("id");

-- Make profile_id nullable (was implicitly NOT NULL via the old schema).
-- Drizzle may not enforce NOT NULL explicitly; check and alter if needed.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'follows' AND column_name = 'profile_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "follows" ALTER COLUMN "profile_id" DROP NOT NULL;
  END IF;
END $$;

-- Exactly one of profile_id / target_dancer_id must be set.
ALTER TABLE "follows" ADD CONSTRAINT "follows_exactly_one_target"
  CHECK (num_nonnulls("profile_id", "target_dancer_id") = 1);

-- Unique constraint for dancer→dancer follows.
CREATE UNIQUE INDEX IF NOT EXISTS "follows_dancer_dancer_uidx"
  ON "follows" ("dancer_id", "target_dancer_id")
  WHERE "target_dancer_id" IS NOT NULL;

-- Index for looking up who follows a dancer.
CREATE INDEX IF NOT EXISTS "follows_target_dancer_idx"
  ON "follows" ("target_dancer_id");

-- Rename old constraints/indexes for clarity (idempotent via IF EXISTS).
ALTER INDEX IF EXISTS "artist_follows_dancer_profile" RENAME TO "follows_dancer_profile";
ALTER INDEX IF EXISTS "artist_follows_profile_idx" RENAME TO "follows_profile_idx";

-- Legacy follows from v4 that can't be resolved to a profile or dancer.
CREATE TABLE IF NOT EXISTS "legacy_follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dancer_id" uuid NOT NULL REFERENCES "dancers"("id"),
  "target_username" text NOT NULL,
  "source" text NOT NULL DEFAULT 'v4',
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "legacy_follows_dancer_target"
    UNIQUE ("dancer_id", "target_username")
);

-- =========================================================================
-- Step 16 · Inbound requests and delivery outbox
-- Rollback: DROP TABLE IF EXISTS "deliveries";
--           DROP TABLE IF EXISTS "inbound_requests";
--           ALTER TABLE "booking_requests" DROP COLUMN IF EXISTS "notified_at";
-- =========================================================================

-- All public-facing requests stored first, delivered to sinks by outbox.
CREATE TABLE IF NOT EXISTS "inbound_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" text NOT NULL,
  "status" text NOT NULL DEFAULT 'new',
  "dancer_id" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "email" text,
  "name" text,
  "event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL,
  "profile_id" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "gig_id" uuid REFERENCES "gigs"("id") ON DELETE SET NULL,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "inbound_requests_kind_check"
    CHECK ("kind" IN ('event_inquiry', 'problem_report', 'gig_application', 'contact')),
  CONSTRAINT "inbound_requests_status_check"
    CHECK ("status" IN ('new', 'triaged', 'in_progress', 'answered', 'closed', 'spam'))
);

CREATE INDEX IF NOT EXISTS "inbound_requests_kind_status_idx"
  ON "inbound_requests" ("kind", "status");
CREATE INDEX IF NOT EXISTS "inbound_requests_profile_idx"
  ON "inbound_requests" ("profile_id");
CREATE INDEX IF NOT EXISTS "inbound_requests_created_idx"
  ON "inbound_requests" ("created_at");

-- Delivery outbox: Linear issues, emails, push notifications.
CREATE TABLE IF NOT EXISTS "deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subject_type" text NOT NULL,
  "subject_id" uuid NOT NULL,
  "channel" text NOT NULL,
  "target" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "external_ref" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "delivered_at" timestamp,
  CONSTRAINT "deliveries_channel_check"
    CHECK ("channel" IN ('linear', 'email')),
  CONSTRAINT "deliveries_status_check"
    CHECK ("status" IN ('pending', 'delivered', 'failed'))
);

CREATE INDEX IF NOT EXISTS "deliveries_status_idx"
  ON "deliveries" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "deliveries_subject_idx"
  ON "deliveries" ("subject_type", "subject_id");

-- Booking requests: when the delivery outbox last notified venue members.
ALTER TABLE "booking_requests"
  ADD COLUMN IF NOT EXISTS "notified_at" timestamp;

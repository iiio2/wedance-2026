-- O-008 PR 2: per-event privacy opt-in for the public attendee roster.
--
-- Adds `roster_visibility` to `festival_signups`. Three levels:
--   'public_full'    — name + city + photo (full opt-in)
--   'public_minimal' — name + city only (default — privacy-conservative)
--   'hidden'         — not listed individually; counted in aggregates only
--
-- Default is 'public_minimal' so existing rows are listed conservatively
-- without a separate backfill step.
ALTER TABLE "festival_signups" ADD COLUMN "roster_visibility" text DEFAULT 'public_minimal' NOT NULL;

-- Booking inquiries: anyone can ask to book an artist or a venue from their
-- page (/@handle, or the /@handle/book link they put on their own site), with
-- or without a WeDance account. The page's team gets an email and a "Needs
-- you" item; they answer the asker by email and mark it answered or declined.
-- The asker's email is only shown to the page's team.
-- Rollback: DROP TABLE IF EXISTS "booking_inquiries";
CREATE TABLE IF NOT EXISTS "booking_inquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "requester_id" uuid REFERENCES "dancers"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "organization" text,
  "what" text NOT NULL,
  "event_date" date,
  "city" text,
  "guests" integer,
  "budget" text,
  "message" text NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "notified" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "answered_at" timestamp
);
CREATE INDEX IF NOT EXISTS "booking_inquiries_profile_idx" ON "booking_inquiries" ("profile_id", "created_at");
CREATE INDEX IF NOT EXISTS "booking_inquiries_email_idx" ON "booking_inquiries" ("email", "created_at");

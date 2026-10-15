-- RAZ-323: Require email verification before ticket claiming.
-- Adds email_verified_at to dancers so the claim flow can distinguish
-- accounts that proved email ownership (magic-link) from those that
-- registered with an unverified email (password signup).
ALTER TABLE "dancers" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;

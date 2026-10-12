-- Add optional contact link (WhatsApp/Telegram) to ride shares.
-- Nullable: existing rows get NULL (no contact link).
-- Rollback: ALTER TABLE "festival_ride_shares" DROP COLUMN IF EXISTS "contact_link";
ALTER TABLE "festival_ride_shares" ADD COLUMN IF NOT EXISTS "contact_link" text;

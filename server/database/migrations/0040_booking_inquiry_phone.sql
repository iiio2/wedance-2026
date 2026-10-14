-- Booking inquiries: an optional phone / WhatsApp number from the asker, to
-- speed up the talk. Only the page's team sees it, like the email.
-- Rollback: ALTER TABLE "booking_inquiries" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "booking_inquiries" ADD COLUMN IF NOT EXISTS "phone" text;

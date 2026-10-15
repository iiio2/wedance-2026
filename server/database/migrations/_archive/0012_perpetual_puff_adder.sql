ALTER TABLE "booking_requests" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "event_type" text;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "styles" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "start_time" text;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "end_time" text;
ALTER TABLE "profiles" ADD COLUMN "venue_type" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "map_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "guidelines" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "booking_model" text DEFAULT 'commercial' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "moderator_name" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "moderator_handle" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "moderator_since" integer;
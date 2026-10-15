CREATE TABLE "bookable_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer,
	"floor_type" text,
	"price_info" text,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "booking_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"requester_id" uuid,
	"requester_email" text NOT NULL,
	"requester_name" text,
	"event_date" date,
	"headcount" integer,
	"message" text,
	"terms_accepted_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"city_slug" text,
	"photo" text,
	"bio" text,
	"styles" json DEFAULT '[]'::json,
	"address" text,
	"floor_type" text,
	"socials" json DEFAULT '[]'::json,
	"claimed" boolean DEFAULT false,
	"status" text DEFAULT 'visible' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "bookable_spaces" ADD CONSTRAINT "bookable_spaces_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_space_id_bookable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."bookable_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_requester_id_dancers_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;
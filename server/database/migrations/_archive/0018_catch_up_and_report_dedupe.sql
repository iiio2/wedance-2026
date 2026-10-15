CREATE TABLE "availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "city_battle_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_month" text NOT NULL,
	"winner_city_slug" text NOT NULL,
	"loser_city_slug" text NOT NULL,
	"winner_video_id" uuid,
	"loser_video_id" uuid,
	"voter_session_id" text NOT NULL,
	"voter_dancer_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_group_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "community_group_reports_group_dancer" UNIQUE("group_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text,
	"name" text,
	"type" text,
	"description" text DEFAULT '',
	"cover" text DEFAULT '',
	"start_date" timestamp,
	"end_date" timestamp,
	"is_festival" boolean DEFAULT false,
	"ticket_url" text,
	"price" text DEFAULT '',
	"city" text,
	"venue_username" text,
	"organizer_username" text,
	"styles" jsonb DEFAULT '[]'::jsonb,
	"archived" boolean DEFAULT true NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"source_ref" jsonb,
	"created_at" timestamp DEFAULT now(),
	"source" text,
	"source_id" text,
	"city_slug" text,
	"country" text,
	"timezone" text,
	"venue_name" text,
	"venue_address" text,
	"venue_lat" double precision,
	"venue_lng" double precision,
	"organizer_name" text,
	"link" text,
	"series_id" text,
	"artists" jsonb DEFAULT '[]'::jsonb,
	"synced_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "festival_ride_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"festival_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"type" text NOT NULL,
	"origin_city" text NOT NULL,
	"date" date NOT NULL,
	"seats_available" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "festival_ride_dancer_unique" UNIQUE("festival_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "festival_roommate_lookups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"festival_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "festival_roommate_dancer_unique" UNIQUE("festival_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "gigs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"poster_name" text NOT NULL,
	"poster_type" text NOT NULL,
	"location" text NOT NULL,
	"styles" json DEFAULT '[]'::json,
	"when" text NOT NULL,
	"compensation" text NOT NULL,
	"deadline" date,
	"contact_email" text NOT NULL,
	"contact_url" text,
	"entity_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	"dancer_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hangout_rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hangout_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "hangout_rsvp_unique" UNIQUE("hangout_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "hangouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"time" text NOT NULL,
	"venue" text,
	"host" text,
	"city_slug" text NOT NULL,
	"people_count" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"dancer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dancer_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "plan_items_dancer_item" UNIQUE("dancer_id","item_type","item_id")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"festival_id" uuid NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referee_id" uuid NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"stripe_session_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"referrer_credit_cents" integer DEFAULT 0 NOT NULL,
	"referrer_credit_applied_session_id" text,
	CONSTRAINT "referral_festival_referee_unique" UNIQUE("festival_id","referee_id")
);
--> statement-breakpoint
ALTER TABLE "community_groups" ADD COLUMN "report_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "dancers" ADD COLUMN "dance_levels" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "festivals" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "festivals" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "festivals" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "festivals" ADD COLUMN "styles" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "festivals" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "festivals" ADD COLUMN "accent_color" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "source_ref" jsonb;--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_space_id_bookable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."bookable_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_battle_votes" ADD CONSTRAINT "city_battle_votes_voter_dancer_id_dancers_id_fk" FOREIGN KEY ("voter_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_group_reports" ADD CONSTRAINT "community_group_reports_group_id_community_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."community_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_group_reports" ADD CONSTRAINT "community_group_reports_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_ride_shares" ADD CONSTRAINT "festival_ride_shares_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_ride_shares" ADD CONSTRAINT "festival_ride_shares_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_roommate_lookups" ADD CONSTRAINT "festival_roommate_lookups_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_roommate_lookups" ADD CONSTRAINT "festival_roommate_lookups_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gigs" ADD CONSTRAINT "gigs_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangout_rsvps" ADD CONSTRAINT "hangout_rsvps_hangout_id_hangouts_id_fk" FOREIGN KEY ("hangout_id") REFERENCES "public"."hangouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangout_rsvps" ADD CONSTRAINT "hangout_rsvps_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangouts" ADD CONSTRAINT "hangouts_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_dancers_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_dancers_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_slots_space_idx" ON "availability_slots" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "city_battle_votes_session_idx" ON "city_battle_votes" USING btree ("voter_session_id","competition_month");--> statement-breakpoint
CREATE INDEX "city_battle_votes_month_idx" ON "city_battle_votes" USING btree ("competition_month");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uidx" ON "events" USING btree ("slug") WHERE "events"."slug" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "events_archived_idx" ON "events" USING btree ("archived");--> statement-breakpoint
CREATE UNIQUE INDEX "events_source_uidx" ON "events" USING btree ("source","source_id") WHERE "events"."source_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "events_city_start_idx" ON "events" USING btree ("city_slug","start_date");--> statement-breakpoint
CREATE INDEX "events_venue_username_idx" ON "events" USING btree ("venue_username");--> statement-breakpoint
CREATE INDEX "events_organizer_username_idx" ON "events" USING btree ("organizer_username");--> statement-breakpoint
CREATE INDEX "plan_items_dancer_idx" ON "plan_items" USING btree ("dancer_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id");
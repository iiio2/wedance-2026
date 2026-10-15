CREATE TABLE "city_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_slug" text NOT NULL,
	"dancer_id" uuid,
	"submitted_by_email" text NOT NULL,
	"title" text NOT NULL,
	"video_url" text NOT NULL,
	"thumbnail_url" text,
	"dance_style" text,
	"competition_month" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"elo_score" integer DEFAULT 1500 NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "giveaway_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"giveaway_id" uuid NOT NULL,
	"dancer_id" uuid,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "giveaway_entry_email_unique" UNIQUE("giveaway_id","email")
);
--> statement-breakpoint
CREATE TABLE "giveaways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_slug" text NOT NULL,
	"sponsor_name" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"prize_description" text NOT NULL,
	"cta_url" text NOT NULL,
	"image_url" text,
	"terms_url" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "video_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_slug" text NOT NULL,
	"winner_video_id" uuid NOT NULL,
	"loser_video_id" uuid NOT NULL,
	"voter_session_id" text NOT NULL,
	"voter_dancer_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "city_videos" ADD CONSTRAINT "city_videos_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_votes" ADD CONSTRAINT "video_votes_winner_video_id_city_videos_id_fk" FOREIGN KEY ("winner_video_id") REFERENCES "public"."city_videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_votes" ADD CONSTRAINT "video_votes_loser_video_id_city_videos_id_fk" FOREIGN KEY ("loser_video_id") REFERENCES "public"."city_videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_votes" ADD CONSTRAINT "video_votes_voter_dancer_id_dancers_id_fk" FOREIGN KEY ("voter_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_votes_session_idx" ON "video_votes" USING btree ("voter_session_id","city_slug");
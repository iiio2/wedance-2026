CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"purpose" text NOT NULL,
	"source" text,
	"model" text NOT NULL,
	"model_version" text,
	"status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_text_tokens" integer DEFAULT 0 NOT NULL,
	"output_image_tokens" integer DEFAULT 0 NOT NULL,
	"thought_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6),
	"event_id" uuid,
	"flyer_id" uuid,
	"dancer_id" uuid,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"dancer_id" uuid,
	"buyer_email" text,
	"status" text NOT NULL,
	"source" text DEFAULT 'click' NOT NULL,
	"order_id" uuid,
	"visibility" text DEFAULT 'hidden' NOT NULL,
	"partner_status" text,
	"travel_booked_at" timestamp,
	"stay_booked_at" timestamp,
	"vacation_booked_at" timestamp,
	"checked_in_at" timestamp,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "attendances_event_dancer" UNIQUE("event_id","dancer_id")
);
--> statement-breakpoint
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
CREATE TABLE "booking_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"requester_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
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
--> statement-breakpoint
CREATE TABLE "booking_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"organizer_id" uuid,
	"requester_id" uuid,
	"requester_email" text NOT NULL,
	"requester_name" text,
	"title" text,
	"event_type" text,
	"styles" json DEFAULT '[]'::json,
	"artists" json DEFAULT '[]'::json,
	"event_date" date,
	"start_time" text,
	"end_time" text,
	"headcount" integer,
	"message" text,
	"ticket_url" text,
	"terms_accepted_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"moderated_by_id" uuid,
	"moderated_at" timestamp,
	"moderation_note" text,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brand_looks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"palette" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_place_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"local_name" text,
	"country" text,
	"country_code" text,
	"region" text,
	"lat" double precision,
	"lng" double precision,
	"alt_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "community_group_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "community_group_reports_group_dancer" UNIQUE("group_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "community_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_slug" text NOT NULL,
	"name" text NOT NULL,
	"platform" text DEFAULT 'whatsapp' NOT NULL,
	"invite_url" text NOT NULL,
	"styles" json DEFAULT '[]'::json,
	"source" text,
	"verified" boolean DEFAULT false,
	"status" text DEFAULT 'visible' NOT NULL,
	"report_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dancer_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dancer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"target" text,
	"period_year" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dancers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"photo" text,
	"dance_styles" json DEFAULT '[]'::json,
	"dance_levels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"role" text,
	"city" text,
	"neon_auth_id" text,
	"is_admin" boolean DEFAULT false,
	"username" text,
	"old_usernames" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bio" text,
	"instagram" text,
	"youtube" text,
	"website" text,
	"profile_public" boolean DEFAULT true,
	"salt" text DEFAULT '',
	"hash" text DEFAULT '',
	"intent" text,
	"onboarded_at" timestamp,
	"magic_token" text,
	"magic_token_expires_at" timestamp,
	"email_verified_at" timestamp,
	"source_ref" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dancers_email_unique" UNIQUE("email"),
	CONSTRAINT "dancers_neon_auth_id_unique" UNIQUE("neon_auth_id"),
	CONSTRAINT "dancers_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"target" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"external_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dinner_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dinner_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dinner_id" uuid NOT NULL,
	"chat_link" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dinner_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dinner_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dinner_dancer_unique" UNIQUE("dinner_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "dinners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"festival_id" uuid NOT NULL,
	"day" text NOT NULL,
	"date" date,
	"time_slot" text NOT NULL,
	"restaurant" text,
	"restaurant_address" text,
	"reveal_date" date,
	"max_size" integer DEFAULT 6 NOT NULL,
	CONSTRAINT "dinner_festival_day_time" UNIQUE("festival_id","day","time_slot")
);
--> statement-breakpoint
CREATE TABLE "election_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"guidelines" text NOT NULL,
	"statement" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "election_candidates_unique" UNIQUE("election_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "election_vote_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid NOT NULL,
	"voter_dancer_id" uuid NOT NULL,
	"from_candidate_id" uuid,
	"to_candidate_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "election_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid NOT NULL,
	"voter_dancer_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "election_votes_unique" UNIQUE("election_id","voter_dancer_id")
);
--> statement-breakpoint
CREATE TABLE "event_flyers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"post_id" uuid,
	"batch_id" uuid NOT NULL,
	"look_id" uuid,
	"look" jsonb NOT NULL,
	"mode" text DEFAULT 'paint' NOT NULL,
	"base_flyer_id" uuid,
	"status" text DEFAULT 'painting' NOT NULL,
	"url" text,
	"width" integer,
	"height" integer,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pictured" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"prompt" text,
	"model" text,
	"check" jsonb,
	"error" text,
	"kept_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject" text,
	"due_on" date,
	"format" text DEFAULT 'post' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"caption" jsonb,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"updated_at" timestamp DEFAULT now(),
	"host_profile_id" uuid,
	"agenda" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flyer_options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"caption" jsonb,
	"edited_at" timestamp,
	"edited_by" uuid,
	"festival" jsonb
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
	"contact_link" text,
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
CREATE TABLE "festival_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"festival_id" uuid NOT NULL,
	"dancer_id" uuid,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"stripe_session_id" text,
	"verified_ticket_holder" boolean DEFAULT false NOT NULL,
	"tickettailor_order_id" text,
	"tickettailor_buyer_email" text,
	"verified_at" timestamp,
	"roster_visibility" text DEFAULT 'public_minimal' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "festival_signups_tickettailor_order_id_unique" UNIQUE("tickettailor_order_id"),
	CONSTRAINT "festival_dancer_unique" UNIQUE("festival_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "festival_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text,
	"name" text,
	"submitted_by_id" uuid,
	"submitted_by_email" text,
	"payload" json NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "festival_waves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"festival_slug" text NOT NULL,
	"dancer_id" uuid NOT NULL,
	"target_dancer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "festival_wave_unique" UNIQUE("festival_slug","dancer_id","target_dancer_id")
);
--> statement-breakpoint
CREATE TABLE "festivals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"max_free_spots" integer DEFAULT 10 NOT NULL,
	"stripe_payment_link" text,
	"ticket_url" text,
	"city" text,
	"country" text,
	"description" text,
	"styles" json DEFAULT '[]'::json,
	"logo" text,
	"accent_color" text,
	"early_bird_deadline" date,
	"early_bird_offer_name" text,
	CONSTRAINT "festivals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dancer_id" uuid NOT NULL,
	"profile_id" uuid,
	"target_dancer_id" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "follows_dancer_profile" UNIQUE("dancer_id","profile_id"),
	CONSTRAINT "follows_dancer_dancer" UNIQUE("dancer_id","target_dancer_id"),
	CONSTRAINT "follows_exactly_one_target" CHECK (num_nonnulls("follows"."profile_id", "follows"."target_dancer_id") = 1)
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
	"poster_profile_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "guideline_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"election_id" uuid,
	"moderator_dancer_id" uuid,
	"guidelines" text NOT NULL,
	"term_start" date,
	"term_end" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "handles" (
	"handle" text PRIMARY KEY NOT NULL,
	"dancer_id" uuid,
	"profile_id" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "handles_dancer_id_unique" UNIQUE("dancer_id"),
	CONSTRAINT "handles_profile_id_unique" UNIQUE("profile_id"),
	CONSTRAINT "handles_exactly_one_target" CHECK (num_nonnulls("handles"."dancer_id", "handles"."profile_id") = 1)
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
CREATE TABLE "inbound_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"dancer_id" uuid,
	"email" text,
	"name" text,
	"event_id" uuid,
	"profile_id" uuid,
	"gig_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legacy_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dancer_id" uuid NOT NULL,
	"target_username" text NOT NULL,
	"source" text DEFAULT 'v4' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "legacy_follows_dancer_target" UNIQUE("dancer_id","target_username")
);
--> statement-breakpoint
CREATE TABLE "moderator_elections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" text DEFAULT 'nominations' NOT NULL,
	"term_start" date,
	"term_end" date,
	"nominations_open_at" timestamp DEFAULT now(),
	"voting_open_at" timestamp,
	"closes_at" timestamp,
	"closed_at" timestamp,
	"winner_candidate_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "network_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"other_profile_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "network_links_pair" UNIQUE("profile_id","other_profile_id")
);
--> statement-breakpoint
CREATE TABLE "organizer_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organizer_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dancer_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_id" text NOT NULL,
	"metadata" jsonb,
	"share_going" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "plan_items_dancer_item" UNIQUE("dancer_id","item_type","item_id")
);
--> statement-breakpoint
CREATE TABLE "profile_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"actor_id" uuid,
	"subject_id" uuid,
	"action" text NOT NULL,
	"role" text,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profile_affiliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_profile_id" uuid NOT NULL,
	"organizer_profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "profile_affiliations_pair" UNIQUE("artist_profile_id","organizer_profile_id")
);
--> statement-breakpoint
CREATE TABLE "profile_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"kind" text DEFAULT 'claim' NOT NULL,
	"requested_role" text DEFAULT 'owner' NOT NULL,
	"title" text,
	"decided_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"decided_at" timestamp,
	CONSTRAINT "profile_claims_profile_dancer" UNIQUE("profile_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "profile_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"event_id" uuid,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp,
	"status" text DEFAULT 'invited' NOT NULL,
	"responded_at" timestamp,
	"programme_ok" boolean,
	"programme_note" text,
	"posts_ok_at" timestamp,
	"message" text,
	"kind" text DEFAULT 'artist' NOT NULL,
	"request" jsonb,
	"terms" jsonb,
	"alternative" text,
	"outcome" text,
	"notified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "profile_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"title" text,
	"added_by" uuid,
	"term_start" date,
	"term_end" date,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "profile_members_profile_dancer" UNIQUE("profile_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "profile_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"event_id" uuid,
	"suggested_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp,
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
	"languages" json DEFAULT '[]'::json,
	"address" text,
	"floor_type" text,
	"venue_type" text,
	"map_url" text,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity" integer,
	"opening_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"floor_plan" text,
	"contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"guidelines" text,
	"booking_model" text DEFAULT 'commercial' NOT NULL,
	"moderator_name" text,
	"moderator_handle" text,
	"moderator_since" integer,
	"socials" json DEFAULT '[]'::json,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"videos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"claimed" boolean DEFAULT false,
	"status" text DEFAULT 'visible' NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"source_ref" jsonb,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "recommendation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_slug" text NOT NULL,
	"asker_id" uuid NOT NULL,
	"question" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_slug" text NOT NULL,
	"target_name" text,
	"city_slug" text,
	"dancer_id" uuid NOT NULL,
	"reviewer_name" text,
	"reviewer_username" text,
	"rating" integer NOT NULL,
	"text" text,
	"source" text DEFAULT 'review' NOT NULL,
	"status" text DEFAULT 'visible' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "review_target_dancer_unique" UNIQUE("target_type","target_slug","dancer_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dancer_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
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
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_flyer_id_event_flyers_id_fk" FOREIGN KEY ("flyer_id") REFERENCES "public"."event_flyers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_space_id_bookable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."bookable_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookable_spaces" ADD CONSTRAINT "bookable_spaces_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_inquiries" ADD CONSTRAINT "booking_inquiries_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_inquiries" ADD CONSTRAINT "booking_inquiries_requester_id_dancers_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_space_id_bookable_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."bookable_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_organizer_id_profiles_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_requester_id_dancers_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_moderated_by_id_dancers_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_looks" ADD CONSTRAINT "brand_looks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_looks" ADD CONSTRAINT "brand_looks_created_by_dancers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_battle_votes" ADD CONSTRAINT "city_battle_votes_voter_dancer_id_dancers_id_fk" FOREIGN KEY ("voter_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_videos" ADD CONSTRAINT "city_videos_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_group_reports" ADD CONSTRAINT "community_group_reports_group_id_community_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."community_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_group_reports" ADD CONSTRAINT "community_group_reports_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dancer_goals" ADD CONSTRAINT "dancer_goals_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_group_members" ADD CONSTRAINT "dinner_group_members_group_id_dinner_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."dinner_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_group_members" ADD CONSTRAINT "dinner_group_members_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_groups" ADD CONSTRAINT "dinner_groups_dinner_id_dinners_id_fk" FOREIGN KEY ("dinner_id") REFERENCES "public"."dinners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_signups" ADD CONSTRAINT "dinner_signups_dinner_id_dinners_id_fk" FOREIGN KEY ("dinner_id") REFERENCES "public"."dinners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_signups" ADD CONSTRAINT "dinner_signups_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinners" ADD CONSTRAINT "dinners_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_election_id_moderator_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."moderator_elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_vote_history" ADD CONSTRAINT "election_vote_history_election_id_moderator_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."moderator_elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_vote_history" ADD CONSTRAINT "election_vote_history_voter_dancer_id_dancers_id_fk" FOREIGN KEY ("voter_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_election_id_moderator_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."moderator_elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_voter_dancer_id_dancers_id_fk" FOREIGN KEY ("voter_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_candidate_id_election_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."election_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_flyers" ADD CONSTRAINT "event_flyers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_flyers" ADD CONSTRAINT "event_flyers_post_id_event_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."event_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_flyers" ADD CONSTRAINT "event_flyers_look_id_brand_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."brand_looks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_flyers" ADD CONSTRAINT "event_flyers_created_by_dancers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_posts" ADD CONSTRAINT "event_posts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_posts" ADD CONSTRAINT "event_posts_created_by_dancers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_profile_id_profiles_id_fk" FOREIGN KEY ("host_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_edited_by_dancers_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_ride_shares" ADD CONSTRAINT "festival_ride_shares_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_ride_shares" ADD CONSTRAINT "festival_ride_shares_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_roommate_lookups" ADD CONSTRAINT "festival_roommate_lookups_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_roommate_lookups" ADD CONSTRAINT "festival_roommate_lookups_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_signups" ADD CONSTRAINT "festival_signups_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_signups" ADD CONSTRAINT "festival_signups_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_submissions" ADD CONSTRAINT "festival_submissions_submitted_by_id_dancers_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_waves" ADD CONSTRAINT "festival_waves_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_waves" ADD CONSTRAINT "festival_waves_target_dancer_id_dancers_id_fk" FOREIGN KEY ("target_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_target_dancer_id_dancers_id_fk" FOREIGN KEY ("target_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gigs" ADD CONSTRAINT "gigs_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gigs" ADD CONSTRAINT "gigs_poster_profile_id_profiles_id_fk" FOREIGN KEY ("poster_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guideline_versions" ADD CONSTRAINT "guideline_versions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guideline_versions" ADD CONSTRAINT "guideline_versions_election_id_moderator_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."moderator_elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guideline_versions" ADD CONSTRAINT "guideline_versions_moderator_dancer_id_dancers_id_fk" FOREIGN KEY ("moderator_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handles" ADD CONSTRAINT "handles_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handles" ADD CONSTRAINT "handles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangout_rsvps" ADD CONSTRAINT "hangout_rsvps_hangout_id_hangouts_id_fk" FOREIGN KEY ("hangout_id") REFERENCES "public"."hangouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangout_rsvps" ADD CONSTRAINT "hangout_rsvps_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangouts" ADD CONSTRAINT "hangouts_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_requests" ADD CONSTRAINT "inbound_requests_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_requests" ADD CONSTRAINT "inbound_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_requests" ADD CONSTRAINT "inbound_requests_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_requests" ADD CONSTRAINT "inbound_requests_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_follows" ADD CONSTRAINT "legacy_follows_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_elections" ADD CONSTRAINT "moderator_elections_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_links" ADD CONSTRAINT "network_links_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_links" ADD CONSTRAINT "network_links_other_profile_id_profiles_id_fk" FOREIGN KEY ("other_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_links" ADD CONSTRAINT "network_links_created_by_dancers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_subscriptions" ADD CONSTRAINT "organizer_subscriptions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_subscriptions" ADD CONSTRAINT "organizer_subscriptions_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_access_log" ADD CONSTRAINT "profile_access_log_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_access_log" ADD CONSTRAINT "profile_access_log_actor_id_dancers_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_access_log" ADD CONSTRAINT "profile_access_log_subject_id_dancers_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_affiliations" ADD CONSTRAINT "profile_affiliations_artist_profile_id_profiles_id_fk" FOREIGN KEY ("artist_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_affiliations" ADD CONSTRAINT "profile_affiliations_organizer_profile_id_profiles_id_fk" FOREIGN KEY ("organizer_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_decided_by_dancers_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_invites" ADD CONSTRAINT "profile_invites_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_invites" ADD CONSTRAINT "profile_invites_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_invites" ADD CONSTRAINT "profile_invites_created_by_dancers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_members" ADD CONSTRAINT "profile_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_members" ADD CONSTRAINT "profile_members_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_members" ADD CONSTRAINT "profile_members_added_by_dancers_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_suggestions" ADD CONSTRAINT "profile_suggestions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_suggestions" ADD CONSTRAINT "profile_suggestions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_suggestions" ADD CONSTRAINT "profile_suggestions_suggested_by_dancers_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."dancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_asker_id_dancers_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_dancers_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_dancers_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_votes" ADD CONSTRAINT "video_votes_winner_video_id_city_videos_id_fk" FOREIGN KEY ("winner_video_id") REFERENCES "public"."city_videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_votes" ADD CONSTRAINT "video_votes_loser_video_id_city_videos_id_fk" FOREIGN KEY ("loser_video_id") REFERENCES "public"."city_videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_votes" ADD CONSTRAINT "video_votes_voter_dancer_id_dancers_id_fk" FOREIGN KEY ("voter_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_purpose_idx" ON "ai_usage" USING btree ("purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "attendances_event_email_uidx" ON "attendances" USING btree ("event_id",lower("buyer_email")) WHERE "attendances"."dancer_id" IS NULL;--> statement-breakpoint
CREATE INDEX "attendances_event_status_idx" ON "attendances" USING btree ("event_id","status") WHERE "attendances"."visibility" <> 'hidden';--> statement-breakpoint
CREATE INDEX "attendances_dancer_idx" ON "attendances" USING btree ("dancer_id");--> statement-breakpoint
CREATE INDEX "availability_slots_space_idx" ON "availability_slots" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "booking_inquiries_profile_idx" ON "booking_inquiries" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_inquiries_email_idx" ON "booking_inquiries" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "brand_looks_profile_idx" ON "brand_looks" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_google_place_id_uidx" ON "cities" USING btree ("google_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_uidx" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cities_name_lower_idx" ON "cities" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "cities_local_name_lower_idx" ON "cities" USING btree (lower("local_name"));--> statement-breakpoint
CREATE INDEX "cities_alt_names_gin_idx" ON "cities" USING gin ("alt_names");--> statement-breakpoint
CREATE INDEX "city_battle_votes_session_idx" ON "city_battle_votes" USING btree ("voter_session_id","competition_month");--> statement-breakpoint
CREATE INDEX "city_battle_votes_month_idx" ON "city_battle_votes" USING btree ("competition_month");--> statement-breakpoint
CREATE INDEX "dancer_goals_dancer_idx" ON "dancer_goals" USING btree ("dancer_id");--> statement-breakpoint
CREATE INDEX "deliveries_status_idx" ON "deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "deliveries_subject_idx" ON "deliveries" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "election_vote_history_idx" ON "election_vote_history" USING btree ("election_id","voter_dancer_id");--> statement-breakpoint
CREATE INDEX "event_flyers_event_idx" ON "event_flyers" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "event_flyers_batch_idx" ON "event_flyers" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "event_posts_event_idx" ON "event_posts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "events_host_profile_idx" ON "events" USING btree ("host_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uidx" ON "events" USING btree ("slug") WHERE "events"."slug" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "events_archived_idx" ON "events" USING btree ("archived");--> statement-breakpoint
CREATE UNIQUE INDEX "events_source_uidx" ON "events" USING btree ("source","source_id") WHERE "events"."source_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "events_city_start_idx" ON "events" USING btree ("city_slug","start_date");--> statement-breakpoint
CREATE INDEX "events_venue_username_idx" ON "events" USING btree ("venue_username");--> statement-breakpoint
CREATE INDEX "events_organizer_username_idx" ON "events" USING btree ("organizer_username");--> statement-breakpoint
CREATE INDEX "festival_waves_target_idx" ON "festival_waves" USING btree ("festival_slug","target_dancer_id");--> statement-breakpoint
CREATE INDEX "follows_profile_idx" ON "follows" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "follows_target_dancer_idx" ON "follows" USING btree ("target_dancer_id");--> statement-breakpoint
CREATE INDEX "guideline_versions_profile_idx" ON "guideline_versions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "inbound_requests_kind_status_idx" ON "inbound_requests" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "inbound_requests_profile_idx" ON "inbound_requests" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "inbound_requests_created_idx" ON "inbound_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "moderator_elections_profile_idx" ON "moderator_elections" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "network_links_profile_idx" ON "network_links" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "org_sub_profile_idx" ON "organizer_subscriptions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "org_sub_dancer_idx" ON "organizer_subscriptions" USING btree ("dancer_id");--> statement-breakpoint
CREATE INDEX "plan_items_dancer_idx" ON "plan_items" USING btree ("dancer_id");--> statement-breakpoint
CREATE INDEX "profile_access_log_profile_idx" ON "profile_access_log" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "profile_affiliations_organizer_idx" ON "profile_affiliations" USING btree ("organizer_profile_id");--> statement-breakpoint
CREATE INDEX "profile_claims_status_idx" ON "profile_claims" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_invites_token_uidx" ON "profile_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_invites_event_profile_uidx" ON "profile_invites" USING btree ("event_id","profile_id");--> statement-breakpoint
CREATE INDEX "profile_members_dancer_idx" ON "profile_members" USING btree ("dancer_id");--> statement-breakpoint
CREATE INDEX "profile_suggestions_profile_idx" ON "profile_suggestions" USING btree ("profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_suggestions_pending_uidx" ON "profile_suggestions" USING btree ("profile_id","kind","value") WHERE "profile_suggestions"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "video_votes_session_idx" ON "video_votes" USING btree ("voter_session_id","city_slug");
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
ALTER TABLE "booking_requests" ADD COLUMN "moderated_by_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "moderated_at" timestamp;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "moderation_note" text;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_election_id_moderator_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."moderator_elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_vote_history" ADD CONSTRAINT "election_vote_history_election_id_moderator_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."moderator_elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_vote_history" ADD CONSTRAINT "election_vote_history_voter_dancer_id_dancers_id_fk" FOREIGN KEY ("voter_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_election_id_moderator_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."moderator_elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_voter_dancer_id_dancers_id_fk" FOREIGN KEY ("voter_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_candidate_id_election_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."election_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guideline_versions" ADD CONSTRAINT "guideline_versions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guideline_versions" ADD CONSTRAINT "guideline_versions_election_id_moderator_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."moderator_elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guideline_versions" ADD CONSTRAINT "guideline_versions_moderator_dancer_id_dancers_id_fk" FOREIGN KEY ("moderator_dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_elections" ADD CONSTRAINT "moderator_elections_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "election_vote_history_idx" ON "election_vote_history" USING btree ("election_id","voter_dancer_id");--> statement-breakpoint
CREATE INDEX "guideline_versions_profile_idx" ON "guideline_versions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "moderator_elections_profile_idx" ON "moderator_elections" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_moderated_by_id_dancers_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;
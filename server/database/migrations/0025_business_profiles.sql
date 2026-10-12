-- Business mode: who manages an artist / venue / organizer profile, claim
-- requests for existing profiles, and a photo gallery on profiles.
-- Additive: two new tables + one column with a default; touches no existing data.
-- Rollback: DROP TABLE IF EXISTS "profile_members", "profile_claims";
--           ALTER TABLE "profiles" DROP COLUMN IF EXISTS "photos";
CREATE TABLE IF NOT EXISTS "profile_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"decided_at" timestamp,
	CONSTRAINT "profile_claims_profile_dancer" UNIQUE("profile_id","dancer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"dancer_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "profile_members_profile_dancer" UNIQUE("profile_id","dancer_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "photos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_members" ADD CONSTRAINT "profile_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_members" ADD CONSTRAINT "profile_members_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_claims_status_idx" ON "profile_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_members_dancer_idx" ON "profile_members" USING btree ("dancer_id");
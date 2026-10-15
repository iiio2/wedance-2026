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
ALTER TABLE "festival_submissions" ADD CONSTRAINT "festival_submissions_submitted_by_id_dancers_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;
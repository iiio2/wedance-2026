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
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_slug" text NOT NULL,
	"target_name" text,
	"city_slug" text,
	"dancer_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"text" text,
	"source" text DEFAULT 'review' NOT NULL,
	"status" text DEFAULT 'visible' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "review_target_dancer_unique" UNIQUE("target_type","target_slug","dancer_id")
);
--> statement-breakpoint
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_asker_id_dancers_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;
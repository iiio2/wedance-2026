CREATE TABLE "dancers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"photo" text,
	"dance_styles" json DEFAULT '[]'::json,
	"role" text,
	"city" text,
	"neon_auth_id" text,
	"is_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dancers_email_unique" UNIQUE("email"),
	CONSTRAINT "dancers_neon_auth_id_unique" UNIQUE("neon_auth_id")
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
CREATE TABLE "festivals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	CONSTRAINT "festivals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "dinner_group_members" ADD CONSTRAINT "dinner_group_members_group_id_dinner_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."dinner_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_group_members" ADD CONSTRAINT "dinner_group_members_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_groups" ADD CONSTRAINT "dinner_groups_dinner_id_dinners_id_fk" FOREIGN KEY ("dinner_id") REFERENCES "public"."dinners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_signups" ADD CONSTRAINT "dinner_signups_dinner_id_dinners_id_fk" FOREIGN KEY ("dinner_id") REFERENCES "public"."dinners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinner_signups" ADD CONSTRAINT "dinner_signups_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dinners" ADD CONSTRAINT "dinners_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;
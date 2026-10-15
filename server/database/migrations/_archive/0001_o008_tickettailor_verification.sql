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
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "festival_signups_tickettailor_order_id_unique" UNIQUE("tickettailor_order_id"),
	CONSTRAINT "festival_dancer_unique" UNIQUE("festival_id","dancer_id")
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
ALTER TABLE "dancers" ADD COLUMN "magic_token" text;--> statement-breakpoint
ALTER TABLE "dancers" ADD COLUMN "magic_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "festivals" ADD COLUMN "max_free_spots" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "festivals" ADD COLUMN "stripe_payment_link" text;--> statement-breakpoint
ALTER TABLE "festivals" ADD COLUMN "ticket_url" text;--> statement-breakpoint
ALTER TABLE "festival_signups" ADD CONSTRAINT "festival_signups_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_signups" ADD CONSTRAINT "festival_signups_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers"("id") ON DELETE no action ON UPDATE no action;
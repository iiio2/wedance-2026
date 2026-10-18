-- organizer_subscriptions (RAZ-106, Network plan) — in schema.ts since 0041, but
-- production never got the table: 0041 lives in _archive/ and 0000_baseline was
-- recorded as applied without running. Read/written by
-- server/trpc/routers/organizerSubscription.ts and server/api/stripe/webhook.post.ts.
-- Matches schema.ts exactly (column types, defaults, NOT NULLs, constraint and
-- index names as drizzle-kit generates them). Additive, idempotent.
-- Rollback: DROP TABLE IF EXISTS "organizer_subscriptions";
CREATE TABLE IF NOT EXISTS "organizer_subscriptions" (
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
  CONSTRAINT "organizer_subscriptions_stripe_subscription_id_unique" UNIQUE ("stripe_subscription_id"),
  CONSTRAINT "organizer_subscriptions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles" ("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "organizer_subscriptions_dancer_id_dancers_id_fk" FOREIGN KEY ("dancer_id") REFERENCES "public"."dancers" ("id") ON DELETE no action ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "org_sub_profile_idx" ON "organizer_subscriptions" USING btree ("profile_id");
CREATE INDEX IF NOT EXISTS "org_sub_dancer_idx" ON "organizer_subscriptions" USING btree ("dancer_id");

-- RAZ-106: organizer subscriptions (Network plan)
CREATE TABLE IF NOT EXISTS "organizer_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "dancer_id" uuid NOT NULL REFERENCES "dancers"("id"),
  "plan" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "stripe_customer_id" text,
  "stripe_subscription_id" text UNIQUE,
  "current_period_start" timestamp,
  "current_period_end" timestamp,
  "canceled_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "org_sub_profile_idx" ON "organizer_subscriptions" ("profile_id");
CREATE INDEX IF NOT EXISTS "org_sub_dancer_idx" ON "organizer_subscriptions" ("dancer_id");

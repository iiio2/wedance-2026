-- RAZ-412: WeDance as the CMS and CRM for a profile's own website.
-- profile_sites: the page's sections and words (shared/types/profileSite.ts).
-- profile_contacts: people who signed up on the site. Additive only.

CREATE TABLE IF NOT EXISTS "profile_sites" (
  "profile_id" uuid PRIMARY KEY REFERENCES "profiles" ("id") ON DELETE CASCADE,
  "content" jsonb NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" uuid REFERENCES "dancers" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "profile_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "profiles" ("id") ON DELETE CASCADE,
  "dancer_id" uuid REFERENCES "dancers" ("id") ON DELETE SET NULL,
  "email" text NOT NULL,
  "name" text,
  "phone" text,
  "locale" text,
  "source" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "note" text,
  "status" text NOT NULL DEFAULT 'subscribed',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "profile_contacts_profile_email_uidx" ON "profile_contacts" ("profile_id", lower("email"));
CREATE INDEX IF NOT EXISTS "profile_contacts_profile_idx" ON "profile_contacts" ("profile_id", "created_at");

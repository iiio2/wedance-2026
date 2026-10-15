-- Canonical cities, resolved through Google Places (legacy Places API).
-- Replaces free-text city input in <CityCombobox>: every saved city is a row
-- here, so "München", "Мюнхен", "Munique" and "munich" map to one "Munich".
-- Additive + idempotent: safe to re-run, touches no existing table.
-- Rollback: DROP TABLE IF EXISTS "cities";
CREATE TABLE IF NOT EXISTS "cities" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "cities_google_place_id_uidx" ON "cities" USING btree ("google_place_id");
CREATE UNIQUE INDEX IF NOT EXISTS "cities_slug_uidx" ON "cities" USING btree ("slug");
-- Exact-name lookups (resolve-by-name in the backfill, admin checks). Typeahead
-- matching runs in memory over the whole table (a few thousand rows at most)
-- with the same accent/case-folding rules as the client (shared/utils/citySearch.ts).
CREATE INDEX IF NOT EXISTS "cities_name_lower_idx" ON "cities" USING btree (lower("name"));
CREATE INDEX IF NOT EXISTS "cities_local_name_lower_idx" ON "cities" USING btree (lower("local_name"));
-- alt_names @> '["München"]' containment lookups.
CREATE INDEX IF NOT EXISTS "cities_alt_names_gin_idx" ON "cities" USING gin ("alt_names");

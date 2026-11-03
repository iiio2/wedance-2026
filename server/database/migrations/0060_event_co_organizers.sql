-- Co-organisers on events (#456): the other pages that run an event with its
-- organiser, each with an optional role label ("co-organiser", "host"…).
-- Stored as [{ "username": "<handle>", "role": "host" }]. Shown on the event
-- page next to the organiser and under events on each co-organiser's page.
-- Credit only: editing stays with the host profile's team.
--
-- Additive and idempotent. Applied by scripts/db-migrate.ts on the first
-- production deploy after merge.
--
-- Rollback:
--   ALTER TABLE events DROP COLUMN IF EXISTS co_organizers;

BEGIN;

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "co_organizers" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- /@handle schedules look events up by a co-organiser's handle (jsonb @>).
CREATE INDEX IF NOT EXISTS "events_co_organizers_gin" ON "events" USING gin ("co_organizers" jsonb_path_ops);

COMMIT;

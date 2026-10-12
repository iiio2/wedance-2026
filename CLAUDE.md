# WeDance 2026 — Code Repository

## Framework

@/Users/razbakov/Projects/ikigai-team/CLAUDE.md

---

Dance community platform. Nuxt 4 + tRPC + Drizzle ORM + Neon (PostgreSQL).

## Links

- **Live:** https://2026.wedance.vip
- **Vercel project:** `wedance-2026` (team: `wedance`)
- **Org governance:** `~/Orgs/WeDance/`
- **GitHub:** `razbakov/wedance-2026` — open source, **AGPL-3.0-only** (`LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`)
- **Docs (public, indexed):** https://2026.wedance.vip/docs — hub + quick start (`app/pages/docs/`),
  design system `/docs/design/**`, generated architecture `/docs/architecture/**` (ADR-000).
  Old `/design/**`, `/architecture/**`, `/styleguide` 301 there (`nuxt.config.ts` routeRules).
  Shell/nav: `app/components/docs/Shell.vue`, `app/lib/docs-nav.ts`; pages use `layout: 'docs'`.

## Structure

```
app/                  # Nuxt app (pages, components, composables)
server/               # Backend (tRPC, database, API routes)
e2e/                  # Playwright tests
public/               # Static assets
```

## Commands

- `bun install` — install deps
- `bun run dev` — dev server
- `bun run build` — production build
- `bun run test` — unit tests (vitest)
- `bun run test:e2e` — e2e tests (playwright)

## Deployment

Auto-deploys on push to `main` via Vercel + GitHub integration.

## Conventions

- All agent work delivered via PRs
- Code ownership: Engineer agent (dispatched from `~/Orgs/WeDance/`)
- Work items tracked on org work board: `~/Orgs/WeDance/03_Coordination/Work_Board.md`
- Client form validation uses **valibot**: add the form's schema to `shared/validation/forms.ts`
  (field builders in `fields.ts`, limits mirroring the tRPC zod input), then
  `const { errors, validate, fieldAttrs } = useFormValidation(schema, state)`. On submit,
  `const result = validate(); if (!result.success) return` and send `result.data`. Each input
  gets `v-bind="fieldAttrs('field', 'x-field-error')"` plus `<FieldError id="x-field-error" :message="errors.field" />`,
  so a failed submit flags every invalid field at once. `<form>`s get `novalidate`.

## Data (migrated from v4 — 2026-07-15)

Real production data lives in Neon (replacing the old mock-only state). Migrated
from wedance-v4 (Postgres) via `scripts/migrate/`, idempotent + reversible
(every row carries `source_ref`; rollback = `DELETE … WHERE source_ref IS NOT NULL`):
- **3,910 users → `dancers`** (2,339 with passwords; auth continuity verified —
  v4's Firebase-scrypt hashes verify unchanged in 2026).
- **6,426 profiles → `profiles`** (venue/artist/organizer; v4 "FanPage" → organizer).
- **9,580 events → `events`** — all `archived=true`/hidden. NOTE: the source is a
  historical snapshot (newest ~2026-04); there are **no upcoming events** in any
  source (v3 Firestore ends 2022), so "this week"/upcoming feeds have no real data
  until organizers create events going forward.
- **667 follow edges → `follows`**.
**Update 2026-10-04:** the "no upcoming events" note above is obsolete — wedance.vip
(v3 Firestore `posts`, type `event`) is actively maintained (~1,300 upcoming events,
~1,000 of them in Munich). They are mirrored into `events` by the v3 sync below.

Live DB-backed surfaces: sign-in, `/@handle` profiles, `/cities` + `/cities/[city]`,
`/artists`, `/venues`, city video vote, ask-locals, community groups, festival
submit-draft. Festivals list + my-plan/my-year remain partly mock/preview.

## Product backlog (landing-promise audit — 2026-07-16)

125 user stories derived from every landing-page promise/feature/use-case, each
linking **P-id · CUJ (journey) · JTBD · status (built/partial/not-built) · WSJF**.
Kept in sync across three surfaces:
- **Repo:** `docs/issues/<Pxxx>-*.md` (source of truth for story content; taxonomy
  in `docs/issues/_reference-cuj-jtbd.md`).
- **Linear:** team **WED** — 125 issues, 8 CUJ projects (C1–C8), label taxonomy
  (`status:*`, `cuj:C#`, `jtbd:J#`, `aud:*`, `landing-audit`), WSJF-based priority,
  cycle 1 loaded. Titles are short handles (e.g. "Who's Going"), detail in the body.
- **Sheet:** "WeDance 2026 UX" (`12YiUIcBd02hIIj2ua1w2bMFJSJSuIf8a64CQP7E60mg`) →
  "Landing Promises" tab (index + a Linear-link column per row).
Split: 43 built · 60 partial (Todo) · 22 not-built (Backlog). Biggest gap = the
flagship "see who's going / real faces" attendee roster (not built).

## wedance.vip → 2026 event sync

`bun run sync:v3-events` mirrors every **upcoming** wedance.vip event (Firestore
`posts` where `type == "event"`, `startDate >= now`, all cities) into the `events`
table. **Read-only against v3** — the only Firestore call is `:runQuery` (REST, no
firebase-admin). Code: `scripts/sync-v3-events.ts` (CLI) + `server/utils/v3EventSync.ts`
(mapping, Firestore client, upsert; unit-tested).

- **Dry-run is the default.** `--write` applies migration `0021_events_v3_sync.sql`
  (idempotent, additive) then upserts. `--json` prints a machine-readable summary.
- **Key:** `source='wedance-v3'`, `source_id=<v3 post id>`; rows go `archived=false,
  published=true`. Still-upcoming rows that v3 no longer lists → `archived=true`.
  Re-running is a no-op (reports `unchanged`). Rollback: `DELETE FROM events WHERE source='wedance-v3'`.
- **Mapping:** city = venue locality (→ 2026 `city_slug` via profiles + `city-images.json`
  altNames, e.g. München→munich); styles = v3 StyleKeys → 2026 labels (`STYLE_MAP`);
  times stored UTC + IANA `timezone`, always rendered in the event's zone
  (`shared/utils/eventTime.ts`). Festival/Congress/Weekender → `is_festival`.
- **Shown on:** `/cities/[city]` (this-week calendar, "Coming up", festivals) and
  `/events/[id]` via the `events` tRPC router.
- **Profiles (since 0022):** the same run also syncs the venues, organisers and
  artists behind those events (`server/utils/v3ProfileSync.ts`) and links each event
  (`venue_username`, `organizer_username`, `artists[]`), which feeds the city page's
  "Who's on the floor" tabs and the schedule on `/@handle`. Dedupe order — people:
  v3 profile id (`source_ref.firebaseId` from the v4 migration) → handle → name+city;
  venues: Google place id (the v4 venue-handle convention) → name+city → contained
  name → street+number → the organiser's own profile when the school hosts its
  classes → ≤75 m from a venue this sync created. Unmatched venues are created
  (address-only ones are named after the street). Claimed profiles are never
  written; other unclaimed rows only get EMPTY fields filled; rows this sync created
  (`source_ref.source='wedance-v3'`) follow v3. Only `visibility: Public` v3 profiles
  are copied, and only public fields (name, handle, photo, bio, social links, city,
  styles, venue address) — never email/phone. Rollback:
  `DELETE FROM profiles WHERE source_ref->>'source'='wedance-v3'` (after clearing the
  event links: `UPDATE events SET venue_username=NULL, artists='[]' WHERE source='wedance-v3'`).
  Display check: `bun e2e/synced-profiles.check.ts <venueHandle> <organiserHandle>`.
- **Env:** `DATABASE_URL` (target — check it before `--write`; the Vercel-pulled `.env`
  is PRODUCTION), `WEDANCE_V3_SERVICE_ACCOUNT` (JSON) or `WEDANCE_V3_SERVICE_ACCOUNT_FILE`
  (default `~/Secrets/wedance.json`).
- **Display check:** `BASE_URL=http://localhost:3000 bun e2e/synced-events.check.ts <eventId:HH:MM>…`
  (asserts no digit-only style tags / epoch numbers / timezone shifts; screenshots →
  `docs/screenshots/v3-sync/`).

### Vercel Preview environment

Preview deployments share the production `DATABASE_URL` so that DB-backed pages
(e.g. `/gigs`, `/cities/[city]`, `/@handle`) render correctly on PR previews.
There is only one Neon database — Neon branching can be added later if write
isolation becomes necessary.

### Local Postgres (never test writes against prod)

There is only one Neon database (production). For local work, restore a copy into
Docker and point the Neon HTTP driver at a local stand-in:

```
docker run -d --name wedance-2026-dev-db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=wedance -p 5441:5432 postgres:17-alpine
pg_dump "$PROD_DIRECT_URL" --no-owner --no-privileges --exclude-table-data=dancers \
  --exclude-table-data=sessions | psql postgresql://dev:dev@localhost:5441/wedance
bun run dev:db-proxy          # Neon-HTTP-compatible proxy on :4444
# .env: DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance
#       NEON_FETCH_ENDPOINT=http://localhost:4444/sql
```

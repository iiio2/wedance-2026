# Design system roadmap

Status as of 2026-10-10. Base branch: `wed-ds-phase2` (tokens, font consolidation, Button fix, `/design` shell + foundations).

## Wave 1 — done 2026-10-10 (merged in `wds-integrate`)

| # | Branch | Task | Owns |
|---|---|---|---|
| 1 | `wds-components-core` | Doc pages for Badge, Card, Dialog, Tabs, Avatar, Separator + components index; retire `/styleguide` (301 → `/design`) | `pages/design/components/*` (not button), `nuxt.config` redirect |
| 2 | `wds-button` | Brand Button variants from a survey of 269 hand-rolled buttons (cta, pill, soft, outline-pill, round icon) + Button doc page | `ui/button/*`, `pages/design/components/button.vue` |
| 3 | `wds-forms` | New components: Input, Select, Textarea, Checkbox, Label, Field + their pages + Forms pattern page | `ui/{input,select,textarea,checkbox,label,field}`, `pages/design/patterns/forms.vue` |
| 4 | `wds-foundations` | Real tokens for shadows, motion, off-scale type sizes; Spacing & Icons pages; Elevation/Motion → stable | `tailwind.css` (additive), `pages/design/foundations/*` |
| 5 | `wds-patterns` | Patterns: cards, heroes, empty states; Brand page (logo, voice, photography) | `pages/design/patterns/{cards,heroes,empty-states}`, `pages/design/brand.vue` |
| 6 | `wds-guardrails` | Token-drift ratchet test, component contract + contrast checks, visual regression, a11y scan, CI wiring | `e2e/`, tests, `package.json` scripts, CI |
| 7 | `wds-fonts` | Load Playfair once globally in `nuxt.config`, remove ~30 per-page font links | `nuxt.config` head, `useHead` font links |

Integration: merge all seven into `wed-ds-phase2`, resolve `design-nav.ts` / `tailwind.css` / `docs/design-system.md` overlaps, re-run build + vitest + visual baselines, then ship.

## Wave 2 — depends on wave 1

- Migrate the 269 raw `<button>` and 157 raw form controls onto Button / form components, page group by page group, pixel-diffed.
- Move pages from raw palette (`--wd-*`, ~2,700 uses) to semantic tokens; adopt shadow/motion/type tokens; replace inline `style=""` with utilities.
- Dark mode: decide keep or remove (currently defined but never switched on, and pages bypass the semantic layer).
- Promote one-off hex values (~30) to tokens or delete them; lower the drift-ratchet baseline to zero.

### Found during wave 1 (fix in wave 2)

Product (from the patterns + guardrails agents):
- Hydration mismatch: sun-ray SVG `Math.cos/sin` differs server vs client (FestivalHero, homepage, city fallback hero) — round coordinates.
- `<button>` nested in `<a>` on festival cards (`festivals/index.vue`) and `EventSchedule` — use the stretched-link pattern.
- Plan cards in `YearPlan.vue` / `SharedYearPlan.vue` are clickable `<div>`s — not keyboard reachable.
- No `<main>` landmark on `/`, `/festivals`, `/cities/munich`, `/for-organizers`, `/artists`.
- Unlabelled search input on `/festivals` + `/artists`; two unnamed `<select>` on `/artists` (axe critical).
- Links distinguished by colour only on several routes; accent-on-tint chips below 4.5:1 (`/cities/munich`).
- Mock data uses pravatar/dicebear faces — breaks "every face real" where mocks render.
- `logo.svg` wordmark is `#2A1B3C` (off-palette); no light-on-dark logo.
- `CommunityGroupsSection` renders nothing when a city has no groups; empty states inconsistent (WeekDrawer, MyPlan, AttendeeRoster, WeeklyCalendar filters).
- Festival card + wavy divider copy-pasted across ~5 pages each → make components.
- 7 literal `font-family: system-ui` left (ActivitiesTab ×2, onboarding, for-events, auth/verify, admin/community-groups, admin/giveaways); 86 hex literals in 20 files (ratchet baseline).

Design-system decisions pending (Commander):
- Forms: mark optional fields "(optional)" (current) vs asterisk on required? Keep a cream background option for admin forms?
- Checkbox: native (accessible, current) vs reka-ui for full brand styling?
- Button: add an `accent` prop for non-red buttons (festival accent, purple, green→cyan)? Loading state 80% opacity or full?
- Lip shadow depth: pages use 4px slightly more than the documented 3px — one standard or two tokens?
- Dark mode: keep or remove.

Infra notes: parallel worktrees sharing one `node_modules` also share the Nuxt build cache (`node_modules/.cache/nuxt`) — parallel builds collide; set `buildDir` per worktree next time.

## Wave 2 — shipped 2026-10-12 (897e2cc)

- Pages moved onto Button / form components and token classes (~150 buttons, ~60 form fields, ~2,300 inline styles). Drift baseline 86 → 20 hex, 0 literal font-family.
- New components: FestivalCard, WaveDivider, ToggleChip, admin header/status/states, CityCombobox (Google Places-backed canonical cities), DanceStylePicker + DanceStyleChips (152-style taxonomy from v3, v4 presentation).
- Caveat restored as `font-hand` (folding it into Playfair italic made the homepage generic).
- Production fixes found on the way: /api/festivals 500 (RAZ-297 regression, hotfixed), missing schema in prod (profiles.languages, early_bird_*, festival_waves, artist_follows — applied), `cities` table + backfill (569 canonical cities after review).
- Safety: vitest no longer runs DB-writing tests against the production DATABASE_URL in .env.

### Next
- City columns → `city_id` FK migration (plan: docs/research/2026-10-12-city-canonicalisation.md, manual mappings: scripts/cities/overrides.json).
- Replace `app/lib/style-colors.ts` with taxonomy colours; clean `timba-2` in prod gigs.
- Remaining a11y: SiteFooter link contrast/underline, organizers feature-card accent links, SubmitVideoForm purple-500.
- Google Cloud (Commander): restrict GOOGLE_MAPS_API_KEY to Places API (legacy), add quota/budget alert.

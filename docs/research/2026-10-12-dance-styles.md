---
title: Dance styles — v3/v4 prior art and the 2026 taxonomy
date: 2026-10-12
feeds: shared/dance-styles.ts, app/components/ui/dance-style-picker/, /design/components/dance-style-picker
---

# Dance styles: v3/v4 prior art and the 2026 taxonomy

## TL;DR

- **There is one real taxonomy, and v3 owns it.** It lives in `wedance-v3/content/styles/*.yml`: 171 YAML files covering names, families, regions, synonyms and popularity. v4 imported those same files into Postgres (`model DanceStyle`) and added only community counters.
- **v4's onboarding mock has the better presentation.** It shows popular styles first, puts everything else behind "Show all" grouped by category, and has a search box on top. v3 has the better data: the synonyms make search alias-aware, and the popularity ranks give a meaningful order.
- **What 2026 now does:** v3's data, cleaned and re-grouped into 15 user-facing families, shown in v4's popular-first layout, with search over v3's aliases. Stored values do not change.

## What v3 had

**Data.** One YAML file per style in `wedance-v3/content/styles/` (171 files), loaded by `use/styles.js`. The fields:

- `id`: PascalCase, and also the URL slug, e.g. `/dance/SalsaLA`
- `name`
- `family`: the parent link. A style belongs under the root style whose `name` equals its family.
- `region`: one of 16 anthropological regions, such as Afro-Caribbean, Afro-American or Indian
- `root`, `synonyms`, `regexp`, `popular`/`popularity` (12 styles ranked), `familyOnly`, `partner`, `type`
- Many wiki fields, almost all empty

There were no colours, icons or translations.

Known defects:

- Several families are misspelled or point at the wrong root (`HipHop`, `Raggaeton`, `Zouk` for Forró, ballroom tango filed under Latin).
- 24 styles have neither a family nor a region.
- `parent: Cuban rumba` points to a style that does not exist.
- The derived Firestore copy (`services/firebase/src/dance_styles.ts`) is stale.

**Presentation.** Four pickers:

1. `TInputStylesSelect2`, the main one, used for profiles, events and posts. It is a list of selected styles. Each row has a heart (highlight), a level dropdown and a delete button. Below the list is a searchable "Add dance style" select that also matches synonyms. It has no grouping and no popular-first ordering.
2. `TInputStyles`: chips under region headings. Only root styles show at first. Selecting a root expands its children inline. This is progressive disclosure, but the headings are anthropological ("Afro-Caribbean"), not words a dancer would use.
3. `TInputStyle`: a single-select searchable dropdown. With `popularOnly` and an empty query it shows the ranked styles. It is used in filters.
4. `pages/dance/index.vue`: a browse page with chips grouped by region.

**Storage:** `{ Kizomba: { selected, highlighted, level } }`, keyed by PascalCase id.

## What v4 had

**Data.** `model DanceStyle` in `prisma/schema.prisma` copies v3's fields. Its `hashtag` column is v3's id, and it adds `membersCount`, `eventsCount`, `video` and `intro`. The rows are imported from v3 YAML by `cli/importer/style.ts`, which has bugs: it maps `partner` from `parent` and `familyOnly` from `family`, so both are always false. No taxonomy file is checked in.

**Presentation.**

1. `components/inputs/DanceStyleInput.vue`, used in the event editor. It shows removable badges and a popover with a flat alphabetical searchable list. Search covers names only, not synonyms.
2. `pages/register/styles.vue`, the onboarding mock using `data/mockStyles.ts` (20 styles in 6 categories: Latin, Ballroom, Urban, Classical, Swing, Brazilian):
   - Search box.
   - **"Popular" first**: the top 6 by members.
   - **"Show All" reveals every category group**, and typing also shows all groups.
   - Selected styles show as removable pills.
   - Nothing is persisted.

**Docs.** `docs/content/product/architecture/dance-styles.md` and `docs/content/product/design/reviews/styles.md` reach these conclusions:

- Styles should form a hierarchical, controlled vocabulary with aliases.
- Beginners search broad ("salsa"); experienced dancers search specific ("casino").
- Family pages work as wiki/SEO pages; style pages are the communities.
- Chips should show local popular styles plus alias badges (On1, Linear).

## Verdict: which presentation is more elegant

**v4's onboarding pattern (popular first → show all grouped → search) is the more elegant one**, for three reasons:

1. **It matches the actual distribution.** In 2026 production, Salsa and Bachata make up 59% of all event style tags (1,314 of 2,239), and the top 8 styles make up 94%. A popular-first row answers almost everyone in one tap.
2. **Its groups use the words dancers use**, like Latin or Swing, rather than v3's regions ("Afro-Caribbean", "Afro-American").
3. **It keeps both audiences.** Beginners see a short list. Experienced dancers search ("casino", "on2") or open the full list.

v3's progressive "select a root to reveal its children" is clever, but it hides styles behind a selection and has no answer for someone who only knows the sub-style name. Search covers that case better.

What v4 got wrong, and v3 got right, is **alias-aware search**. v4 searched names only. 2026 searches names, display labels, aliases and family names, ignoring accents and punctuation ("forro" finds Forró, "salsa on2" finds Salsa NY).

## 2026 before this change (inventory)

**Hard-coded lists, all slightly different:**

| Where | List |
|---|---|
| `onboarding.vue` and `settings.vue` (`DANCE_STYLES`), `my-plan.vue` (`GOAL_DANCE_STYLES`), `festivals/[slug].vue` (`NUDGE_DANCE_STYLES`) | Salsa, Bachata, Kizomba, Zouk, Timba, Semba, **Afro-Cuban**, Reggaeton, **Cha-Cha** |
| `@[handle].vue` booking modal | Salsa, Bachata, Kizomba, Zouk, Timba, Casino, Rueda, Afro |
| `festivals/index.vue` | Salsa, Bachata, Timba, Kizomba, Son |
| `StyleFilter.vue` | hard-coded PRIMARY = Salsa, Bachata, Kizomba |

"Afro-Cuban" and "Cha-Cha" did not match what the data stores ("Afro", "Cha-Cha-Cha").

**Colours:** `app/lib/style-colors.ts` (Tailwind classes for 12 styles), plus local `styleColor` maps in `EventSchedule.vue`, `events/[id].vue` and `design/patterns/cards.vue`. These were left as they are; see Follow-ups.

**Filters:**

- `/cities/[city]` and `/festivals` use `StyleFilter` (single-select chips).
- `/artists` uses a native `<select>`.
- Matching was exact string comparison.

**DB columns:** `json` string arrays on

- `dancers.dance_styles`
- `festivals.styles`
- `community_groups.styles`
- `profiles.styles`
- `booking_requests.styles`
- `gigs.styles`
- `events.styles` (`jsonb`)

Values are Title-Case labels (e.g. `Urban Kiz`), written by the UI and by the v3 sync's `STYLE_MAP` (`server/utils/v3EventSync.ts`).

**Values in production, 2026-10-12** (read-only `SELECT DISTINCT` over `json_array_elements_text`):

| Table | Distinct values (count) |
|---|---|
| events | Salsa 795, Bachata 519, Casino 213, Zouk 184, Kizomba 169, Timba 111, Urban Kiz 65, Rueda 48, Tarraxo 32, Rumba 23, Afro 22, Son 21, Lambada 12, Ballroom 11, Tango 4, Afrobeats 2, Reggaeton 2, Reparto 2, Dancehall 1, Merengue 1, Amapiano 1, Semba 1 |
| profiles | Bachata 13, Casino 11, Salsa 6, Afro 3, Reggaeton 3, Kizomba 3, Merengue 2, Zouk 2, Samba 2, Son 2, Rumba 2, Dancehall 2, Rumba Columbia 1, Afro House 1, Rueda 1, Lambada 1, Rumba Yambu 1, Afrobeats 1 |
| dancers | Salsa 7, Bachata 5, Ladies 1, Afro 1, Theory 1, Timba 1, Son 1, Reggaeton 1, Rumba 1, Kizomba 1 |
| festivals | Salsa 4, Timba 4, Rumba 3, Son 3, Bachata 2, Afro 1, **Cuban** 1, Hip Hop 1, Casino 1 |
| booking_requests | Salsa 5, Casino 2, Zouk 1, Afro 1, Rueda 1, Bachata 1 |
| gigs | Bachata, Salsa, Timba, **timba**, **timba-2** |
| community_groups | Salsa 2, Bachata 1, Timba 1 |

**Every value maps to the taxonomy except `timba-2`**, a slug that leaked into `gigs.styles` and is junk data. `Cuban` resolves to Casino through an alias, and `timba` resolves case-insensitively.

## The 2026 taxonomy (`shared/dance-styles.ts`)

**152 entries:** 150 dances plus 2 workshop topics (Ladies, Theory). They fall into 15 families, in picker order:

1. Salsa
2. Cuban
3. Bachata
4. Kizomba & Semba
5. Brazilian
6. Caribbean & Latin party
7. African
8. Swing
9. Tango
10. Ballroom
11. Street & urban
12. Stage & studio
13. Folk & world
14. Indian
15. Workshop topics

**Fields:**

| Field | Meaning |
|---|---|
| `id` | kebab-case |
| `name` | the stored value: the existing 2026 label, never renamed |
| `label` | optional display name, e.g. Afro → "Afro-Cuban", Son → "Son Cubano", Ladies → "Ladies Styling" |
| `family` | the family the style belongs to |
| `parent` | id of the style it is a variant of, e.g. Rueda → Casino → Salsa |
| `aliases` | v3 names, synonyms, PascalCase ids, and the v3-sync keys |
| `rank` | popularity order: seeded from 2026 event counts, blended with v3's `popularity` |
| `topic` | marks the workshop topics |
| `token` | colour, as a `WD` token key |

Colours are `WD` tokens only, per family. No new hex values were added.

**Decisions:**

- **2026 labels win over v3 names**, so stored rows stay valid. v3's "Son Cubano", "Brazilian Zouk", "Rueda de Casino" and "Tango Argentino" are aliases of `Son`, `Zouk`, `Rueda` and `Tango`.
- **Ambiguous names are split by scene:**

  | Stored value | Means | The other dance is stored as |
  |---|---|---|
  | `Rumba` | Cuban rumba | ballroom `Rhumba` |
  | `Tango` | Argentine tango | `Ballroom Tango` |
  | `Cha-Cha-Cha` | Cuban cha-cha-chá | `Ballroom Cha-Cha` |
  | `Samba` | Brazilian samba | `Ballroom Samba` |
  | `Zouk` | Brazilian zouk | Caribbean `Zouk Love` |

  `Afrobeats` lost v3's "Afro" synonym, because "Afro" is 2026's Afro-Cuban.
- **Merged:** Tarraxo and Tarraxa/Tarraxinha. Rumba Guaguancó became an alias of Rumba, its most common form. Breakdance became an alias of Breaking. Cubaton became an alias of Reparto.
- **Dropped:**
  - Historical court dances: Allemande, Chaconne, Cotillion, Galliard, Lancer, Minuet, Pavane, Quadrille, Sarabande, Volta.
  - Moves listed as styles: Moonwalk, Robot and Worm, now aliases of Popping and Breaking.
  - v3's abstract roots: "Indian Classical Dance", "Indian Folk Dance", "Latin" (now `Ballroom Latin`).
- **Helpers:** `findDanceStyle`, `canonicalDanceStyle`, `displayDanceStyle`, `sortDanceStyles`, `sameDanceStyle`, `relatedDanceStyles` (follows ancestors), `matchesDanceStyleQuery`, `detectDanceStyle` (free text, whole words, common styles only), `danceStyleAccent`.

## Follow-ups (not done here)

- Per-style **levels** and **highlight**: v3's heart and level dropdown. 2026 already stores levels in `dancers.dance_levels`, and settings renders them under the picker.
- Point `server/utils/v3EventSync.ts` `STYLE_MAP` at `canonicalDanceStyle`. Every STYLE_MAP key and value already resolves; this is enforced by a test.
- Retire `app/lib/style-colors.ts` and the local `styleColor` maps in favour of `danceStyleAccent`.
- Clean `gigs.styles = 'timba-2'` in production.
- `/dance/<family>/<style>` pages (the v4 "train station" model) can be generated from this file.

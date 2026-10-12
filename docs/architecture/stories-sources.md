# stories.json: sources and method

Input for RAZ-305 step 2. Generated 2026-10-12 from Linear (read-only), `docs/issues/`, the wedance-org story maps, `e2e/features/` and the code at this worktree's HEAD.

## Method

1. **Linear is canonical.** All 305 RAZ issues were fetched (archived included). The 208 in project `WeDance` became 151 entries.
   - Merged (same story text): RAZ-59 into RAZ-23, and RAZ-205 into RAZ-110.
   - Folded into the notes of the story they serve, or skipped: 53 bugs, chores, QA tasks and review follow-ups. Examples are RAZ-223/224 under RAZ-162, RAZ-228/229 under RAZ-130, and RAZ-266/267 under RAZ-23.
   - Skipped as internal work: RAZ-203/204, 244/245, 268, 277–282, 290–293 and 305.
   - Skipped as Canceled: RAZ-208 and RAZ-217.
   - From issues outside any project, 4 became entries because they reveal a capability: RAZ-241, RAZ-251, RAZ-253 and RAZ-272. The other user reports appear only in notes.
2. **docs/issues (216 files)** added no new stories. Every `P*`/`G*` promise file maps 1:1 to a Linear issue through the "Promise Pxxx" line. The `RAZ-*` and `WED-*` files are archived copies of Linear issues.
3. **Story maps** (wedance-org `01_Domains/Festival_Experience`):
   - The meetup-planner backlog has 36 stories. They became 24 `map:meetup-*` entries; the rest merged into Linear entries (for example 3.1/3.2 into RAZ-116 and 6.1/6.2 into RAZ-65).
   - The festival-schedule user journey became 1 entry. Its live radar, check-in, rating, stats and loyalty steps merged into meetup entries.
   - The 10 Operations/Stories `.yml` files duplicate backlog items and are cited in notes.
4. **e2e features (3 files)** were merged into `map:meetup-2.1-sign-up`, RAZ-241 and RAZ-136.
5. **Status comes from code, not from issue state:**
   - `built`: the route, the procedure (if any) and the table (if any) all exist and are wired together.
   - `partial`: a layer is missing or stubbed. Typical causes are a hardcoded mock catalogue, localStorage-only state, or a capability that is only promised in copy.
   - `missing`: nothing implements it.
   - `unknown`: the issue is too vague to check.

   Landing-copy promises count as `built` when the copy and its link exist. The notes then say what the linked capability actually does.
6. **Field formats:**
   - Procedures use the key registered in `server/trpc/index.ts`.
   - Tables use the Drizzle export names from `server/database/schema.ts`.
   - Evidence lines were resolved by pattern match against the files at generation time.
   - The journey comes from the `cuj:` label. Where no label exists it was inferred, and the notes say so.

## Unresolved

- **RAZ-304:** the issue does not say which section shows live data, so its status is `unknown`.
- **Stories with no tracked issue:** city video voting and city battles (`cityVideo.*` public procedures, `video_votes`, `city_battle_votes`) and public giveaways (`giveaway.listActive`/`enter`). Only their admin side appears, in RAZ-170.
- **Procedures with no UI caller:**
  - `entity.listCities`, `entity.cityDirectory`
  - `booking.setAvailability`
  - `election.guidelineHistory`
  - `gigs.getById`, `gigs.close`
  - `referral.myReferrals`
- **`auth.changePassword`:** it has a UI in /settings, but no story covers it.

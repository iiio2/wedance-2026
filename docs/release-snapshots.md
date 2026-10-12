# Release snapshots

After every successful **production** deploy, `.github/workflows/release-snapshots.yml` takes full-page screenshots of key pages and attaches them to a GitHub Release tagged `snapshots/<UTC date-time>-<sha>` (marked pre-release, so it never becomes "latest").

- **Why:** old Vercel deployments are behind SSO and render *today's* database, so they can't show what visitors actually saw. These screenshots are the true record of each release.
- **Pages:** `scripts/release-snapshots/routes.ts` (add a route there to start archiving it). Desktop 1440px (1×) and mobile 390px (2×), JPEG q85 (~25 MB per release); pages taller than JPEG allows fall back to PNG.
- **Real data, nothing masked** — unlike the visual-regression baselines in `e2e/design`, which mask live data and get overwritten.
- **Run by hand:** Actions → *Release snapshots* → *Run workflow* (optional URL), or locally:
  `bun scripts/release-snapshots/capture.ts --url=https://2026.wedance.vip --out=snapshots`
- **Find one:** GitHub → Releases → filter `snapshots/`, or `gh release list --repo razbakov/wedance-2026 | grep snapshots/`.

# Visual history (Argos)

**A record, never a gate.** We ship continuously and keep a trace of what changed, when and why.

After every successful **production** deploy, `.github/workflows/visual-history.yml` takes full-page screenshots of the live site (desktop 1440, mobile 390) and uploads them to **Argos** — https://app.argos-ci.com — as a build on branch `main`, tagged with the deployed commit.

- **Browse:** each Argos build is one release — open it to click through every page.
- **Compare:** pick any two builds and view a page side by side, with a slider, or as a diff overlay.
- **Trace:** each build links to its commit; the commit/PR says why it changed.

Nothing here blocks a merge or a deploy: no PR builds, no required checks, and the step is `continue-on-error`.

- **Pages:** `scripts/release-snapshots/routes.ts` — add a line to start recording a page.
- **Spec / config:** `e2e/argos/pages.spec.ts`, `playwright.argos.config.ts`.
- **Noise:** animations off; relative dates and anything marked `data-visual-mask` hidden, so daily data changes don't read as design changes.
- **Secret:** `ARGOS_TOKEN` (GitHub Actions).
- **Locally (no upload):** `ARGOS_BASE_URL=https://2026.wedance.vip bun run test:argos` → `./screenshots/`.

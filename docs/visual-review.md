# Visual review (Argos)

Every deploy is screenshotted and reviewed in **Argos** — https://app.argos-ci.com — before it goes live.

| Deploy | What happens |
|---|---|
| **Production** (merge to `main`) | Full-page screenshots of the live site become the **baseline** (branch `main`). |
| **Preview** (open PR) | Screenshots of the Vercel preview are compared with the baseline. Argos posts a check on the PR: ✅ no changes, or 🟠 *changes need review*. |

In Argos you browse every build page by page and compare **side by side, with a slider, or as a diff overlay**, then approve or reject each change. Build history = the visual history of the site.

- **Pages:** `scripts/release-snapshots/routes.ts` (shared with release snapshots). Desktop 1440 and mobile 390, full page.
- **Spec / config:** `e2e/argos/pages.spec.ts`, `playwright.argos.config.ts`; workflow `.github/workflows/visual-review.yml` (`deployment_status`).
- **Noise control:** animations off, devtools hidden, relative dates and anything marked `data-visual-mask` hidden — so daily data changes don't look like design changes. Add `data-visual-mask` to any new volatile element.
- **Secrets (GitHub Actions):** `ARGOS_TOKEN` (Argos project token), `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Deployment Protection → Protection Bypass for Automation; lets CI open SSO-protected previews).
- **Gate before go-live:** make the Argos check required on `main` (repo → Settings → Branches) so a PR with unreviewed visual changes can't merge.
- **Run locally (no upload):** `ARGOS_BASE_URL=https://2026.wedance.vip bun run test:argos` → `./screenshots/`.

# Contributing to WeDance

Thanks for wanting to help. WeDance is open source under the
[GNU AGPL-3.0](LICENSE): code, design and docs contributions are all welcome, and
so are bug reports.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Where work is tracked

- **External contributors: use [GitHub Issues](https://github.com/razbakov/wedance-2026/issues).**
  Report bugs and propose features there. For anything bigger than a small fix,
  open an issue first and say what you plan to change, so nobody builds the same
  thing twice.
- The core team plans its own work in Linear. That tracker is internal, so you
  will see `RAZ-<number>` ids in branch names, commit messages and PR titles.
  You don't need access to it, and you don't need a `RAZ-` id to contribute.
- In the app itself, the **Report a problem** button (bottom-left on every
  page) sends a report with a screenshot. It needs no account.

## Set up

Follow the quick start: <https://2026.wedance.vip/docs/getting-started>
(source: `app/pages/docs/getting-started.vue`). In short: Bun, Node.js and
Docker; `bun install`; a local Postgres in Docker behind the dev proxy
(`bun run dev:db-proxy`); `bun run dev`.

**Never point a local setup at the production database.** Use the local Docker
Postgres. The DB tests refuse to run against anything but `localhost`.

## Make a change

1. Fork the repo and create a branch from `main`. Name it after what it does,
   e.g. `fix-city-search-accents` (the core team uses `<user>/raz-<id>-<slug>`).
2. Keep a PR to one change. Unrelated fixes go in their own PR.
3. Follow the conventions:
   - **UI:** use the design system — components in `app/components/ui`, tokens
     in `app/assets/css/tailwind.css`. Never hand-roll a one-off or hard-code a
     hex colour. See [`docs/design-system.md`](docs/design-system.md) and
     <https://2026.wedance.vip/docs/design>.
   - **Forms:** client validation uses valibot, as described in
     [`CLAUDE.md`](CLAUDE.md) → Conventions.
   - **Data model / API:** the architecture docs are generated from the code
     ([ADR-000](docs/architecture/adr/000-generated-architecture-docs.md)). A new
     table must be assigned to a context in `scripts/architecture/domains.ts`, or
     the tests fail.
   - **Migrations** are SQL files in `server/database/migrations`, additive and
     safe to re-run.
4. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(scope): …`, `fix(scope): …`, `docs: …`, `test(design): …`,
   `refactor(scope): …`. Imperative, lower case, no trailing period.

## Run the checks

Before you open a PR:

```bash
bun run test          # unit + router tests (vitest), incl. design-system guardrails
bun run build         # the production build must succeed
```

CI (`.github/workflows/test.yml`) runs on every PR to `main`:

- the unit tests,
- the same tests against a fresh Postgres (schema via `drizzle-kit push`, seed
  data via `bun run db:seed`),
- a production build with the Playwright `@smoke` tests,
- the design-system component contract and accessibility checks
  (`bun run test:design`).

If you changed something visible, run `bun run test:design` locally too, and
`bun run test:visual` to see screenshot diffs (baselines are macOS-only).

## Open the pull request

- Target `main`. The title follows the commit convention, e.g.
  `fix(cities): match city names with accents`.
- In the description, say what changed and why, and link the issue
  (`Closes #123`). Add screenshots for anything a user can see — phone width
  (375px) and desktop.
- Keep the branch up to date with `main`. PRs are squash-merged once they are
  green and reviewed.

## License

By contributing, you agree that your contributions are licensed under the
[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only), the license
of this project.

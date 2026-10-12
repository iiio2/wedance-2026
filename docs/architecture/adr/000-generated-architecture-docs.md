---
title: Generated architecture docs
status: accepted
date: 2026-10-12
---

## Context

WeDance 2026 grew fast: 38 tables, 120+ tRPC procedures, a dozen REST and webhook
handlers, and a backlog of user stories spread over Linear, `docs/issues/` and the
story map. Hand-written architecture documentation for a codebase moving at this
speed is out of date within a week, and stale docs are worse than none — they are
trusted and wrong.

We want one place (`/docs/architecture`, next to the design system at
`/docs/design`) where a person or an agent can see the data model, the API
surface and how stories map onto them, and be sure it matches the code that is
deployed.

## Decision

Everything under `/docs/architecture` except the Overview narrative and these ADRs is
**generated from the code** by `scripts/architecture/generate.ts`:

- **Data model** — the Drizzle table objects exported by `server/database/schema.ts`
  are introspected with `getTableConfig` (columns, types, nullability, defaults,
  keys, unique constraints, indexes, foreign keys). Source text is only read for
  what Drizzle drops at runtime: the comment above each table, its line, and
  `.$type<'a' | 'b'>()` value lists.
- **API** — the live `appRouter` is imported; each procedure's kind, input (zod →
  JSON Schema) and auth level come from the router object. Auth level is decided
  by middleware identity (does the procedure carry `adminProcedure`'s or
  `protectedProcedure`'s middleware?), not by naming. REST handlers come from the
  files under `server/api` (Nitro's file-name convention gives method and path).
- **Tables touched / used by** — a small static analysis follows each procedure's
  source span, the same-file helpers it calls and relative imports, and records
  every schema table it reaches. It over-approximates on purpose.
- **Stories** — `docs/architecture/stories.json` is validated against the code:
  procedures, tables and routes a story names that do not exist are flagged, and
  procedures no story references are listed as unmapped.
- **Context grouping** — the only hand-kept mapping, `scripts/architecture/domains.ts`,
  is drift-checked by a test (every table must be assigned exactly once).

### Regeneration

A local Nuxt module (`scripts/architecture/nuxt-module.ts`, registered in
`nuxt.config.ts`) runs the generator during module setup, i.e. on every
`nuxt prepare` (postinstall), `nuxt dev` and `nuxt build` — so every Vercel build
regenerates from the commit it deploys. In dev it regenerates again when the
schema, a router, an API handler or a file in `docs/architecture/` changes.
Manual run: `bun scripts/architecture/generate.ts`.

### Generated output is gitignored, not committed

Output goes to `app/generated/architecture/*.json` (imported by the pages) and
`server/assets/architecture/admin.json` (served by `GET /api/architecture/admin`).
Both are in `.gitignore`. We chose this over committing the output plus a CI
"is it up to date?" check because:

- the build regenerates anyway, so a committed copy could only ever be a stale
  duplicate of what is deployed;
- committing it would put a large generated diff (and merge conflicts) on every PR
  that touches the schema or a router;
- the admin half must never be committed or bundled publicly in any case.

The cost is that the generated JSON is not reviewable in a PR diff — review the
rendered page on the preview deploy instead.

`scripts/architecture/generate.test.ts` fails when a table exported by the schema
or a procedure on `appRouter` is missing from the generated output, when a table
has no context, or when an admin procedure leaks into the public files.

### Admin procedures stay server-side

Admin-level procedures are written only to `server/assets/architecture/admin.json`
and served at runtime to `is_admin` dancers (same Bearer session check as the tRPC
`adminProcedure`). The public JSON — and so the client bundle — carries only their
count. Story references to admin procedures are reduced to a count publicly.

Since the source is public (AGPL-3.0, see below), anyone can read the admin routers
on GitHub. Keeping their names out of the public docs bundle is about not
advertising the admin surface on an indexed page, not about secrecy: the security
boundary is the `adminProcedure` check on every call, never obscurity.

### Public and indexed (amended 2026-10-12)

The docs started as internal, `noindex` pages. On 2026-10-12 the project became
open source under **AGPL-3.0-only**, and the docs moved under one `/docs` umbrella
(`/docs`, `/docs/getting-started`, `/docs/design/**`, `/docs/architecture/**`; the
old `/design/**` and `/architecture/**` URLs 301 there). They are now **public and
indexed**: every page carries a title, a meta description and a canonical URL on
`https://2026.wedance.vip`. The one exception is `/docs/architecture/api/admin`,
which stays `noindex` and admin-gated.

## Consequences

- The docs cannot drift from the code they were built with; when they look wrong,
  the code is wrong (or the generator has a bug — fix it once).
- New tables must be placed in a context in `domains.ts`, or the test suite fails.
- The pages bundle the generated JSON (a few hundred KB, public and indexed).
- Mermaid diagrams load from a pinned CDN build (`mermaid@11.4.1`) only on
  `/docs/architecture` pages — no npm dependency added.

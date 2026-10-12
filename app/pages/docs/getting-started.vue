<script setup lang="ts">
import { CONTRIBUTING_URL, REPO_URL } from '~/lib/docs-nav'

definePageMeta({ layout: 'docs' })

// Every command below is the one the repo itself uses: package.json scripts,
// scripts/dev/neon-http-proxy.ts and the CI workflow (.github/workflows/test.yml),
// which runs the same push → proxy → seed sequence against a fresh Postgres.
const prerequisites = [
  { name: 'Git', note: 'to clone the repository.' },
  { name: 'Bun', note: 'the package manager and script runner (bun install, bun run …).', href: 'https://bun.sh' },
  { name: 'Node.js 20.19+ or 22.12+', note: 'Nuxt 4 runs on it.', href: 'https://nodejs.org' },
  { name: 'Docker', note: 'for the local Postgres database.', href: 'https://docs.docker.com/get-docker/' },
]

const clone = `git clone https://github.com/razbakov/wedance-2026.git
cd wedance-2026
bun install`

const env = `cp .env.example .env`

const envLocal = `# .env — local database through the dev proxy
DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance
NEON_FETCH_ENDPOINT=http://localhost:4444/sql`

const db = `docker run -d --name wedance-2026-dev-db \\
  -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=wedance \\
  -p 5441:5432 postgres:17-alpine`

const schema = `bun run db:push --force   # create the tables from server/database/schema.ts
bun run dev:db-proxy           # keep this running in its own terminal (port 4444)
bun run db:seed                # optional: a few sample festivals`

const dev = `bun run dev   # http://localhost:3000`

const tests = `bun run test          # unit + router tests (vitest), incl. design-system guardrails
bun run test:tokens   # only the design-token guardrails
bun run build         # production build — also regenerates the architecture docs`
</script>

<template>
  <DesignPage
    eyebrow="Getting started"
    site="WeDance Docs"
    title="Quick start"
    lead="Run WeDance on your own machine, against a local Postgres. Nothing here touches the production database."
  >
    <DesignSection id="prerequisites" title="Prerequisites">
      <ul class="grid sm:grid-cols-2 gap-3">
        <li v-for="p in prerequisites" :key="p.name" class="rounded-2xl border border-border bg-card p-4">
          <a v-if="p.href" :href="p.href" class="font-bold hover:text-primary">{{ p.name }}</a>
          <span v-else class="font-bold">{{ p.name }}</span>
          <p class="text-sm text-muted-foreground mt-1">{{ p.note }}</p>
        </li>
      </ul>
    </DesignSection>

    <DesignSection id="clone" title="1. Clone and install">
      <DesignCode :code="clone" lang="bash" />
      <p class="text-sm text-muted-foreground mt-3">
        <code class="font-mono text-[13px]">bun install</code> also runs <code class="font-mono text-[13px]">nuxt prepare</code>,
        which generates the architecture docs data from the code.
      </p>
    </DesignSection>

    <DesignSection id="env" title="2. Create your .env" lead="Start from the example. For local work only the database needs a value.">
      <DesignCode :code="env" lang="bash" />
      <p class="text-sm text-muted-foreground mt-4 mb-3">Then set the database lines to the local database from the next step:</p>
      <DesignCode :code="envLocal" lang="bash" />
      <p class="text-sm text-muted-foreground mt-3">
        The other keys can stay empty while you work locally: without Resend, sign-in magic links are printed
        to the terminal; without a Google Maps key, city search only finds cities already in the database;
        PostHog and Sentry do nothing without a key. Ticket checkout (Stripe) and photo uploads (Cloudinary)
        only work once you add your own test keys.
      </p>
    </DesignSection>

    <DesignSection id="database" title="3. Start a local database" lead="The app talks to Postgres through the Neon HTTP driver. Locally, a small proxy stands in for Neon, so the app runs against plain Postgres in Docker.">
      <DesignCode :code="db" lang="bash" />
      <div class="mt-4">
        <DesignCode :code="schema" lang="bash" />
      </div>
      <p class="text-sm text-muted-foreground mt-3">
        The proxy (<code class="font-mono text-[13px]">scripts/dev/neon-http-proxy.ts</code>) connects to
        <code class="font-mono text-[13px]">postgresql://dev:dev@localhost:5441/wedance</code> by default;
        set <code class="font-mono text-[13px]">LOCAL_PG_URL</code> to use another database.
      </p>
    </DesignSection>

    <DesignSection id="run" title="4. Run the app">
      <DesignCode :code="dev" lang="bash" />
      <p class="text-sm text-muted-foreground mt-3">
        Open <code class="font-mono text-[13px]">http://localhost:3000</code>, and these docs at
        <code class="font-mono text-[13px]">http://localhost:3000/docs</code>.
        A fresh database is empty, so city and event pages show their empty states until you add data.
      </p>
    </DesignSection>

    <DesignSection id="tests" title="5. Run the tests">
      <DesignCode :code="tests" lang="bash" />
      <p class="text-sm text-muted-foreground mt-3">
        Tests that need a database skip themselves when none is configured. The Playwright suites
        (<code class="font-mono text-[13px]">bun run test:e2e</code>, <code class="font-mono text-[13px]">bun run test:design</code>)
        expect a running app; see <a :href="`${REPO_URL}/blob/main/docs/design-system.md`" class="font-bold text-wd-red-800 hover:underline">docs/design-system.md</a>.
      </p>
    </DesignSection>

    <DesignSection id="next" title="Next">
      <p class="text-muted-foreground">
        Read <a :href="CONTRIBUTING_URL" class="font-bold text-wd-red-800 hover:underline">CONTRIBUTING.md</a> before you open a pull request,
        then explore the <NuxtLink to="/docs/design" class="font-bold text-wd-red-800 hover:underline">design system</NuxtLink>
        and the <NuxtLink to="/docs/architecture" class="font-bold text-wd-red-800 hover:underline">architecture</NuxtLink>.
      </p>
    </DesignSection>
  </DesignPage>
</template>

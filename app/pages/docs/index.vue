<script setup lang="ts">
import { ArrowRight, ArrowUpRight, Bug, Database, Github, GitPullRequest, Landmark, Palette, Scale, Terminal } from 'lucide-vue-next'
import { componentItems } from '~/lib/design-nav'
import { CONTRIBUTING_URL, GOVERNANCE_URL, ISSUES_URL, LICENSE_URL, REPO_URL } from '~/lib/docs-nav'
import { requestProblemReport } from '~/lib/report-problem'

definePageMeta({ layout: 'docs' })

const title = 'WeDance Docs — open-source dance community platform'
const description = 'WeDance is open source under AGPL-3.0. Run it locally, read the design system and the architecture generated from the code, and contribute.'
useSeoMeta({ title, ogTitle: title, description, ogDescription: description })

// Every number here is generated from the code at build time (ADR-000) or
// counted from the design nav — nothing is typed in by hand.
const { meta } = useArchitecture()
const c = meta.counts
const stats = [
  { value: c.tables, label: 'database tables' },
  { value: c.procedures, label: 'tRPC procedures' },
  { value: c.stories, label: 'user stories mapped' },
  { value: componentItems.filter(i => i.status !== 'planned').length, label: 'documented components' },
]

const architectureLinks = [
  { label: 'Data model', to: '/docs/architecture/data' },
  { label: 'API', to: '/docs/architecture/api' },
  { label: 'User stories', to: '/docs/architecture/stories' },
  { label: 'Decisions', to: '/docs/architecture/decisions' },
]

const quickStart = `git clone https://github.com/razbakov/wedance-2026.git
cd wedance-2026
bun install
cp .env.example .env      # then point DATABASE_URL at a local Postgres
bun run dev               # http://localhost:3000`

const steps = [
  { title: 'Find or open an issue', body: 'Bugs and ideas live in GitHub Issues. Say what you want to change before a big piece of work.' },
  { title: 'Branch from main', body: 'Fork the repo, create a branch, keep the change focused on one thing.' },
  { title: 'Run the checks', body: 'bun run test runs the unit tests, including the design-system guardrails.' },
  { title: 'Open a pull request', body: 'Against main, with what changed and why. Screenshots for anything visible.' },
]
</script>

<template>
  <article>
    <!-- Hero -->
    <header class="pb-10 mb-12 border-b border-border">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">WeDance docs</span>
        <Badge variant="outline" class="gap-1"><Scale class="size-3" aria-hidden="true" /> AGPL-3.0</Badge>
      </div>
      <h1 class="text-4xl sm:text-6xl font-display font-bold mt-4 leading-[1.05] max-w-3xl">
        The dance community platform, built in the open
      </h1>
      <p class="text-lg text-muted-foreground mt-5 max-w-2xl">
        WeDance helps dancers find classes, socials and festivals city by city, the teachers,
        venues and organisers behind them, and who else is going. The whole app is open source
        under the <a :href="LICENSE_URL" class="font-bold text-foreground underline underline-offset-4 hover:text-primary">GNU AGPL-3.0</a>.
      </p>
      <div class="flex flex-wrap items-center gap-3 mt-8">
        <Button as-child variant="cta" size="lg">
          <a :href="REPO_URL"><Github aria-hidden="true" /> View on GitHub</a>
        </Button>
        <Button as-child variant="outline-pill" size="lg">
          <NuxtLink to="/docs/getting-started"><Terminal aria-hidden="true" /> Run it locally</NuxtLink>
        </Button>
        <Button as-child variant="soft" size="lg">
          <a :href="CONTRIBUTING_URL"><GitPullRequest aria-hidden="true" /> Contribute</a>
        </Button>
      </div>

      <dl class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
        <div v-for="s in stats" :key="s.label" class="rounded-2xl border border-border bg-card p-4">
          <dt class="sr-only">{{ s.label }}</dt>
          <dd>
            <span class="block text-3xl font-display font-bold">{{ s.value }}</span>
            <span class="block text-sm text-muted-foreground mt-0.5">{{ s.label }}</span>
          </dd>
        </div>
      </dl>
      <p class="text-meta text-muted-foreground mt-2">Counted from the code at build time.</p>
    </header>

    <div class="space-y-14">
      <DesignSection id="explore" title="Explore the docs">
        <div class="grid md:grid-cols-3 gap-4">
          <NuxtLink to="/docs/design" class="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40">
            <Palette class="size-6 text-primary" aria-hidden="true" />
            <h3 class="font-display font-bold text-xl mt-3">Design system</h3>
            <p class="text-sm text-muted-foreground mt-1.5">Tokens, components and patterns behind every WeDance screen, with live examples.</p>
            <span class="inline-flex items-center gap-1 text-sm font-bold text-primary mt-3">Open <ArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
          </NuxtLink>

          <div class="rounded-2xl border border-border bg-card p-5">
            <Database class="size-6 text-primary" aria-hidden="true" />
            <h3 class="font-display font-bold text-xl mt-3">
              <NuxtLink to="/docs/architecture" class="hover:text-primary">Architecture</NuxtLink>
            </h3>
            <p class="text-sm text-muted-foreground mt-1.5">Generated from the code on every build, so it never drifts.</p>
            <ul class="flex flex-wrap gap-2 mt-3">
              <li v-for="l in architectureLinks" :key="l.to">
                <NuxtLink :to="l.to" class="inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-foreground">{{ l.label }}</NuxtLink>
              </li>
            </ul>
          </div>

          <a :href="GOVERNANCE_URL" class="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40">
            <Landmark class="size-6 text-primary" aria-hidden="true" />
            <h3 class="font-display font-bold text-xl mt-3">Governance</h3>
            <p class="text-sm text-muted-foreground mt-1.5">How the WeDance organisation decides: the org's living docs, on org.wedance.vip.</p>
            <span class="inline-flex items-center gap-1 text-sm font-bold text-primary mt-3">org.wedance.vip <ArrowUpRight class="size-4" aria-hidden="true" /></span>
          </a>
        </div>
      </DesignSection>

      <DesignSection id="quick-start" title="Quick start" lead="Bun, Node.js and Docker are all you need. The full guide sets up a local database so you never touch production.">
        <DesignCode :code="quickStart" lang="bash" />
        <p class="text-sm mt-4">
          <NuxtLink to="/docs/getting-started" class="font-bold text-wd-red-800 hover:underline">Read the full quick start →</NuxtLink>
        </p>
      </DesignSection>

      <DesignSection id="contribute" title="How to contribute" lead="Code, design, docs and bug reports are all welcome.">
        <ol class="grid sm:grid-cols-2 gap-4">
          <li v-for="(s, i) in steps" :key="s.title" class="rounded-2xl border border-border bg-card p-5">
            <span class="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{{ i + 1 }}</span>
            <h3 class="font-bold mt-3">{{ s.title }}</h3>
            <p class="text-sm text-muted-foreground mt-1">{{ s.body }}</p>
          </li>
        </ol>
        <p class="text-sm text-muted-foreground mt-4">
          The details — branch names, commit style, which tests to run — are in
          <a :href="CONTRIBUTING_URL" class="font-bold text-wd-red-800 hover:underline">CONTRIBUTING.md</a>.
          Everyone taking part follows the <a :href="`${REPO_URL}/blob/main/CODE_OF_CONDUCT.md`" class="font-bold text-wd-red-800 hover:underline">Code of Conduct</a>.
        </p>
      </DesignSection>

      <DesignSection id="report" title="Report a problem" lead="Something broken or confusing, in the app or in these docs?">
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="pill" @click="requestProblemReport"><Bug aria-hidden="true" /> Report a problem</Button>
          <Button as-child variant="outline-pill">
            <a :href="ISSUES_URL">Open a GitHub issue <ArrowUpRight aria-hidden="true" /></a>
          </Button>
        </div>
        <p class="text-sm text-muted-foreground mt-3">The report button sends a screenshot of this page along with your note — no account needed.</p>
      </DesignSection>

      <footer class="border-t border-border pt-6 text-sm text-muted-foreground">
        WeDance is free software, licensed under the
        <a :href="LICENSE_URL" class="font-bold text-foreground hover:text-primary">GNU Affero General Public License v3.0</a>
        (AGPL-3.0-only). © 2026 Aleksey Razbakov.
      </footer>
    </div>
  </article>
</template>

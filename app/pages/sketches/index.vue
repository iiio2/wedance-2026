<script setup lang="ts">
/**
 * /sketches — every UI sketch in one place: what it explores, why, who asked,
 * who built it, when, and where the decision stands. Data: app/lib/sketches.ts.
 * Decisions are made in the Linear "WeDance UX" project; the picked variant
 * becomes a user story ticket in the WeDance project.
 */
import { ExternalLink, ArrowRight, CalendarDays, User, Bot } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { SKETCHES, STATUS_LABEL, type SketchStatus } from '~/lib/sketches'

definePageMeta({ layout: false })
useHead({ title: 'Sketches — WeDance', meta: [{ name: 'robots', content: 'noindex' }] })

const ORDER: SketchStatus[] = ['deciding', 'decided', 'shipped', 'parked', 'archived']
const groups = computed(() => ORDER
  .map(status => ({ status, items: SKETCHES.filter(s => s.status === status).sort((a, b) => b.created.localeCompare(a.created)) }))
  .filter(g => g.items.length))

const badgeClass: Record<SketchStatus, string> = {
  deciding: 'border-transparent bg-primary text-primary-foreground',
  decided: 'border-transparent bg-wd-amber-500 text-wd-brown-900',
  shipped: 'border-success/40 bg-success/10 text-wd-green-700',
  parked: 'border-border bg-muted text-muted-foreground',
  archived: 'border-border bg-muted text-muted-foreground',
}
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const UX_PROJECT = 'https://linear.app/alosha/project/wedance-ux-9ac918bfd986'
</script>

<template>
  <div class="min-h-screen bg-background">
    <SiteHeader />
    <section class="max-w-4xl mx-auto px-4 pt-10 pb-6 text-center">
      <div class="text-xs uppercase tracking-[0.3em] text-secondary font-display">Work in progress</div>
      <h1 class="font-display text-4xl sm:text-5xl mt-2">The <em class="italic text-primary">sketches.</em></h1>
      <p class="mt-3 text-muted-foreground max-w-xl mx-auto">
        Clickable UI options we compare before building anything. Each one has a decision ticket; the picked option becomes a user story.
      </p>
      <ol class="mt-6 grid gap-3 sm:grid-cols-3 text-left">
        <li class="rounded-2xl border border-border bg-card p-4 shadow-wd-card">
          <span class="text-eyebrow uppercase tracking-[0.2em] font-bold text-primary">1 · Sketch</span>
          <p class="mt-1 text-sm">Variants side by side, built from the real design system.</p>
        </li>
        <li class="rounded-2xl border border-border bg-card p-4 shadow-wd-card">
          <span class="text-eyebrow uppercase tracking-[0.2em] font-bold text-primary">2 · Decide</span>
          <p class="mt-1 text-sm">Pick one in its ticket in <a :href="UX_PROJECT" target="_blank" rel="noopener" class="underline underline-offset-2 text-wd-red-800">WeDance UX</a>, then move it to Todo.</p>
        </li>
        <li class="rounded-2xl border border-border bg-card p-4 shadow-wd-card">
          <span class="text-eyebrow uppercase tracking-[0.2em] font-bold text-primary">3 · Story</span>
          <p class="mt-1 text-sm">The decision becomes a user story ticket, which gets built.</p>
        </li>
      </ol>
    </section>
    <WaveDivider />

    <section v-for="g in groups" :key="g.status" class="max-w-4xl mx-auto px-4 py-6">
      <div class="flex items-baseline justify-between gap-3 mb-3">
        <h2 class="font-display text-2xl">{{ STATUS_LABEL[g.status] }}</h2>
        <span class="font-hand text-secondary text-lg">— {{ g.items.length }}</span>
      </div>
      <ul class="flex flex-col gap-3">
        <li
          v-for="s in g.items" :key="s.slug"
          class="rounded-2xl border bg-card p-5 shadow-wd-card"
          :class="g.status === 'deciding' ? 'border-primary/30' : 'border-border'"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="font-display font-bold text-xl leading-tight">{{ s.title }}</h3>
              <p class="mt-1 text-sm">{{ s.what }}</p>
            </div>
            <Badge :class="badgeClass[s.status]">{{ STATUS_LABEL[s.status] }}</Badge>
          </div>
          <p class="mt-2 text-sm text-muted-foreground"><span class="font-semibold text-foreground">Why:</span> {{ s.why }}</p>
          <p v-if="s.decision" class="mt-2 text-sm"><span class="font-semibold">Decision:</span> {{ s.decision }}</p>
          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1"><CalendarDays class="w-3.5 h-3.5" />{{ fmt(s.created) }}</span>
            <span class="inline-flex items-center gap-1"><User class="w-3.5 h-3.5" />Asked by {{ s.requestedBy }}</span>
            <span class="inline-flex items-center gap-1"><Bot class="w-3.5 h-3.5" />Built by {{ s.builtBy }}</span>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <Button as-child variant="pill" size="pill-sm">
              <NuxtLink :to="`/sketches/${s.slug}`">Open sketch <ArrowRight /></NuxtLink>
            </Button>
            <Button v-if="s.ticket" as-child variant="outline-pill" size="pill-sm">
              <a :href="s.ticket.url" target="_blank" rel="noopener">Decision · {{ s.ticket.label }} <ExternalLink /></a>
            </Button>
            <a
              v-for="l in s.story ?? []" :key="l.url" :href="l.url" target="_blank" rel="noopener"
              class="inline-flex items-center gap-1 text-xs font-semibold text-wd-red-800 underline underline-offset-2"
            >{{ l.label }} <ExternalLink class="w-3 h-3" /></a>
          </div>
          <div v-if="s.pages?.length" class="mt-3 flex flex-wrap gap-1.5">
            <NuxtLink
              v-for="p in s.pages" :key="p.url" :to="p.url"
              class="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-wd-red-800"
            >{{ p.label }}</NuxtLink>
          </div>
        </li>
      </ul>
    </section>
    <div class="h-10" />
    <SiteFooter />
  </div>
</template>

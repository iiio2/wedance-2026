<script setup lang="ts">
/**
 * Prototype — a new organizer's Business home right after sign-up. They've
 * created events but never made a flyer here. One clear next step: the flyer
 * for the soonest event, which opens the event editor (details first), then the
 * flyer. No backend; see docs/proposals/2026-10-12-flyer-journeys.md.
 */
import { Sparkles, ArrowRight, CalendarDays, Pencil, Wand2 } from 'lucide-vue-next'

const { ev, flyer, changes } = useSketchEvent()

definePageMeta({ layout: false })
useHead({ title: 'Prototype · First flyer | WeDance', meta: [{ name: 'robots', content: 'noindex' }] })

const later = [
  { date: 'Thu 22 Oct', name: 'La Clave Thursday', note: 'Weekly · same look as 15 Oct once it’s made' },
  { date: 'Sat 24 Oct', name: 'Salsea Saturday', note: 'No flyer yet' },
]
</script>

<template>
  <SketchBusinessShell active="home">
    <div class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Business</div>
    <h1 class="mt-1 font-display text-3xl font-bold">Welcome, La Clave en Múnich</h1>
    <p class="mt-1 text-sm text-muted-foreground">You’ve added 3 events. Let’s get the first one promoted.</p>

    <section class="mt-6 overflow-hidden rounded-2xl border-2 border-primary/30 bg-card shadow-wd-card">
      <div class="grid gap-0 sm:grid-cols-[1fr_180px]">
        <div class="p-5">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary">Your next event</p>
          <h2 class="mt-1 font-display text-2xl font-bold">{{ ev.name }}</h2>
          <p class="mt-1 text-sm text-muted-foreground">{{ ev.date }} · {{ ev.start }}–{{ ev.end }} · {{ ev.venue }}</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ ev.lineup.map(l => l.name).join(' · ') }}</p>
          <template v-if="!flyer.story">
            <p class="mt-4 text-sm">It has no flyer yet. Check the details, then make one in about a minute: an Instagram story, ready to post.</p>
            <Button variant="cta" class="mt-4" as-child>
              <NuxtLink to="/sketches/first-flyer/edit?flyer=1"><Sparkles /> Make its flyer</NuxtLink>
            </Button>
          </template>
          <template v-else-if="changes.length">
            <p class="mt-4 text-sm"><span class="font-bold">The flyer is out of date.</span> You changed the details after it was made.</p>
            <Button variant="cta" class="mt-4" as-child>
              <NuxtLink to="/sketches/first-flyer/edit"><Wand2 /> Review and refresh</NuxtLink>
            </Button>
          </template>
          <template v-else>
            <p class="mt-4 text-sm"><span class="font-bold text-wd-green-700">Flyer ready.</span> It matches the event.</p>
            <Button variant="outline-pill" class="mt-4" as-child>
              <NuxtLink to="/sketches/first-flyer/edit"><Pencil /> Open the event</NuxtLink>
            </Button>
          </template>
        </div>
        <div class="hidden items-center justify-center bg-muted p-4 sm:flex">
          <img v-if="flyer.story" :src="sketchImg(flyer.story, 300)" alt="The flyer" class="w-28 rounded-xl border" :class="changes.length ? 'opacity-60' : ''">
          <div v-else class="flex aspect-[9/16] w-28 items-center justify-center rounded-xl border-2 border-dashed border-input text-center text-xs text-muted-foreground">
            Your flyer<br>goes here
          </div>
        </div>
      </div>
    </section>

    <section class="mt-8">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Coming up</h2>
      <div class="mt-3 grid gap-2">
        <div v-for="e in later" :key="e.date + e.name" class="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <CalendarDays class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold">{{ e.name }}</p>
            <p class="text-xs text-muted-foreground">{{ e.date }} · {{ e.note }}</p>
          </div>
          <ArrowRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
    </section>
  </SketchBusinessShell>
</template>

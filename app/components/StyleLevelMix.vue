<script setup lang="ts">
/**
 * Organizer insight: the style & level mix of a festival's attendees (P726).
 * Styles = one-hue bars (share of attendees who listed a style). Levels are
 * ordinal, so they take a one-hue light→dark ramp (validated: monotone, light
 * end ≥ 2:1 on white) plus a striped neutral for "not set" — never color alone,
 * every segment also has a legend entry with its count.
 */
import { DANCE_LEVELS, type LevelCounts, type StyleLevelMix } from '#shared/utils/styleLevelMix'
import { chilis } from '~/lib/levels'

const props = defineProps<{ mix: StyleLevelMix }>()

const LEVEL_KEYS = [...DANCE_LEVELS, 'unknown'] as const
type LevelKey = typeof LEVEL_KEYS[number]

const LEVEL_FILL: Record<LevelKey, string> = {
  Beginner: '#eaa64a',
  Intermediate: '#b8651a',
  Advanced: '#6b330a',
  unknown: 'repeating-linear-gradient(45deg, #ddd5cb 0 4px, #efe9e1 4px 8px)',
}
const levelLabel = (k: LevelKey) => (k === 'unknown' ? 'Not set' : k)

// Long tails (one dancer each in ten styles) bury the signal — show the top ones.
const MAX_STYLES = 8
const shownStyles = computed(() => props.mix.styles.slice(0, MAX_STYLES))
const hiddenStyles = computed(() => props.mix.styles.length - shownStyles.value.length)

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)
const total = (l: LevelCounts) => LEVEL_KEYS.reduce((s, k) => s + l[k], 0)
const ratedCount = computed(() => total(props.mix.levels) - props.mix.levels.unknown)

function segments(l: LevelCounts) {
  const sum = total(l)
  return LEVEL_KEYS.filter(k => l[k] > 0).map(k => ({ key: k, count: l[k], pct: pct(l[k], sum) }))
}
function describe(l: LevelCounts) {
  return segments(l).map(s => `${levelLabel(s.key)} ${s.count}`).join(', ')
}
</script>

<template>
  <div class="grid gap-5 font-sans text-foreground">
    <!-- Base: who the percentages are out of -->
    <dl class="grid grid-cols-3 gap-3">
      <div class="rounded-2xl bg-card border p-4 border-border">
        <dt class="text-xs uppercase tracking-wider text-secondary">Attendees</dt>
        <dd class="mt-1 text-2xl font-bold">{{ mix.attendees }}</dd>
      </div>
      <div class="rounded-2xl bg-card border p-4 border-border">
        <dt class="text-xs uppercase tracking-wider text-secondary">Listed styles</dt>
        <dd class="mt-1 text-2xl font-bold">{{ mix.withStyles }}</dd>
      </div>
      <div class="rounded-2xl bg-card border p-4 border-border">
        <dt class="text-xs uppercase tracking-wider text-secondary">Set a level</dt>
        <dd class="mt-1 text-2xl font-bold">{{ ratedCount }}</dd>
      </div>
    </dl>

    <p v-if="mix.attendees === 0" class="text-sm rounded-2xl bg-card border p-5 border-border text-muted-foreground">
      Nobody has signed up yet. The mix fills in as dancers join on WeDance.
    </p>

    <template v-else>
      <p v-if="mix.attendees > mix.withProfile" class="text-xs text-muted-foreground">
        {{ mix.attendees - mix.withProfile }} ticket{{ mix.attendees - mix.withProfile === 1 ? '' : 's' }}
        not yet connected to a WeDance profile — not in the mix until claimed.
      </p>

      <!-- Styles -->
      <section class="rounded-2xl bg-card border p-5 border-border" aria-labelledby="mix-styles-title">
        <h3 id="mix-styles-title" class="text-lg font-bold font-display">Dance styles</h3>
        <p class="text-xs mt-0.5 text-muted-foreground">Share of the {{ mix.withStyles }} attendees who listed styles. Dancers often list several.</p>

        <p v-if="!shownStyles.length" class="mt-4 text-sm text-muted-foreground">No attendee has listed a dance style yet.</p>
        <ul v-else class="mt-4 grid gap-2.5">
          <li v-for="s in shownStyles" :key="s.style" class="grid grid-cols-[5.5rem_1fr_4.5rem] sm:grid-cols-[7rem_1fr_5.5rem] items-center gap-2 sm:gap-3 text-sm">
            <span class="truncate font-semibold" :title="s.style">
              {{ s.style }}<span v-if="s.isFestivalStyle" class="ml-1 text-eyebrow uppercase tracking-wider text-secondary">· yours</span>
            </span>
            <span class="h-3 rounded-r" style="background:color-mix(in srgb, var(--wd-brown-900) 5.1%, transparent);">
              <span
                class="block h-full rounded-r"
                :style="{ width: Math.max(s.share * 100, 1) + '%', background: 'var(--wd-red-600)' }"
                :title="`${s.style}: ${s.count} of ${mix.withStyles} (${pct(s.count, mix.withStyles)}%)`"
              />
            </span>
            <span class="text-right tabular-nums text-muted-foreground">{{ s.count }} · {{ pct(s.count, mix.withStyles) }}%</span>
          </li>
        </ul>
        <p v-if="hiddenStyles > 0" class="mt-2 text-xs text-muted-foreground">+ {{ hiddenStyles }} more style{{ hiddenStyles === 1 ? '' : 's' }} with fewer dancers</p>
      </section>

      <!-- Levels -->
      <section class="rounded-2xl bg-card border p-5 border-border" aria-labelledby="mix-levels-title">
        <h3 id="mix-levels-title" class="text-lg font-bold font-display">Skill levels</h3>
        <p class="text-xs mt-0.5 text-muted-foreground">
          Each dancer counted once, at their highest self-declared level in your festival's styles.
        </p>

        <ul class="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm" aria-label="Level legend">
          <li v-for="k in LEVEL_KEYS" :key="k" class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm" :style="{ background: LEVEL_FILL[k] }" aria-hidden="true" />
            <span>{{ k === 'unknown' ? 'Not set' : `${chilis(k)} ${k}` }}</span>
            <span class="tabular-nums font-semibold">{{ mix.levels[k] }}</span>
            <span class="tabular-nums text-muted-foreground">({{ pct(mix.levels[k], mix.withProfile) }}%)</span>
          </li>
        </ul>

        <div class="mt-3 flex h-5 gap-[2px]" role="img" :aria-label="`All attendees: ${describe(mix.levels)}`">
          <span
            v-for="seg in segments(mix.levels)"
            :key="seg.key"
            class="h-full first:rounded-l last:rounded-r"
            :style="{ width: seg.pct + '%', background: LEVEL_FILL[seg.key] }"
            :title="`${levelLabel(seg.key)}: ${seg.count} (${seg.pct}%)`"
          />
        </div>

        <p v-if="ratedCount === 0" class="mt-3 text-xs text-muted-foreground">
          No attendee has set a level yet — dancers add theirs per style in their WeDance settings.
        </p>

        <template v-if="shownStyles.length">
          <h4 class="mt-6 text-xs font-bold uppercase tracking-wider text-secondary">By style</h4>
          <ul class="mt-2 grid gap-2.5">
            <li v-for="s in shownStyles" :key="s.style" class="grid grid-cols-[5.5rem_1fr] sm:grid-cols-[7rem_1fr] items-center gap-2 sm:gap-3 text-sm">
              <span class="truncate font-semibold" :title="s.style">{{ s.style }}</span>
              <div class="flex h-3 gap-[2px]" role="img" :aria-label="`${s.style}: ${describe(s.levels)}`">
                <span
                  v-for="seg in segments(s.levels)"
                  :key="seg.key"
                  class="h-full first:rounded-l last:rounded-r"
                  :style="{ width: seg.pct + '%', background: LEVEL_FILL[seg.key] }"
                  :title="`${s.style} · ${levelLabel(seg.key)}: ${seg.count} (${seg.pct}%)`"
                />
              </div>
            </li>
          </ul>
        </template>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * City-vs-city video battle — the tier above per-city voting.
 *
 * Shows two cities' champion clips (each the current month's highest-ELO
 * approved video, or its best-ever when the month is too thin) head to head;
 * you vote for a CITY, not a video. Votes tally
 * into the "Top dance cities" leaderboard below. Client-only (the tRPC client
 * uses a relative URL that throws under SSR), and guarded: when fewer than two
 * cities have a champion the whole widget collapses to nothing.
 */
import { Swords, Play, Trophy } from 'lucide-vue-next'
import { parseVideoUrl } from '~/lib/videoEmbed'
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import { readableOn } from '~/lib/contrast'

const { $trpc } = useNuxtApp()

interface Champion {
  citySlug: string; city: string; videoId: string; title: string
  videoUrl: string; thumbnailUrl: string | null; danceStyle: string | null; eloScore: number
}
type LeaderRow = { citySlug: string; city: string; wins: number; losses: number; battles: number; winRate: number }

const matchup = ref<{ a: Champion; b: Champion } | null>(null)
const leaderboard = ref<LeaderRow[]>([])
const loading = ref(true)
const voting = ref(false)
const end = ref<null | 'capped' | 'exhausted' | 'not_enough_cities'>(null)
const activeEmbed = ref<string | null>(null)
const accents = [WD.red600, WD.cyan600] as const

async function loadMatchup() {
  activeEmbed.value = null
  try {
    const res = await $trpc.cityVideo.battleMatchup.query()
    if (res.matchup) { matchup.value = { a: res.matchup.a, b: res.matchup.b }; end.value = null }
    else { matchup.value = null; end.value = (res.reason ?? 'exhausted') as typeof end.value }
  } catch { matchup.value = null; end.value = 'not_enough_cities' }
}
async function loadLeaderboard() {
  try { leaderboard.value = (await $trpc.cityVideo.cityLeaderboard.query({ limit: 8 })).cities }
  catch { leaderboard.value = [] }
}

async function voteCity(winner: Champion, loser: Champion) {
  if (voting.value) return
  voting.value = true
  try {
    await $trpc.cityVideo.battleVote.mutate({
      winnerCitySlug: winner.citySlug, loserCitySlug: loser.citySlug,
      winnerVideoId: winner.videoId, loserVideoId: loser.videoId,
    })
    useTrack().track('city_battle_vote', { winner: winner.citySlug, loser: loser.citySlug })
    await Promise.all([loadMatchup(), loadLeaderboard()])
  } catch { await loadMatchup() }
  finally { voting.value = false }
}

const embed = (v: Champion) => parseVideoUrl(v.videoUrl)
const rankColor = (i: number) => [WD.amber500, '#9ca3af', WD.amber700][i] ?? WD.amber600

onMounted(async () => {
  await Promise.all([loadMatchup(), loadLeaderboard()])
  loading.value = false
})

// Collapse entirely when there's genuinely nothing to show (no matchup and an
// empty leaderboard) — never leave a blank block at the top of the page.
const collapsed = computed(() => !loading.value && !matchup.value && !leaderboard.value.length)
</script>

<template>
  <section v-if="!collapsed" class="max-w-4xl mx-auto px-4 py-10">
    <div class="text-center mb-6">
      <div class="inline-flex items-center gap-2 text-meta uppercase tracking-[0.3em] font-bold text-primary font-sans">
        <Swords class="w-4 h-4" /> City battle
      </div>
      <h2 class="text-2xl sm:text-3xl mt-1 font-display text-foreground">
        Which city <em class="italic text-primary">wins?</em>
      </h2>
      <p class="text-xs mt-1 text-secondary font-hand" style="font-size:16px;">
        — vote the winning clips, city vs city
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-2 gap-3 sm:gap-5">
      <div v-for="i in 2" :key="i" class="aspect-video rounded-2xl animate-pulse bg-wd-brown-900/[5.1%]" />
    </div>

    <!-- Matchup -->
    <div v-else-if="matchup" class="grid grid-cols-2 gap-3 sm:gap-5 items-stretch relative">
      <div
        v-for="(f, i) in [matchup.a, matchup.b]"
        :key="f.citySlug"
        class="rounded-2xl overflow-hidden bg-white border flex flex-col"
        :style="{ borderColor: accents[i] + '55', boxShadow: '0 8px 22px rgba(59,31,18,0.06)' }"
      >
        <div class="relative aspect-video bg-wd-brown-900">
          <iframe
            v-if="activeEmbed === f.videoId && embed(f).embedUrl"
            :src="embed(f).embedUrl!"
            class="absolute inset-0 h-full w-full" frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen
          />
          <Button v-else type="button" variant="ghost" class="absolute inset-0 block h-full w-full p-0 rounded-none font-normal whitespace-normal hover:bg-transparent [&_svg]:size-5" :aria-label="`Play the ${f.city} winning clip`" @click="embed(f).embedUrl ? (activeEmbed = f.videoId) : window.open(f.videoUrl, '_blank')">
            <img v-if="embed(f).thumbnailUrl" :src="embed(f).thumbnailUrl!" :alt="`${f.city} — winning clip`" class="absolute inset-0 w-full h-full object-cover" loading="lazy">
            <div class="absolute inset-0" style="background:linear-gradient(180deg, rgba(59,31,18,0) 40%, rgba(59,31,18,0.72) 100%);" />
            <span class="absolute inset-0 flex items-center justify-center">
              <span class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg">
                <Play class="h-5 w-5 translate-x-0.5" :style="{ color: accents[i] }" fill="currentColor" aria-hidden="true" />
              </span>
            </span>
            <span class="absolute bottom-2 left-3 right-3 text-left">
              <span class="block font-bold text-lg sm:text-xl leading-tight text-white font-display" style="text-shadow:0 1px 12px rgba(0,0,0,0.4);">{{ f.city }}</span>
              <span v-if="f.danceStyle" class="block text-meta text-white/85 font-sans">{{ f.danceStyle }}</span>
            </span>
          </Button>
        </div>
        <Button
          type="button" variant="pill" :accent="readableOn(accents[i])" :disabled="voting"
          class="m-3 mt-3 gap-1.5"
          @click="voteCity(f, [matchup.a, matchup.b][i === 0 ? 1 : 0])"
        >Vote {{ f.city }}</Button>
      </div>

      <div class="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div class="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-sm bg-wd-brown-900 font-display" style="box-shadow:0 4px 0 -1px #1f0f06, 0 6px 18px rgba(0,0,0,0.25);">VS</div>
      </div>
    </div>

    <!-- End states (matchup exhausted / capped) — leaderboard still shows below -->
    <div v-else class="rounded-2xl border-2 border-dashed p-5 text-center border-input bg-white/50">
      <p class="text-sm font-bold text-foreground font-display">
        {{ end === 'capped' ? "That's a lot of voting — thank you!" : "You've voted every matchup. Here's the standings." }}
      </p>
    </div>

    <!-- Top dance cities leaderboard -->
    <div v-if="leaderboard.length" class="mt-8">
      <div class="flex items-center gap-2 mb-3">
        <Trophy class="w-4 h-4 text-warning" />
        <h3 class="text-lg font-hand text-foreground">Top dance cities <span class="text-xs text-secondary font-display" style="font-size:15px;">— this month</span></h3>
      </div>
      <ol class="space-y-1.5">
        <li
          v-for="(c, i) in leaderboard" :key="c.citySlug"
          class="flex items-center gap-3 rounded-xl bg-white border px-3 py-2 border-wd-brown-900/[10.2%]"
          style="box-shadow:0 1px 0 rgba(59,31,18,0.03);"
        >
          <span class="w-6 text-center font-black text-sm" :style="{ color: rankColor(i) }">{{ i + 1 }}</span>
          <NuxtLink :to="`/cities/${c.citySlug}`" class="flex-1 font-bold text-sm hover:underline text-foreground font-display">{{ c.city }}</NuxtLink>
          <span class="text-xs font-bold text-success font-sans">{{ c.wins }}W</span>
          <span class="text-meta text-secondary font-sans">{{ Math.round(c.winRate * 100) }}%</span>
        </li>
      </ol>
    </div>
  </section>
</template>

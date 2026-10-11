<script setup lang="ts">
/**
 * /find-your-dance — a short feeling-based quiz that matches beginners to a
 * dance style without using any dance jargon, plus quick-pick cards and a
 * taster-class CTA for those who want to skip the quiz.
 *
 * RAZ-46 — Dance-Match Quiz
 */
import { ArrowRight, Sparkles, RotateCcw } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Find your dance',
})

/* ------------------------------------------------------------------ */
/*  Quiz data                                                          */
/* ------------------------------------------------------------------ */

type StyleKey = 'salsa' | 'bachata' | 'kizomba'

interface QuizOption {
  text: string
  scores: Record<StyleKey, number>
}

interface QuizQuestion {
  question: string
  options: QuizOption[]
}

const questions: QuizQuestion[] = [
  {
    question: 'It\'s Friday night — what sounds best?',
    options: [
      { text: 'A packed party with non-stop energy', scores: { salsa: 3, bachata: 1, kizomba: 0 } },
      { text: 'A cosy evening with someone special', scores: { salsa: 0, bachata: 3, kizomba: 1 } },
      { text: 'A candlelit lounge with deep conversation', scores: { salsa: 0, bachata: 1, kizomba: 3 } },
    ],
  },
  {
    question: 'Pick a playlist vibe:',
    options: [
      { text: 'Upbeat, feel-good, makes me move', scores: { salsa: 3, bachata: 0, kizomba: 1 } },
      { text: 'Romantic ballads with a groove', scores: { salsa: 0, bachata: 3, kizomba: 1 } },
      { text: 'Smooth R&B and slow jams', scores: { salsa: 0, bachata: 1, kizomba: 3 } },
    ],
  },
  {
    question: 'When you move, what feels most natural?',
    options: [
      { text: 'Quick footwork and playful spins', scores: { salsa: 3, bachata: 0, kizomba: 0 } },
      { text: 'Flowing side-to-side, like waves', scores: { salsa: 0, bachata: 3, kizomba: 1 } },
      { text: 'Slow, grounded steps — less is more', scores: { salsa: 0, bachata: 0, kizomba: 3 } },
    ],
  },
  {
    question: 'What does "connection" mean to you?',
    options: [
      { text: 'Fun energy shared with a big group', scores: { salsa: 3, bachata: 1, kizomba: 0 } },
      { text: 'A heartfelt moment with one person', scores: { salsa: 0, bachata: 3, kizomba: 1 } },
      { text: 'An unspoken understanding — no words needed', scores: { salsa: 0, bachata: 0, kizomba: 3 } },
    ],
  },
  {
    question: 'Pick a travel destination:',
    options: [
      { text: 'Havana — colourful streets, live music everywhere', scores: { salsa: 3, bachata: 0, kizomba: 1 } },
      { text: 'Santo Domingo — warm nights, ocean breeze', scores: { salsa: 1, bachata: 3, kizomba: 0 } },
      { text: 'Lisbon — cobblestone alleys, soulful fado', scores: { salsa: 0, bachata: 0, kizomba: 3 } },
    ],
  },
]

const styleResults: Record<StyleKey, { name: string; tagline: string; accent: string }> = {
  salsa: { name: 'Salsa', tagline: 'Fast, social, everywhere. Your energy lights up the room.', accent: WD.red600 },
  bachata: { name: 'Bachata', tagline: 'Close, romantic, easy to start. You lead with your heart.', accent: WD.purple500 },
  kizomba: { name: 'Kizomba', tagline: 'Slow, grounded, deeply connected. You speak in silence.', accent: WD.cyan600 },
}

/* ------------------------------------------------------------------ */
/*  Quiz state                                                         */
/* ------------------------------------------------------------------ */

const currentStep = ref(0)
const answers = ref<number[]>([])
const showResult = ref(false)

const progress = computed(() =>
  Math.round((answers.value.length / questions.length) * 100),
)

function pickAnswer(optionIndex: number) {
  answers.value = [...answers.value.slice(0, currentStep.value), optionIndex]

  if (currentStep.value < questions.length - 1) {
    currentStep.value++
  }
  else {
    showResult.value = true
  }
}

function goBack() {
  if (currentStep.value > 0) {
    currentStep.value--
    showResult.value = false
  }
}

const resultStyle = computed<StyleKey>(() => {
  const totals: Record<StyleKey, number> = { salsa: 0, bachata: 0, kizomba: 0 }

  answers.value.forEach((optIdx, qIdx) => {
    const scores = questions[qIdx].options[optIdx].scores
    for (const key of Object.keys(scores) as StyleKey[]) {
      totals[key] += scores[key]
    }
  })

  return (Object.entries(totals) as [StyleKey, number][])
    .sort((a, b) => b[1] - a[1])[0][0]
})

function restart() {
  currentStep.value = 0
  answers.value = []
  showResult.value = false
}

/* ------------------------------------------------------------------ */
/*  Quick picks (below the quiz)                                       */
/* ------------------------------------------------------------------ */

const quickPicks = [
  { style: 'Salsa', blurb: 'Fast, social, everywhere.', accent: WD.red600 },
  { style: 'Bachata', blurb: 'Close, romantic, easy start.', accent: WD.purple500 },
  { style: 'Kizomba', blurb: 'Slow, grounded, connected.', accent: WD.cyan600 },
]
</script>

<template>
  <div class="min-h-screen" style="background:var(--wd-cream); color:var(--wd-brown-900); font-family:var(--wd-font-display);">
    <SiteHeader />

    <section class="max-w-3xl mx-auto px-4 pt-14 pb-8 text-center">
      <div class="text-sm tracking-widest uppercase mb-3" style="color:var(--wd-amber-600);">Find your dance</div>
      <h1 class="text-5xl sm:text-6xl leading-[0.98]" style="color:var(--wd-brown-900);">
        Not sure where <em class="italic" style="color:var(--wd-red-600);">to start?</em>
      </h1>
      <p class="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto" style="color:var(--wd-brown-700);">
        Answer five quick questions — no dance knowledge needed — and we'll match you to a style that fits how you feel.
      </p>
    </section>

    <!-- Quiz section -->
    <section class="max-w-2xl mx-auto px-4 pb-12" data-testid="dance-quiz">
      <!-- Progress bar -->
      <div v-if="!showResult" class="mb-6">
        <div class="flex items-center justify-between text-xs mb-1.5" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          <span>Question {{ currentStep + 1 }} of {{ questions.length }}</span>
          <span>{{ progress }}%</span>
        </div>
        <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--wd-sand-100, #ede4d3);">
          <div
            class="h-full rounded-full transition-all duration-300"
            :style="{ width: progress + '%', background: WD.red600 }"
          />
        </div>
      </div>

      <!-- Question -->
      <div v-if="!showResult" :key="currentStep" data-testid="quiz-question">
        <h2
          class="text-2xl sm:text-3xl mb-6 text-center"
          style="color:var(--wd-brown-900);"
        >
          {{ questions[currentStep].question }}
        </h2>

        <div class="grid gap-3">
          <button
            v-for="(opt, idx) in questions[currentStep].options"
            :key="idx"
            :data-testid="`quiz-option-${idx}`"
            class="group rounded-2xl bg-white border px-5 py-4 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
            :class="answers[currentStep] === idx ? 'ring-2' : ''"
            :style="{
              borderColor: answers[currentStep] === idx ? WD.red600 : WD.brown700 + '22',
              ringColor: WD.red600,
              boxShadow: '0 1px 0 rgba(59,31,18,0.04), 0 4px 14px rgba(59,31,18,0.04)',
            }"
            @click="pickAnswer(idx)"
          >
            <span class="text-base sm:text-lg" style="font-family:var(--wd-font-sans); color:var(--wd-brown-900);">
              {{ opt.text }}
            </span>
          </button>
        </div>

        <!-- Back button -->
        <div v-if="currentStep > 0" class="mt-4 text-center">
          <button
            class="text-sm underline cursor-pointer"
            style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);"
            data-testid="quiz-back"
            @click="goBack"
          >
            Back
          </button>
        </div>
      </div>

      <!-- Result -->
      <div v-if="showResult" data-testid="quiz-result" class="text-center">
        <div class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-4" :style="{ background: styleResults[resultStyle].accent + '14', color: styleResults[resultStyle].accent }">
          <Sparkles class="w-4 h-4" /> Your match
        </div>

        <h2
          class="text-5xl sm:text-6xl font-black mb-3"
          :style="{ color: styleResults[resultStyle].accent }"
        >
          {{ styleResults[resultStyle].name }}
        </h2>

        <p class="text-lg mb-8 max-w-md mx-auto" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          {{ styleResults[resultStyle].tagline }}
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
          <NuxtLink
            :to="`/cities?style=${styleResults[resultStyle].name}`"
            data-testid="quiz-find-classes"
            class="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90"
            :style="{ background: styleResults[resultStyle].accent }"
          >
            Find {{ styleResults[resultStyle].name }} classes <ArrowRight class="w-4 h-4" />
          </NuxtLink>

          <button
            class="inline-flex items-center gap-1.5 text-sm underline cursor-pointer"
            style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);"
            data-testid="quiz-restart"
            @click="restart"
          >
            <RotateCcw class="w-3.5 h-3.5" /> Take it again
          </button>
        </div>
      </div>
    </section>

    <!-- Divider -->
    <div class="max-w-3xl mx-auto px-4">
      <hr style="border-color:var(--wd-sand-100, #ede4d3);" />
    </div>

    <!-- Quick picks (already know what you want) -->
    <section class="max-w-3xl mx-auto px-4 pt-10 pb-4 text-center">
      <p class="text-sm tracking-widest uppercase mb-5" style="color:var(--wd-amber-600);">
        Already know your vibe?
      </p>
    </section>

    <section class="max-w-3xl mx-auto px-4 pb-16">
      <div class="grid gap-4 sm:grid-cols-3">
        <NuxtLink
          v-for="p in quickPicks"
          :key="p.style"
          :to="`/cities?style=${p.style}`"
          :data-testid="`quick-pick-${p.style.toLowerCase()}`"
          class="group rounded-2xl bg-white border p-6 text-center transition-all hover:-translate-y-1"
          :style="{ borderColor: p.accent + '55', boxShadow: '0 1px 0 ' + p.accent + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
        >
          <div class="text-2xl font-black" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">{{ p.style }}</div>
          <div class="mt-1 text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">{{ p.blurb }}</div>
          <div class="mt-4 inline-flex items-center gap-1 text-xs font-bold italic" :style="{ color: p.accent }">
            Find classes <ArrowRight class="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </NuxtLink>
      </div>

      <!-- P1006: the low-pressure way in — no style to pick, just find a class to try once. -->
      <NuxtLink
        to="/cities?taster=1"
        data-testid="taster-cta"
        class="group mt-8 block rounded-2xl border border-dashed px-5 py-4 text-center transition-all hover:-translate-y-0.5"
        style="border-color:color-mix(in srgb, var(--wd-amber-600) 40%, transparent); background:rgba(255,255,255,0.55);"
      >
        <span class="block" style="color:var(--wd-amber-600); font-family:var(--wd-font-display);font-style:italic; font-size:22px; line-height:1.2;">
          — or just <span class="underline decoration-dotted underline-offset-4" style="color:var(--wd-green-600);">try a free taster class</span> and see what sticks.
          <ArrowRight class="inline w-4 h-4 align-middle transition-transform group-hover:translate-x-1" style="color:var(--wd-green-600);" />
        </span>
        <span class="mt-1 block text-xs" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          No style to pick, no commitment. Turn up once and see how it feels.
        </span>
      </NuxtLink>
    </section>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
/**
 * Sketch: "Report a problem" → co-creation widget.
 *
 * Today's widget is bug-only: describe what's wrong, we screenshot and file.
 * The ask: when people open it, show them they can also share ideas and
 * co-create — agents sketch it, email the result, they pick, we ship.
 *
 * Three variants:
 *   A — Hub with two paths (choice screen before the form)
 *   B — Tabbed dialog (tabs toggle bug report vs idea)
 *   C — Recommended: Unified form with type chips + pipeline preview
 */
import {
  Bug, Lightbulb, Check, ImageIcon, Send, Sparkles, Mail, Palette,
  Rocket, ArrowRight, X, MessageSquare,
} from 'lucide-vue-next'

definePageMeta({ layout: false })
useHead({ title: 'WeDance — Report / co-create sketch', meta: [{ name: 'robots', content: 'noindex' }] })

type Variant = 'A' | 'B' | 'C'
const VARIANTS: { id: Variant, name: string, idea: string, good: string, cost: string }[] = [
  {
    id: 'A',
    name: 'Hub with two paths',
    idea: 'A choice screen appears first: "Report a problem" or "Share an idea". Each path leads to its own form. The idea path explains the co-creation pipeline.',
    good: 'Clear separation. People who came to report a bug aren\'t slowed down. The idea path gets a dedicated landing that sells the co-creation story.',
    cost: 'One extra click for everyone. Two separate forms to maintain.',
  },
  {
    id: 'B',
    name: 'Tabbed dialog',
    idea: 'The dialog opens with two tabs: Bug report (today\'s form) and Idea (new co-creation form). Default tab depends on context.',
    good: 'Familiar tab pattern. Both paths are always visible. No extra click if you pick the default tab.',
    cost: 'The co-creation story is squeezed into a tab — less room to explain the pipeline.',
  },
  {
    id: 'C',
    name: 'Recommended: Unified + pipeline',
    idea: 'One form with type chips at the top (Bug / Idea / Question). When "Idea" is selected, a visual pipeline preview appears below the form showing what happens next.',
    good: 'Minimal UI change. The pipeline preview excites people ("agents will sketch this?!"). One form, one submit — simpler code.',
    cost: 'The form is slightly taller when Idea is selected. Chip labels need to be clear at a glance.',
  },
]

const variant = ref<Variant>('C')
const current = computed(() => VARIANTS.find(v => v.id === variant.value)!)

// Shared mock state
const signedIn = ref(true)
const description = ref('')
const email = ref('')
const hasScreenshot = ref(true)
const submitted = ref(false)

// A: Hub
const hubChoice = ref<'bug' | 'idea' | null>(null)

// B: Tabs
const activeTab = ref<'bug' | 'idea'>('bug')

// C: Type chips
type FeedbackType = 'bug' | 'idea' | 'question'
const feedbackType = ref<FeedbackType>('idea')

// Reset on variant change
watch(variant, () => {
  description.value = ''
  email.value = ''
  submitted.value = false
  hubChoice.value = null
  activeTab.value = 'bug'
  feedbackType.value = 'idea'
})

function mockSubmit() {
  submitted.value = true
}
function reset() {
  description.value = ''
  email.value = ''
  submitted.value = false
  hubChoice.value = null
}

const PLACEHOLDERS: Record<string, string> = {
  bug: 'e.g. I clicked \'Save my plan\' and nothing happened\u2026',
  idea: 'e.g. It would be great if I could filter festivals by dance style and see who from my friends is going\u2026',
  question: 'e.g. How do I add my event to the calendar?',
}

const PIPELINE_STEPS = [
  { icon: MessageSquare, label: 'You describe your idea', color: 'text-primary' },
  { icon: Sparkles, label: 'Our agents build a sketch', color: 'text-secondary' },
  { icon: Mail, label: 'You get an email with options', color: 'text-wd-green-700' },
  { icon: Palette, label: 'You pick what you like', color: 'text-wd-amber-600' },
  { icon: Rocket, label: 'We build and ship it', color: 'text-primary' },
]
</script>

<template>
  <div class="min-h-screen bg-muted/40 text-foreground">
    <!-- Sketch controls -->
    <div class="sticky top-0 z-[60] border-b border-border bg-card/95 backdrop-blur">
      <div class="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">Report / co-create</span>
        <div class="flex rounded-full border border-border p-0.5 bg-background">
          <button
            v-for="v in VARIANTS" :key="v.id"
            class="px-3 h-8 rounded-full text-sm font-bold transition-colors"
            :class="variant === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="variant = v.id"
          >{{ v.id }}</button>
        </div>
        <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
          <input v-model="signedIn" type="checkbox" class="accent-[var(--color-primary)]">
          Signed in
        </label>
        <button class="ml-auto text-xs font-bold text-primary underline underline-offset-2" @click="reset">Reset</button>
      </div>
      <div class="max-w-6xl mx-auto px-4 pb-3 grid sm:grid-cols-[1.2fr_1fr_1fr] gap-3 text-xs">
        <p><span class="font-display text-base font-bold block">{{ current.id }} · {{ current.name }}</span>{{ current.idea }}</p>
        <p><span class="font-bold text-green-700 block uppercase tracking-wider">Good</span>{{ current.good }}</p>
        <p><span class="font-bold text-primary block uppercase tracking-wider">Cost</span>{{ current.cost }}</p>
      </div>
    </div>

    <!-- Mock page behind the dialog -->
    <div class="py-10 px-4 flex justify-center">
      <div class="relative bg-background w-full max-w-md min-h-[640px] rounded-xl shadow-xl border border-border overflow-hidden">
        <!-- Faux page content (greyed out) -->
        <div class="p-6 opacity-30 pointer-events-none select-none">
          <div class="h-8 w-32 rounded bg-muted mb-4" />
          <div class="h-4 w-full rounded bg-muted mb-2" />
          <div class="h-4 w-3/4 rounded bg-muted mb-2" />
          <div class="h-4 w-5/6 rounded bg-muted mb-6" />
          <div class="h-40 w-full rounded-xl bg-muted mb-4" />
          <div class="h-4 w-2/3 rounded bg-muted mb-2" />
          <div class="h-4 w-1/2 rounded bg-muted" />
        </div>

        <!-- Overlay scrim -->
        <div class="absolute inset-0 bg-foreground/40" />

        <!-- ═══════════ A · Hub with two paths ═══════════ -->
        <div v-if="variant === 'A'" class="absolute inset-0 flex items-center justify-center p-4">
          <div class="w-full max-w-sm rounded-2xl bg-background shadow-2xl border border-border overflow-hidden">
            <div class="h-1.5 bg-primary" />
            <div class="p-6">
              <!-- Success -->
              <template v-if="submitted">
                <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">Thank you</div>
                <h2 class="font-display text-2xl mt-1">{{ hubChoice === 'idea' ? 'Idea received' : 'Report sent' }} <span aria-hidden="true">🎉</span></h2>
                <p class="text-sm text-muted-foreground mt-2">
                  <template v-if="hubChoice === 'idea'">
                    Our team will sketch it and email you the options. You pick what you like — we build it.
                  </template>
                  <template v-else>
                    Our team has it, complete with a screenshot and technical details.
                  </template>
                </p>
                <button class="mt-5 w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm" @click="reset">
                  <Check class="inline w-4 h-4 -mt-0.5 mr-1" /> Done
                </button>
              </template>

              <!-- Hub choice -->
              <template v-else-if="!hubChoice">
                <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">How can we help?</div>
                <h2 class="font-display text-2xl mt-1">Talk to us</h2>
                <p class="text-sm text-muted-foreground mt-2">
                  This is an open-source project. You don't need to be a developer to shape it.
                </p>
                <div class="mt-5 space-y-3">
                  <button
                    class="w-full flex items-start gap-3 rounded-2xl border border-border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    @click="hubChoice = 'bug'"
                  >
                    <Bug class="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p class="font-bold text-sm">Report a problem</p>
                      <p class="text-xs text-muted-foreground mt-0.5">Something's broken or doesn't work as expected.</p>
                    </div>
                  </button>
                  <button
                    class="w-full flex items-start gap-3 rounded-2xl border border-border p-4 text-left hover:border-secondary/40 hover:bg-secondary/5 transition-colors"
                    @click="hubChoice = 'idea'"
                  >
                    <Lightbulb class="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                    <div>
                      <p class="font-bold text-sm">Share an idea</p>
                      <p class="text-xs text-muted-foreground mt-0.5">Tell us what you'd love to see. Our agents will sketch it — no coding needed.</p>
                    </div>
                  </button>
                </div>
              </template>

              <!-- Bug form (same as today) -->
              <template v-else-if="hubChoice === 'bug'">
                <button class="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1" @click="hubChoice = null">
                  <span>&larr;</span> Back
                </button>
                <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">Help us improve</div>
                <h2 class="font-display text-2xl mt-1">Report a problem</h2>
                <p class="text-sm text-muted-foreground mt-1">
                  Tell us what went wrong. We'll attach a screenshot and technical details.
                </p>
                <div class="space-y-3 mt-4">
                  <div>
                    <label class="text-sm font-semibold block mb-1">What happened? <span class="text-primary">*</span></label>
                    <textarea v-model="description" rows="3" :placeholder="PLACEHOLDERS.bug" class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div v-if="!signedIn">
                    <label class="text-sm font-semibold block mb-1">Email <span class="text-muted-foreground font-normal">(optional)</span></label>
                    <input v-model="email" type="email" placeholder="you@example.com" class="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  </div>
                  <div class="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs bg-card border border-border text-muted-foreground">
                    <ImageIcon class="w-4 h-4 shrink-0" :class="hasScreenshot ? 'text-success' : 'text-secondary'" />
                    <span class="flex-1">{{ hasScreenshot ? 'Screenshot of this page attached.' : 'No screenshot captured.' }}</span>
                  </div>
                  <button class="w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm" @click="mockSubmit">
                    <Send class="inline w-4 h-4 -mt-0.5 mr-1" /> Send report
                  </button>
                </div>
              </template>

              <!-- Idea form -->
              <template v-else>
                <button class="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1" @click="hubChoice = null">
                  <span>&larr;</span> Back
                </button>
                <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">Co-create with us</div>
                <h2 class="font-display text-2xl mt-1">Share an idea</h2>
                <p class="text-sm text-muted-foreground mt-1">
                  Describe what you'd like. Our agents will build a sketch and email you options to choose from.
                </p>
                <div class="space-y-3 mt-4">
                  <div>
                    <label class="text-sm font-semibold block mb-1">What would you love to see? <span class="text-primary">*</span></label>
                    <textarea v-model="description" rows="4" :placeholder="PLACEHOLDERS.idea" class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div v-if="!signedIn">
                    <label class="text-sm font-semibold block mb-1">Email <span class="text-primary">*</span></label>
                    <input v-model="email" type="email" placeholder="you@example.com" class="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <p class="text-xs text-muted-foreground mt-1">So we can send you the sketch options.</p>
                  </div>
                  <!-- Pipeline preview -->
                  <div class="rounded-2xl border border-secondary/30 bg-secondary/5 p-3">
                    <p class="text-xs font-bold text-secondary uppercase tracking-wider mb-2">What happens next</p>
                    <ol class="space-y-2">
                      <li v-for="(step, i) in PIPELINE_STEPS" :key="i" class="flex items-center gap-2 text-xs">
                        <span class="w-5 h-5 rounded-full bg-background border border-border grid place-items-center text-[10px] font-bold text-muted-foreground shrink-0">{{ i + 1 }}</span>
                        <component :is="step.icon" class="w-3.5 h-3.5 shrink-0" :class="step.color" />
                        <span>{{ step.label }}</span>
                      </li>
                    </ol>
                  </div>
                  <button class="w-full h-11 rounded-full bg-secondary text-secondary-foreground font-bold text-sm" @click="mockSubmit">
                    <Sparkles class="inline w-4 h-4 -mt-0.5 mr-1" /> Send idea
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- ═══════════ B · Tabbed dialog ═══════════ -->
        <div v-if="variant === 'B'" class="absolute inset-0 flex items-center justify-center p-4">
          <div class="w-full max-w-sm rounded-2xl bg-background shadow-2xl border border-border overflow-hidden">
            <div class="h-1.5 bg-primary" />
            <div class="p-6">
              <!-- Success -->
              <template v-if="submitted">
                <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">Thank you</div>
                <h2 class="font-display text-2xl mt-1">{{ activeTab === 'idea' ? 'Idea received' : 'Report sent' }} <span aria-hidden="true">🎉</span></h2>
                <p class="text-sm text-muted-foreground mt-2">
                  <template v-if="activeTab === 'idea'">
                    Our team will sketch it and email you the options. Pick what you like — we ship it.
                  </template>
                  <template v-else>
                    Our team has it, complete with a screenshot and technical details.
                  </template>
                </p>
                <button class="mt-5 w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm" @click="reset">
                  <Check class="inline w-4 h-4 -mt-0.5 mr-1" /> Done
                </button>
              </template>

              <template v-else>
                <!-- Tabs -->
                <div class="flex rounded-full border border-border p-0.5 bg-muted mb-4">
                  <button
                    class="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-sm font-semibold transition-colors"
                    :class="activeTab === 'bug' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
                    @click="activeTab = 'bug'; description = ''"
                  >
                    <Bug class="w-4 h-4" /> Report a bug
                  </button>
                  <button
                    class="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-sm font-semibold transition-colors"
                    :class="activeTab === 'idea' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
                    @click="activeTab = 'idea'; description = ''"
                  >
                    <Lightbulb class="w-4 h-4" /> Share an idea
                  </button>
                </div>

                <!-- Bug tab -->
                <template v-if="activeTab === 'bug'">
                  <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">Help us improve</div>
                  <h2 class="font-display text-2xl mt-1">Report a problem</h2>
                  <p class="text-sm text-muted-foreground mt-1">
                    Tell us what went wrong. We'll attach a screenshot and technical details.
                  </p>
                  <div class="space-y-3 mt-4">
                    <div>
                      <label class="text-sm font-semibold block mb-1">What happened? <span class="text-primary">*</span></label>
                      <textarea v-model="description" rows="3" :placeholder="PLACEHOLDERS.bug" class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div v-if="!signedIn">
                      <label class="text-sm font-semibold block mb-1">Email <span class="text-muted-foreground font-normal">(optional)</span></label>
                      <input v-model="email" type="email" placeholder="you@example.com" class="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    </div>
                    <div class="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs bg-card border border-border text-muted-foreground">
                      <ImageIcon class="w-4 h-4 shrink-0" :class="hasScreenshot ? 'text-success' : 'text-secondary'" />
                      <span class="flex-1">{{ hasScreenshot ? 'Screenshot of this page attached.' : 'No screenshot captured.' }}</span>
                    </div>
                    <button class="w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm" @click="mockSubmit">
                      <Send class="inline w-4 h-4 -mt-0.5 mr-1" /> Send report
                    </button>
                  </div>
                </template>

                <!-- Idea tab -->
                <template v-else>
                  <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">Co-create with us</div>
                  <h2 class="font-display text-2xl mt-1">Share an idea</h2>
                  <p class="text-sm text-muted-foreground mt-1">
                    This is open source. You don't need to code — just describe what you'd love, and our agents will sketch it.
                  </p>
                  <div class="space-y-3 mt-4">
                    <div>
                      <label class="text-sm font-semibold block mb-1">What would you love to see? <span class="text-primary">*</span></label>
                      <textarea v-model="description" rows="4" :placeholder="PLACEHOLDERS.idea" class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div v-if="!signedIn">
                      <label class="text-sm font-semibold block mb-1">Email <span class="text-primary">*</span></label>
                      <input v-model="email" type="email" placeholder="you@example.com" class="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <p class="text-xs text-muted-foreground mt-1">So we can send you the sketch options.</p>
                    </div>
                    <div class="rounded-2xl border border-secondary/30 bg-secondary/5 p-3">
                      <p class="text-xs font-bold text-secondary uppercase tracking-wider mb-2">What happens next</p>
                      <div class="flex items-center gap-1 text-xs text-muted-foreground">
                        <span v-for="(step, i) in PIPELINE_STEPS" :key="i" class="flex items-center gap-1">
                          <component :is="step.icon" class="w-3.5 h-3.5 shrink-0" :class="step.color" />
                          <span class="hidden sm:inline">{{ step.label.split(' ').slice(0, 2).join(' ') }}</span>
                          <ArrowRight v-if="i < PIPELINE_STEPS.length - 1" class="w-3 h-3 text-border" />
                        </span>
                      </div>
                    </div>
                    <button class="w-full h-11 rounded-full bg-secondary text-secondary-foreground font-bold text-sm" @click="mockSubmit">
                      <Sparkles class="inline w-4 h-4 -mt-0.5 mr-1" /> Send idea
                    </button>
                  </div>
                </template>
              </template>
            </div>
          </div>
        </div>

        <!-- ═══════════ C · Unified + pipeline ═══════════ -->
        <div v-if="variant === 'C'" class="absolute inset-0 flex items-center justify-center p-4">
          <div class="w-full max-w-sm rounded-2xl bg-background shadow-2xl border border-border overflow-hidden">
            <div class="h-1.5" :class="feedbackType === 'idea' ? 'bg-secondary' : 'bg-primary'" />
            <div class="p-6">
              <!-- Success -->
              <template v-if="submitted">
                <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">Thank you</div>
                <h2 class="font-display text-2xl mt-1">
                  {{ feedbackType === 'idea' ? 'Idea received' : feedbackType === 'question' ? 'Question sent' : 'Report sent' }}
                  <span aria-hidden="true">🎉</span>
                </h2>
                <p class="text-sm text-muted-foreground mt-2">
                  <template v-if="feedbackType === 'idea'">
                    Our agents will sketch your idea and email you the options. You pick what you like — we build and ship it. No coding needed.
                  </template>
                  <template v-else-if="feedbackType === 'question'">
                    We'll get back to you soon.
                  </template>
                  <template v-else>
                    Our team has it, complete with a screenshot and technical details.
                  </template>
                </p>
                <button class="mt-5 w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm" @click="reset">
                  <Check class="inline w-4 h-4 -mt-0.5 mr-1" /> Done
                </button>
              </template>

              <template v-else>
                <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">
                  {{ feedbackType === 'idea' ? 'Co-create with us' : 'Help us improve' }}
                </div>
                <h2 class="font-display text-2xl mt-1">Talk to us</h2>
                <p class="text-sm text-muted-foreground mt-1">
                  This is an open-source project. Report bugs, ask questions, or share ideas — and our agents will sketch them for you.
                </p>

                <!-- Type chips -->
                <div class="flex gap-2 mt-4">
                  <button
                    v-for="t in ([
                      { id: 'bug' as FeedbackType, label: 'Bug', icon: Bug },
                      { id: 'idea' as FeedbackType, label: 'Idea', icon: Lightbulb },
                      { id: 'question' as FeedbackType, label: 'Question', icon: MessageSquare },
                    ])" :key="t.id"
                    class="flex items-center gap-1.5 px-3 h-8 rounded-full border text-sm font-semibold transition-colors"
                    :class="feedbackType === t.id
                      ? (t.id === 'idea' ? 'border-secondary bg-secondary/10 text-wd-brown-900' : 'border-primary bg-primary/10 text-wd-red-800')
                      : 'border-border text-muted-foreground hover:border-foreground/30'"
                    @click="feedbackType = t.id; description = ''"
                  >
                    <component :is="t.icon" class="w-3.5 h-3.5" /> {{ t.label }}
                  </button>
                </div>

                <div class="space-y-3 mt-4">
                  <div>
                    <label class="text-sm font-semibold block mb-1">
                      {{ feedbackType === 'bug' ? 'What happened?' : feedbackType === 'idea' ? 'What would you love to see?' : 'What\'s your question?' }}
                      <span class="text-primary">*</span>
                    </label>
                    <textarea v-model="description" rows="3" :placeholder="PLACEHOLDERS[feedbackType]" class="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>

                  <div v-if="!signedIn">
                    <label class="text-sm font-semibold block mb-1">
                      Email
                      <span v-if="feedbackType === 'idea'" class="text-primary">*</span>
                      <span v-else class="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <input v-model="email" type="email" placeholder="you@example.com" class="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <p v-if="feedbackType === 'idea'" class="text-xs text-muted-foreground mt-1">So we can send you the sketch options.</p>
                  </div>

                  <!-- Screenshot badge (bug only) -->
                  <div v-if="feedbackType === 'bug'" class="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs bg-card border border-border text-muted-foreground">
                    <ImageIcon class="w-4 h-4 shrink-0" :class="hasScreenshot ? 'text-success' : 'text-secondary'" />
                    <span class="flex-1">{{ hasScreenshot ? 'Screenshot of this page attached.' : 'No screenshot captured.' }}</span>
                  </div>

                  <!-- Pipeline preview (idea only) -->
                  <div v-if="feedbackType === 'idea'" class="rounded-2xl border border-secondary/30 bg-secondary/5 p-3">
                    <p class="text-xs font-bold text-secondary uppercase tracking-wider mb-2.5">What happens next</p>
                    <ol class="space-y-2">
                      <li v-for="(step, i) in PIPELINE_STEPS" :key="i" class="flex items-center gap-2.5 text-xs">
                        <span class="w-5 h-5 rounded-full bg-background border border-border grid place-items-center text-[10px] font-bold text-muted-foreground shrink-0">{{ i + 1 }}</span>
                        <component :is="step.icon" class="w-3.5 h-3.5 shrink-0" :class="step.color" />
                        <span>{{ step.label }}</span>
                      </li>
                    </ol>
                  </div>

                  <button
                    class="w-full h-11 rounded-full font-bold text-sm"
                    :class="feedbackType === 'idea' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'"
                    @click="mockSubmit"
                  >
                    <template v-if="feedbackType === 'bug'"><Send class="inline w-4 h-4 -mt-0.5 mr-1" /> Send report</template>
                    <template v-else-if="feedbackType === 'idea'"><Sparkles class="inline w-4 h-4 -mt-0.5 mr-1" /> Send idea</template>
                    <template v-else><Send class="inline w-4 h-4 -mt-0.5 mr-1" /> Send question</template>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Floating button mock (always visible, non-interactive) -->
        <div class="absolute left-4 bottom-4 z-10 flex items-center gap-2 rounded-full px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-foreground shadow-lg opacity-40 pointer-events-none">
          <Bug class="w-4 h-4" />
          <span>Report a problem</span>
        </div>
      </div>
    </div>
  </div>
</template>

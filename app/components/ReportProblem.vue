<script setup lang="ts">
/**
 * "Talk to us" widget — a site-wide floating button that lets any visitor
 * (signed in or not) file a bug report OR share an idea to co-create the
 * product. Opens a hub with two paths (Option A from the RAZ-426 sketch):
 *
 *   • "Report a problem" — the existing bug form (screenshot + context bundle)
 *   • "Share an idea" — a new form with a pipeline preview showing what happens
 *     next: agents sketch it → email options → user picks → we ship.
 *
 * Bug reports snapshot the page with html2canvas (after the user picks the bug
 * path, not on hub open — so the hub appears instantly). Both paths call the
 * `feedback.report` tRPC mutation, which files a Linear issue in the WeDance
 * Support project with the appropriate label (user-report / user-idea).
 */
import {
  Bug, Lightbulb, Check, ImageIcon, Send, Sparkles, Mail, Palette,
  Rocket, MessageSquare,
} from 'lucide-vue-next'
import { ReportProblemSchema } from '#shared/validation'
import { WD } from '~/lib/brand'
import { REPORT_PROBLEM_EVENT } from '~/lib/report-problem'

/**
 * Literal values for the semantic tokens, injected into the cloned document
 * before html2canvas paints it. html2canvas v1.4.1 only parses rgb/rgba/hsl/
 * hex — not the color-mix()/oklch() our tokens resolve to — so these must stay
 * plain colours. Brand ones come from WD (kept in sync with tailwind.css by
 * brand.test.ts); white and the two cream mixes (--muted, --accent) are their
 * computed sRGB values. Update here if a semantic token changes.
 */
const WHITE = 'rgb(255,255,255)'
const SCREENSHOT_TOKENS: Record<string, string> = {
  'background': WD.cream,
  'foreground': WD.brown900,
  'card': WHITE,
  'card-foreground': WD.brown900,
  'popover': WHITE,
  'popover-foreground': WD.brown900,
  'primary': WD.red600,
  'primary-foreground': WHITE,
  'secondary': WD.amber600,
  'secondary-foreground': WD.cream,
  'muted': 'rgb(245,239,229)',
  'muted-foreground': WD.brown700,
  'accent': 'rgb(247,239,224)',
  'accent-foreground': WD.amber600,
  'destructive': WD.red600,
  'destructive-foreground': WHITE,
  'border': 'rgba(59,31,13,0.13)',
  'input': 'rgba(59,31,13,0.2)',
  'ring': WD.amber600,
  'success': WD.green600,
  'info': WD.cyan600,
  'warning': WD.amber500,
}
const SCREENSHOT_TOKEN_CSS = `:root{${Object.entries(SCREENSHOT_TOKENS).map(([k, v]) => `--${k}:${v};`).join('')}}`

const { collect } = useReportContext()
const { isSignedIn } = useAuth()
const { track } = useTrack()
const { $trpc } = useNuxtApp()

const open = ref(false)
const hubChoice = ref<'bug' | 'idea' | null>(null)
const description = ref('')
const email = ref('')
const screenshot = ref<string | null>(null)
const capturing = ref(false)
const submitting = ref(false)
const error = ref('')
const doneUrl = ref<string | null>(null)
const { errors, validate, reset: resetValidation, fieldAttrs } = useFormValidation(ReportProblemSchema, () => ({
  description: description.value,
  email: email.value,
}))

const PIPELINE_STEPS = [
  { icon: MessageSquare, label: 'You describe your idea', color: 'text-primary' },
  { icon: Sparkles, label: 'Our agents build a sketch', color: 'text-secondary' },
  { icon: Mail, label: 'You get an email with options', color: 'text-wd-green-700' },
  { icon: Palette, label: 'You pick what you like', color: 'text-wd-amber-600' },
  { icon: Rocket, label: 'We build and ship it', color: 'text-primary' },
]

async function captureScreenshot(): Promise<string | null> {
  if (!import.meta.client) return null
  try {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      backgroundColor: WHITE,
      imageTimeout: 5000,
      scale: Math.min(window.devicePixelRatio || 1, 1.5),
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      onclone: (doc: Document, cloned: HTMLElement) => {
        const fix = doc.createElement('style')
        fix.textContent = SCREENSHOT_TOKEN_CSS
        doc.head.appendChild(fix)

        const colorProps = [
          'color', 'backgroundColor',
          'borderTopColor', 'borderRightColor',
          'borderBottomColor', 'borderLeftColor',
          'outlineColor', 'textDecorationColor',
        ] as const
        const unsupported = /oklch|oklab|lab\(|lch\(|color-mix|color\(|hwb\(/
        cloned.querySelectorAll<HTMLElement>('*').forEach((el) => {
          const cs = doc.defaultView?.getComputedStyle(el)
          if (!cs) return
          for (const prop of colorProps) {
            if (unsupported.test(cs[prop])) {
              el.style[prop] = 'transparent'
            }
          }
          if (unsupported.test(cs.boxShadow)) el.style.boxShadow = 'none'
          if (unsupported.test(cs.backgroundImage)) el.style.backgroundImage = 'none'
        })

        cloned.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
          const s = el.style
          const bg = s.backgroundImage || ''
          if (
            /feTurbulence|feBlend|feGaussianBlur/.test(bg)
            || (s.mixBlendMode && s.mixBlendMode !== 'normal')
          ) {
            el.remove()
            return
          }
          if (s.backdropFilter || (s as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter) {
            s.backdropFilter = 'none'
            s.setProperty('-webkit-backdrop-filter', 'none')
          }
        })
        cloned.querySelectorAll('[class*="backdrop-blur"]').forEach((el) => {
          const h = el as HTMLElement
          h.style.backdropFilter = 'none'
          h.style.setProperty('-webkit-backdrop-filter', 'none')
        })
      },
      ignoreElements: (el: Element) => {
        const tag = el.tagName
        return tag === 'IFRAME' || tag === 'VIDEO'
      },
    })
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch (e) {
    console.warn('[ReportProblem] screenshot capture failed:', e)
    return null
  }
}

/** Open the hub (no screenshot yet — that happens when the bug path is chosen). */
function openHub() {
  error.value = ''
  doneUrl.value = null
  hubChoice.value = null
  open.value = true
  track('problem_report_opened')
}

/** User chose "Report a problem" — capture the screenshot, then show the bug form. */
async function chooseBug() {
  capturing.value = true
  screenshot.value = await captureScreenshot()
  capturing.value = false
  hubChoice.value = 'bug'
}

/** User chose "Share an idea" — show the idea form (no screenshot needed). */
function chooseIdea() {
  hubChoice.value = 'idea'
}

// Other pages can open the widget without a second copy of it (e.g. the
// "Report a problem" button on /docs): window.dispatchEvent(new Event(REPORT_PROBLEM_EVENT)).
const onRequest = () => { if (!capturing.value && !open.value) openHub() }
onMounted(() => window.addEventListener(REPORT_PROBLEM_EVENT, onRequest))
onBeforeUnmount(() => window.removeEventListener(REPORT_PROBLEM_EVENT, onRequest))

function reset() {
  description.value = ''
  email.value = ''
  screenshot.value = null
  error.value = ''
  submitting.value = false
  doneUrl.value = null
  hubChoice.value = null
  resetValidation()
}

watch(open, (v) => {
  if (!v) setTimeout(reset, 200)
})

async function submit() {
  error.value = ''

  // For the idea path, email is required for non-signed-in users (so we can
  // send them the sketch options).
  if (hubChoice.value === 'idea' && !isSignedIn.value && !email.value.trim()) {
    error.value = 'Email is required so we can send you the sketch options.'
    return
  }

  const result = validate()
  if (!result.success) return
  submitting.value = true
  try {
    const res = await $trpc.feedback.report.mutate({
      ...result.data,
      type: hubChoice.value || 'bug',
      context: collect(),
      screenshot: hubChoice.value === 'bug' ? (screenshot.value || undefined) : undefined,
    })
    doneUrl.value = res.url
    track('problem_report_submitted', { type: hubChoice.value || 'bug', identifier: res.identifier })
  } catch (e: any) {
    error.value = e?.message || 'Could not submit. Please try again, or email hello@wedance.vip.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- Floating trigger (bottom-left to stay clear of the plan/cart sidebar) -->
  <Button
    :loading="capturing"
    class="fixed left-4 bottom-[calc(1rem+var(--wd-tabbar-h,0px))] z-40 h-auto gap-2 rounded-full pl-3 pr-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-foreground hover:bg-foreground/90 shadow-[0_4px_14px_rgba(59,31,13,0.35)]"
    aria-label="Talk to us"
    @click="openHub"
  >
    <MessageSquare v-if="!capturing" />
    <span class="hidden sm:inline">{{ capturing ? 'Capturing…' : 'Talk to us' }}</span>
  </Button>

  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-md border-0 p-0 overflow-hidden [&>button]:top-6 [&>button]:right-5 bg-background text-foreground font-display"
    >
      <div class="h-1.5" :class="hubChoice === 'idea' ? 'bg-secondary' : 'bg-primary'" />

      <div class="px-6 pb-6 pt-4">
        <!-- ═══════ Success ═══════ -->
        <template v-if="doneUrl">
          <DialogHeader class="text-left space-y-1">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">Thank you</div>
            <DialogTitle class="text-2xl leading-tight text-foreground font-display">
              {{ hubChoice === 'idea' ? 'Idea received' : 'Report sent' }} 🎉
            </DialogTitle>
            <DialogDescription class="text-muted-foreground font-sans">
              <template v-if="hubChoice === 'idea'">
                Our team will sketch it and email you the options. You pick what you like — we build it.
              </template>
              <template v-else>
                Our team has it, complete with a screenshot and technical details. We really appreciate you flagging it.
              </template>
            </DialogDescription>
          </DialogHeader>
          <Button variant="pill" size="lg" class="mt-5 w-full px-5 font-sans" @click="open = false">
            <Check /> Done
          </Button>
        </template>

        <!-- ═══════ Hub choice ═══════ -->
        <template v-else-if="!hubChoice">
          <DialogHeader class="text-left space-y-1">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">How can we help?</div>
            <DialogTitle class="text-2xl leading-tight text-foreground font-display">
              Talk to us
            </DialogTitle>
            <DialogDescription class="text-muted-foreground font-sans">
              This is an open-source project. You don't need to be a developer to shape it.
            </DialogDescription>
          </DialogHeader>

          <div class="mt-5 space-y-3">
            <button
              class="w-full flex items-start gap-3 rounded-2xl border border-border p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
              @click="chooseBug"
            >
              <Bug class="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p class="font-bold text-sm">Report a problem</p>
                <p class="text-xs text-muted-foreground mt-0.5">Something's broken or doesn't work as expected.</p>
              </div>
            </button>
            <button
              class="w-full flex items-start gap-3 rounded-2xl border border-border p-4 text-left hover:border-secondary/40 hover:bg-secondary/5 transition-colors"
              @click="chooseIdea"
            >
              <Lightbulb class="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              <div>
                <p class="font-bold text-sm">Share an idea</p>
                <p class="text-xs text-muted-foreground mt-0.5">Tell us what you'd love to see. Our agents will sketch it — no coding needed.</p>
              </div>
            </button>
          </div>
        </template>

        <!-- ═══════ Bug form ═══════ -->
        <template v-else-if="hubChoice === 'bug'">
          <button class="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 font-sans" @click="hubChoice = null">
            &larr; Back
          </button>

          <DialogHeader class="text-left space-y-1">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">Help us improve</div>
            <DialogTitle class="text-2xl leading-tight text-foreground font-display">
              Report a problem
            </DialogTitle>
            <DialogDescription class="text-muted-foreground font-sans">
              Tell us what went wrong. We'll attach a screenshot of this page and technical details to help us fix it fast.
            </DialogDescription>
          </DialogHeader>

          <form class="space-y-4 pt-4" novalidate @submit.prevent="submit">
            <Field id="report-desc" label="What happened?" required :error="errors.description">
              <Textarea
                v-model="description"
                :rows="4"
                placeholder="e.g. I clicked 'Save my plan' and nothing happened…"
                v-bind="fieldAttrs('description', 'report-desc-error')"
              />
            </Field>

            <Field v-if="!isSignedIn" id="report-email" label="Email" optional hint="So we can follow up." :error="errors.email">
              <Input
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                v-bind="fieldAttrs('email', 'report-email-error')"
              />
            </Field>

            <!-- Screenshot status -->
            <div
              class="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs bg-card border border-border text-muted-foreground font-sans"
            >
              <ImageIcon class="size-4 shrink-0" :class="screenshot ? 'text-success' : 'text-secondary'" aria-hidden="true" />
              <span v-if="screenshot" class="flex-1">Screenshot of this page attached.</span>
              <span v-else class="flex-1">No screenshot captured — we'll still get your description &amp; details.</span>
              <Button
                v-if="screenshot"
                type="button"
                variant="link"
                class="h-auto shrink-0 p-0 text-xs font-bold underline text-primary"
                @click="screenshot = null"
              >
                Remove
              </Button>
            </div>

            <p v-if="error" role="alert" class="text-sm font-bold text-primary font-sans">
              {{ error }}
            </p>

            <Button type="submit" variant="pill" size="lg" class="w-full px-5 font-sans" :loading="submitting">
              <Send /> {{ submitting ? 'Sending…' : 'Send report' }}
            </Button>
          </form>
        </template>

        <!-- ═══════ Idea form ═══════ -->
        <template v-else>
          <button class="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 font-sans" @click="hubChoice = null">
            &larr; Back
          </button>

          <DialogHeader class="text-left space-y-1">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">Co-create with us</div>
            <DialogTitle class="text-2xl leading-tight text-foreground font-display">
              Share an idea
            </DialogTitle>
            <DialogDescription class="text-muted-foreground font-sans">
              Describe what you'd like. Our agents will build a sketch and email you options to choose from.
            </DialogDescription>
          </DialogHeader>

          <form class="space-y-4 pt-4" novalidate @submit.prevent="submit">
            <Field id="idea-desc" label="What would you love to see?" required :error="errors.description">
              <Textarea
                v-model="description"
                :rows="4"
                placeholder="e.g. It would be great if I could filter festivals by dance style and see who from my friends is going…"
                v-bind="fieldAttrs('description', 'idea-desc-error')"
              />
            </Field>

            <Field
              v-if="!isSignedIn" id="idea-email" label="Email" required
              hint="So we can send you the sketch options." :error="errors.email"
            >
              <Input
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                v-bind="fieldAttrs('email', 'idea-email-error')"
              />
            </Field>

            <!-- Pipeline preview -->
            <div class="rounded-2xl border border-secondary/30 bg-secondary/5 p-3">
              <p class="text-xs font-bold text-secondary uppercase tracking-wider mb-2 font-sans">What happens next</p>
              <ol class="space-y-2">
                <li v-for="(step, i) in PIPELINE_STEPS" :key="i" class="flex items-center gap-2 text-xs font-sans">
                  <span class="w-5 h-5 rounded-full bg-background border border-border grid place-items-center text-[10px] font-bold text-muted-foreground shrink-0">{{ i + 1 }}</span>
                  <component :is="step.icon" class="w-3.5 h-3.5 shrink-0" :class="step.color" />
                  <span>{{ step.label }}</span>
                </li>
              </ol>
            </div>

            <p v-if="error" role="alert" class="text-sm font-bold text-primary font-sans">
              {{ error }}
            </p>

            <Button type="submit" variant="pill" size="lg" class="w-full px-5 bg-secondary hover:bg-secondary/90 font-sans" :loading="submitting">
              <Sparkles /> {{ submitting ? 'Sending…' : 'Send idea' }}
            </Button>
          </form>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>

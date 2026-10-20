<script setup lang="ts">
/**
 * "Talk to us" widget — a site-wide floating button that lets any visitor
 * (signed in or not) file a bug report OR share an idea to co-create the
 * product. Opens a hub with two paths (Option A from the RAZ-426 sketch):
 *
 *   • "Report a problem" — the bug form (optional screenshot + context bundle)
 *   • "Share an idea" — a form with a pipeline preview showing what happens
 *     next: agents sketch it → email options → user picks → we ship.
 *
 * Both paths submit to Sentry User Feedback (app/lib/sentry-feedback.ts) with
 * the context bundle from useReportContext() and the current Session Replay
 * linked. The bug screenshot comes from the browser's own screen capture
 * (app/lib/screen-capture.ts, getDisplayMedia): one frame, then the stream is
 * stopped. Declined / unsupported (mobile) → no screenshot; the replay covers it.
 */
import {
  Bug, Lightbulb, Check, ImageIcon, Send, Sparkles, Mail, Palette,
  Rocket, MessageSquare, Camera,
} from 'lucide-vue-next'
import { ReportProblemSchema } from '#shared/validation'
import { REPORT_PROBLEM_EVENT } from '~/lib/report-problem'
import { captureScreenFrame, isScreenCaptureSupported, type ScreenFrame } from '~/lib/screen-capture'
import { submitFeedback } from '~/lib/sentry-feedback'

const { collect } = useReportContext()
const { isSignedIn, dancerId, dancerName, username } = useAuth()
const { track } = useTrack()
const { $trpc } = useNuxtApp()

const open = ref(false)
const hubChoice = ref<'bug' | 'idea' | null>(null)
const description = ref('')
const email = ref('')
const screenshot = ref<ScreenFrame | null>(null)
const screenshotUrl = ref<string | null>(null)
/** True while the browser's capture prompt is up — dialog + button hidden. */
const capturing = ref(false)
const canCapture = ref(false)
const submitting = ref(false)
const error = ref('')
/** Sentry event id of the submitted feedback — set = success state. */
const doneId = ref<string | null>(null)
const { errors, validate, reset: resetValidation, fieldAttrs } = useFormValidation(ReportProblemSchema, () => ({
  description: description.value,
  email: email.value,
}))

const FALLBACK_ERROR = 'Could not submit. Please try again, or email hello@wedance.vip.'

const PIPELINE_STEPS = [
  { icon: MessageSquare, label: 'You describe your idea', color: 'text-primary' },
  { icon: Sparkles, label: 'Our agents build a sketch', color: 'text-secondary' },
  { icon: Mail, label: 'You get an email with options', color: 'text-wd-green-700' },
  { icon: Palette, label: 'You pick what you like', color: 'text-wd-amber-600' },
  { icon: Rocket, label: 'We build and ship it', color: 'text-primary' },
]

onMounted(() => { canCapture.value = isScreenCaptureSupported() })

function setScreenshot(frame: ScreenFrame | null) {
  if (screenshotUrl.value) URL.revokeObjectURL(screenshotUrl.value)
  screenshot.value = frame
  screenshotUrl.value = frame ? URL.createObjectURL(frame.blob) : null
}

/** Wait until the hidden dialog has animated out and the browser picker closed. */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())), 350)
  })
}

/**
 * Take one screenshot of the tab. Must run straight from a click handler:
 * getDisplayMedia is called synchronously (no await before it) to keep the
 * user gesture. The dialog + floating button hide first so they're not in it.
 */
async function takeScreenshot() {
  if (!canCapture.value || capturing.value) return
  capturing.value = true
  const pending = captureScreenFrame(settle)
  const frame = await pending
  capturing.value = false
  if (frame) setScreenshot(frame)
  track('problem_report_screenshot', { captured: !!frame })
}

/** Open the hub. */
function openHub() {
  error.value = ''
  doneId.value = null
  hubChoice.value = null
  open.value = true
  track('problem_report_opened')
}

/** User chose "Report a problem" — show the bug form and offer a screenshot. */
function chooseBug() {
  hubChoice.value = 'bug'
  // Same click = valid user gesture; declining just leaves the form without one.
  takeScreenshot()
}

/** User chose "Share an idea" — show the idea form (no screenshot needed). */
function chooseIdea() {
  hubChoice.value = 'idea'
}

// Other pages can open the widget without a second copy of it (e.g. the
// "Report a problem" button on /docs): window.dispatchEvent(new Event(REPORT_PROBLEM_EVENT)).
const onRequest = () => { if (!capturing.value && !open.value) openHub() }
onMounted(() => window.addEventListener(REPORT_PROBLEM_EVENT, onRequest))
onBeforeUnmount(() => {
  window.removeEventListener(REPORT_PROBLEM_EVENT, onRequest)
  setScreenshot(null)
})

function reset() {
  description.value = ''
  email.value = ''
  setScreenshot(null)
  error.value = ''
  submitting.value = false
  doneId.value = null
  hubChoice.value = null
  resetValidation()
}

watch(open, (v) => {
  if (!v) setTimeout(reset, 200)
})

/** Signed-in reporter's name + email from the server session (best-effort). */
async function reporter(): Promise<{ name: string | null, email: string | null }> {
  if (!isSignedIn.value) return { name: null, email: null }
  try {
    return await $trpc.feedback.reporter.query()
  } catch {
    return { name: dancerName.value, email: null }
  }
}

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
  const type = hubChoice.value || 'bug'
  submitting.value = true
  try {
    const who = await reporter()
    const id = await submitFeedback({
      type,
      description: result.data.description,
      name: who.name || dancerName.value,
      email: isSignedIn.value ? (who.email || result.data.email) : result.data.email,
      dancerId: dancerId.value,
      username: username.value,
      context: collect(),
      screenshot: type === 'bug' ? screenshot.value?.bytes : null,
    })
    doneId.value = id
    track('problem_report_submitted', { type, identifier: id, has_screenshot: type === 'bug' && !!screenshot.value })
  } catch (e) {
    console.warn('[ReportProblem] submit failed:', e)
    error.value = FALLBACK_ERROR
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- Floating trigger (bottom-left to stay clear of the plan/cart sidebar) -->
  <Button
    v-show="!capturing"
    class="fixed left-4 bottom-[calc(1rem+var(--wd-tabbar-h,0px))] z-40 h-auto gap-2 rounded-full pl-3 pr-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-foreground hover:bg-foreground/90 shadow-[0_4px_14px_rgba(59,31,13,0.35)]"
    aria-label="Talk to us"
    @click="openHub"
  >
    <MessageSquare />
    <span class="hidden sm:inline">Talk to us</span>
  </Button>

  <!-- Hidden (not closed) while capturing, so the form keeps its state. -->
  <Dialog :open="open && !capturing" @update:open="(v: boolean) => { if (!capturing) open = v }">
    <DialogContent
      class="sm:max-w-md border-0 p-0 overflow-hidden [&>button]:top-6 [&>button]:right-5 bg-background text-foreground font-display"
    >
      <div class="h-1.5" :class="hubChoice === 'idea' ? 'bg-secondary' : 'bg-primary'" />

      <div class="px-6 pb-6 pt-4">
        <!-- ═══════ Success ═══════ -->
        <template v-if="doneId">
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
                Our team has it, together with the technical details. We really appreciate you flagging it.
              </template>
            </DialogDescription>
          </DialogHeader>
          <p class="mt-3 text-xs text-muted-foreground font-sans">
            Reference: <span class="font-mono select-all">{{ doneId.slice(0, 8) }}</span>
          </p>
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
              Tell us what went wrong. We'll attach technical details (and a screenshot, if you take one) to help us fix it fast.
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
              class="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-xs bg-card border border-border text-muted-foreground font-sans"
            >
              <img
                v-if="screenshotUrl"
                :src="screenshotUrl"
                alt="Screenshot that will be attached"
                class="h-12 w-20 shrink-0 rounded-md border border-border object-cover object-top"
              >
              <ImageIcon v-else class="size-4 shrink-0 text-secondary" aria-hidden="true" />
              <span v-if="screenshot" class="flex-1">Screenshot attached.</span>
              <span v-else class="flex-1">No screenshot — the session replay will show us what happened.</span>
              <Button
                v-if="screenshot"
                type="button"
                variant="link"
                class="h-auto shrink-0 p-0 text-xs font-bold underline text-primary"
                @click="setScreenshot(null)"
              >
                Remove
              </Button>
              <Button
                v-else-if="canCapture"
                type="button"
                variant="link"
                class="h-auto shrink-0 gap-1 p-0 text-xs font-bold underline text-primary"
                @click="takeScreenshot"
              >
                <Camera class="size-3.5" aria-hidden="true" /> Take screenshot
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

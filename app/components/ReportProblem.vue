<script setup lang="ts">
/**
 * "Report a problem" widget — a site-wide floating button that lets any visitor
 * (signed in or not) file a bug. On click it snapshots the *current* page with
 * html2canvas (before the dialog opens, so the report shows what the user was
 * actually looking at), then opens a dialog for a short description + optional
 * email. Submitting calls the `feedback.report` tRPC mutation, which files a
 * Linear issue in team WED with the screenshot + a rich context bundle
 * (device, route, recent client errors, Sentry replay link — see
 * useReportContext). Styled in the 2026 tropical aesthetic to match SignUpModal.
 */
import { Bug, Check, ImageIcon } from 'lucide-vue-next'
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
        // html2canvas v1.4.1 only understands rgb/rgba/hsl/hsla.
        // Tailwind 4 emits oklch() in CSS variables and color-mix()
        // for opacity utilities — both crash the color parser before
        // any element is rendered.  Inject hex overrides for every
        // CSS variable so computed styles resolve to safe values
        // (SCREENSHOT_TOKENS above).
        const fix = doc.createElement('style')
        fix.textContent = SCREENSHOT_TOKEN_CSS
        doc.head.appendChild(fix)

        // Neutralise any remaining CSS Color Level 4 values that
        // html2canvas v1 can't parse (oklch, oklab, lab, lch,
        // color-mix, hwb).  Tailwind 4 and modern browsers emit
        // these in computed styles even when the source uses oklch.
        // color() is what color-mix(in srgb, …) computes to — e.g. the
        // `bg-primary/10` tints and --border — and also crashes the parser.
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

        // Strip SVG-filter overlays and blend modes that html2canvas
        // can't reproduce (grain texture, mix-blend-mode layers).
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
    // JPEG @ 0.8 keeps the data URL small enough for a single request.
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch (e) {
    console.warn('[ReportProblem] screenshot capture failed:', e)
    return null // screenshot is best-effort; report still submits without it
  }
}

async function openReport() {
  error.value = ''
  doneUrl.value = null
  capturing.value = true
  // Snapshot the page as it looks right now, then reveal the dialog.
  screenshot.value = await captureScreenshot()
  capturing.value = false
  open.value = true
  track('problem_report_opened')
}

// Other pages can open the widget without a second copy of it (e.g. the
// "Report a problem" button on /docs): window.dispatchEvent(new Event(REPORT_PROBLEM_EVENT)).
const onRequest = () => { if (!capturing.value && !open.value) openReport() }
onMounted(() => window.addEventListener(REPORT_PROBLEM_EVENT, onRequest))
onBeforeUnmount(() => window.removeEventListener(REPORT_PROBLEM_EVENT, onRequest))

function reset() {
  description.value = ''
  email.value = ''
  screenshot.value = null
  error.value = ''
  submitting.value = false
  doneUrl.value = null
  resetValidation()
}

watch(open, (v) => {
  if (!v) setTimeout(reset, 200)
})

async function submit() {
  error.value = ''
  const result = validate()
  if (!result.success) return
  submitting.value = true
  try {
    const res = await $trpc.feedback.report.mutate({
      ...result.data,
      context: collect(),
      screenshot: screenshot.value || undefined,
    })
    doneUrl.value = res.url
    track('problem_report_submitted', { identifier: res.identifier })
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
    class="fixed left-4 bottom-4 z-40 h-auto gap-2 rounded-full pl-3 pr-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-foreground hover:bg-foreground/90 shadow-[0_4px_14px_rgba(59,31,13,0.35)]"
    aria-label="Report a problem"
    @click="openReport"
  >
    <Bug v-if="!capturing" />
    <span class="hidden sm:inline">{{ capturing ? 'Capturing…' : 'Report a problem' }}</span>
  </Button>

  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-md border-0 p-0 overflow-hidden [&>button]:top-6 [&>button]:right-5 bg-background text-foreground font-display"
    >
      <div class="h-1.5 bg-primary" />

      <div class="px-6 pb-6 pt-4">
        <!-- Success -->
        <template v-if="doneUrl">
          <DialogHeader class="text-left space-y-1">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">Thank you</div>
            <DialogTitle class="text-2xl leading-tight text-foreground font-display">
              Report sent 🎉
            </DialogTitle>
            <DialogDescription class="text-muted-foreground font-sans">
              Our team has it, complete with a screenshot and technical details. We really appreciate you flagging it.
            </DialogDescription>
          </DialogHeader>
          <Button variant="pill" size="lg" class="mt-5 w-full px-5 font-sans" @click="open = false">
            <Check /> Done
          </Button>
        </template>

        <!-- Form -->
        <template v-else>
          <DialogHeader class="text-left space-y-1">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">Help us improve</div>
            <DialogTitle class="text-2xl leading-tight text-foreground font-display">
              Report a problem
            </DialogTitle>
            <DialogDescription class="text-muted-foreground font-sans">
              Tell us what went wrong. We’ll attach a screenshot of this page and technical details to help us fix it fast.
            </DialogDescription>
          </DialogHeader>

          <form class="space-y-4 pt-4" novalidate @submit.prevent="submit">
            <Field id="report-desc" label="What happened?" required :error="errors.description">
              <Textarea
                v-model="description"
                :rows="4"
                placeholder="e.g. I clicked ‘Save my plan’ and nothing happened…"
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
              <span v-else class="flex-1">No screenshot captured — we’ll still get your description &amp; details.</span>
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
              {{ submitting ? 'Sending…' : 'Send report' }}
            </Button>
          </form>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * Submit your video to enter the monthly competition. Collects title, video
 * URL (YouTube/Instagram/TikTok), optional style, and email. Calls
 * `cityVideo.submit` which stores the entry as `pending` for admin review.
 */
import { CheckCircle2, Video, X } from 'lucide-vue-next'
import { parseVideoUrl } from '~/lib/videoEmbed'
import { VideoSubmissionSchema } from '#shared/validation'
import { WD } from '~/lib/brand'

const props = defineProps<{
  citySlug: string
  // City display name — used in the reward copy ("featured on WeDance <city>").
  cityName?: string
  // Real prize for this month, only when a giveaway is actually live. When
  // absent we promise only the reward that always exists (getting featured),
  // so the copy is never a broken promise.
  prize?: string | null
  accent?: string
}>()

const cityLabel = computed(() => (props.cityName ? ` ${props.cityName}` : ''))

const emit = defineEmits<{ submitted: [] }>()

const { $trpc } = useNuxtApp()
const accent = computed(() => props.accent ?? WD.red600)

// Two-step reveal: default view is a single CTA button (`open === false`);
// clicking it expands the form in place. Keeps the competition section light
// and vote-first — the form only appears when a dancer signals intent.
const open = ref(false)

const title = ref('')
const videoUrl = ref('')
const danceStyle = ref('')
const email = ref('')

const submitting = ref(false)
const submitted = ref(false)
const error = ref<string | null>(null)
const { errors, validate, reset: resetValidation, fieldAttrs } = useFormValidation(VideoSubmissionSchema, () => ({
  title: title.value,
  videoUrl: videoUrl.value,
  danceStyle: danceStyle.value,
  email: email.value,
}))

async function reveal() {
  open.value = true
  // Move focus into the form once it's in the DOM (accessibility).
  await nextTick()
  document.getElementById('video-title')?.focus()
}

function collapse() {
  open.value = false
  reset()
}

const provider = computed(() => (videoUrl.value.trim() ? parseVideoUrl(videoUrl.value).provider : null))
const urlLooksValid = computed(() => provider.value !== null && provider.value !== 'unknown')

async function submit() {
  error.value = null
  const result = validate()
  if (!result.success) return
  submitting.value = true
  try {
    await $trpc.cityVideo.submit.mutate({ citySlug: props.citySlug, ...result.data })
    submitted.value = true
    // CUJ: "Vote on videos" — a video was submitted to the competition.
    useTrack().track('video_submit', { city: props.citySlug, dance_style: result.data.danceStyle })
    emit('submitted')
  } catch (e: any) {
    error.value = e?.message ?? 'Could not submit your video. Check the URL and try again.'
  } finally {
    submitting.value = false
  }
}

function reset() {
  title.value = ''
  videoUrl.value = ''
  danceStyle.value = ''
  email.value = ''
  submitted.value = false
  error.value = null
  resetValidation()
}
</script>

<template>
  <div
    class="rounded-2xl border bg-white p-5"
    :style="{ borderColor: accent + '44', boxShadow: '0 1px 0 ' + accent + '18, 0 8px 22px rgba(59,31,18,0.05)' }"
  >
    <!-- Step 1: CTA. Leads with the payoff + who can enter, THEN the button —
         so the reason to participate is visible before the ask. -->
    <div v-if="!open" class="flex flex-col items-center gap-3 py-3 text-center">
      <p class="text-sm font-bold leading-snug text-foreground font-display">
        Get your dancing seen.
      </p>
      <p class="max-w-xs text-xs leading-relaxed text-muted-foreground font-sans">
        Post a clip, the community votes, and the top-voted video this month gets
        featured on WeDance{{ cityLabel }}<template v-if="prize"> and wins <span class="font-bold" :style="{ color: accent }">{{ prize }}</span></template>.
        Any dancer, any style.
      </p>
      <Button variant="pill" :accent="accent" class="px-6" @click="reveal">
        <Video aria-hidden="true" /> Submit your video
      </Button>
      <p class="text-meta text-secondary font-sans">
        Free · we review every entry before it joins the vote
      </p>
    </div>

    <!-- Step 2: success state (shown after a submit, inside the open form). -->
    <div v-else-if="submitted" class="flex flex-col items-center gap-2 py-6 text-center">
      <CheckCircle2 class="h-8 w-8" :style="{ color: accent }" />
      <p class="text-base font-bold text-foreground font-display">
        Submitted — pending review
      </p>
      <p class="max-w-xs text-xs text-muted-foreground font-sans">
        We review every entry before it joins the vote. You'll appear in the competition once approved.
      </p>
      <div class="mt-2 flex items-center gap-4">
        <Button variant="link" class="h-auto p-0 text-xs font-bold underline" :style="{ color: accent }" @click="reset">
          Submit another
        </Button>
        <Button variant="link" class="h-auto p-0 text-xs font-bold underline text-muted-foreground" @click="collapse">
          Done
        </Button>
      </div>
    </div>

    <form v-else class="space-y-3" novalidate @submit.prevent="submit">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-eyebrow uppercase tracking-[0.3em] font-bold" :style="{ color: accent }">Enter the competition</div>
          <h3 class="mt-1 text-lg font-bold text-foreground font-display">
            Submit your video
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground font-sans">
            Paste a YouTube, Instagram, or TikTok link. Top-voted clip gets featured on WeDance{{ cityLabel }}<template v-if="prize"> and wins {{ prize }}</template>.
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" class="shrink-0 rounded-full text-secondary" aria-label="Cancel" @click="collapse">
          <X aria-hidden="true" />
        </Button>
      </div>

      <Field id="video-title" label="Video title" :error="errors.title">
        <Input v-model="title" size="sm" maxlength="120" v-bind="fieldAttrs('title', 'video-title-error')" />
      </Field>

      <Field id="video-url" label="Video link" :error="errors.videoUrl">
        <Input v-model="videoUrl" type="url" inputmode="url" size="sm" placeholder="https://youtube.com/watch?v=…" v-bind="fieldAttrs('videoUrl', 'video-url-error')" />
        <p
          v-if="!errors.videoUrl && videoUrl.trim() && !urlLooksValid"
          class="text-meta text-wd-amber-700 font-sans"
        >
          We couldn't recognise this as a YouTube, Instagram, or TikTok link — double-check it.
        </p>
        <p
          v-else-if="!errors.videoUrl && urlLooksValid"
          class="text-meta capitalize font-sans"
          :style="{ color: accent }"
        >
          {{ provider }} link detected ✓
        </p>
      </Field>

      <Field id="video-style" label="Dance style" optional :error="errors.danceStyle">
        <Input v-model="danceStyle" size="sm" maxlength="60" placeholder="e.g. Bachata" v-bind="fieldAttrs('danceStyle', 'video-style-error')" />
      </Field>

      <Field id="video-email" label="Your email" :error="errors.email">
        <Input v-model="email" type="email" size="sm" autocomplete="email" v-bind="fieldAttrs('email', 'video-email-error')" />
      </Field>

      <p v-if="error" role="alert" class="text-xs text-primary font-sans">
        {{ error }}
      </p>

      <Button type="submit" variant="pill" :accent="accent" class="w-full" :loading="submitting">
        {{ submitting ? 'Submitting…' : 'Submit my video' }}
      </Button>
    </form>
  </div>
</template>

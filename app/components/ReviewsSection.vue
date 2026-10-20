<script setup lang="ts">
/**
 * Reviews + ratings for any entity, keyed by (targetType, targetSlug).
 * Read for everyone; write for signed-in dancers. Client-side fetch (the app's
 * tRPC client is client-only). 2026 tropical style.
 */
import { Star } from 'lucide-vue-next'
import { ReviewSchema } from '#shared/validation'
import { accentText } from '~/lib/accent'
import { WD } from '~/lib/brand'
import { Button } from '~/components/ui/button'
import { Field } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'

const GREEN_CHIP = accentText(WD.green600)

const props = defineProps<{
  targetType: 'festival' | 'venue' | 'artist' | 'organizer' | 'event'
  targetSlug: string
  targetName?: string
  citySlug?: string
}>()

const { $trpc } = useNuxtApp()
const { isSignedIn } = useAuth()

const data = ref<{ reviews: any[]; average: number; count: number }>({ reviews: [], average: 0, count: 0 })
const loading = ref(true)
const showForm = ref(false)
const form = reactive({ rating: 5, text: '' })
const submitting = ref(false)
const err = ref('')
const { errors, validate, reset: resetValidation, fieldAttrs } = useFormValidation(ReviewSchema, form)
const uid = useId()

async function load() {
  loading.value = true
  try {
    data.value = await $trpc.review.list.query({ targetType: props.targetType, targetSlug: props.targetSlug })
  } catch { /* leave empty */ } finally { loading.value = false }
}
onMounted(load)

async function submit() {
  err.value = ''
  const result = validate()
  if (!result.success) return
  submitting.value = true
  try {
    await $trpc.review.create.mutate({
      targetType: props.targetType,
      targetSlug: props.targetSlug,
      targetName: props.targetName,
      citySlug: props.citySlug,
      ...result.data,
    })
    useTrack().track('review_submitted', { target_type: props.targetType, target: props.targetSlug, city: props.citySlug || null })
    showForm.value = false
    form.text = ''
    form.rating = 5
    await load()
  } catch (e: any) {
    err.value = e?.message || 'Could not submit your review.'
  } finally {
    submitting.value = false
  }
}

function fmtDate(d: any) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString() } catch { return '' }
}
</script>

<template>
  <section class="mt-10 font-sans">
    <div class="flex items-center justify-between">
      <h3 class="text-2xl font-display text-foreground">Reviews</h3>
      <div v-if="data.count" class="flex items-center gap-1.5">
        <Star class="w-4 h-4 text-wd-amber-500 fill-wd-amber-500" aria-hidden="true" />
        <span class="font-bold text-foreground">{{ data.average.toFixed(1) }}</span>
        <span class="text-xs text-secondary">· {{ data.count }} review{{ data.count === 1 ? '' : 's' }}</span>
      </div>
    </div>

    <!-- Write CTA / form -->
    <div v-if="isSignedIn" class="mt-4">
      <Button v-if="!showForm" type="button" variant="soft" size="pill-sm" @click="showForm = true">Write a review</Button>

      <div v-else class="rounded-2xl border p-4 mt-1 bg-card" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent);">
        <div class="flex items-center gap-1 mb-3" role="group" aria-label="Rating" v-bind="fieldAttrs('rating', `${uid}-rating-error`)">
          <button v-for="n in 5" :key="n" type="button" class="cursor-pointer" :aria-label="`${n} stars`" :aria-pressed="n <= form.rating" @click="form.rating = n">
            <Star class="w-6 h-6" :class="n <= form.rating ? 'text-wd-amber-500 fill-wd-amber-500' : 'text-input'" aria-hidden="true" />
          </button>
        </div>
        <FieldError :id="`${uid}-rating-error`" :message="errors.rating" class="-mt-2 mb-2" />
        <Field :id="`${uid}-text`" label="Your review" hide-label :error="errors.text">
          <Textarea v-model="form.text" :rows="3" :resize="false" maxlength="1000" placeholder="What was it like?" v-bind="fieldAttrs('text', `${uid}-text-error`)" />
        </Field>
        <p v-if="err" class="text-sm font-bold mt-2 text-destructive">{{ err }}</p>
        <div class="flex gap-2 mt-3">
          <Button type="button" variant="pill" size="pill-sm" :loading="submitting" @click="submit">{{ submitting ? 'Posting…' : 'Post review' }}</Button>
          <Button type="button" variant="ghost" size="sm" class="rounded-full text-xs font-bold text-secondary" @click="showForm = false; resetValidation()">Cancel</Button>
        </div>
      </div>
    </div>

    <!-- List -->
    <div v-if="loading" class="mt-4 text-sm text-secondary">Loading reviews…</div>
    <p v-else-if="!data.count" class="mt-4 text-sm italic text-secondary">No reviews yet. Be the first.</p>
    <ul v-else class="mt-5 space-y-4">
      <li v-for="r in data.reviews" :key="r.id" class="rounded-2xl border p-4 bg-card" style="border-color:color-mix(in srgb, var(--wd-brown-900) 10.2%, transparent);">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <NuxtLink v-if="r.reviewerUsername" :to="`/u/${r.reviewerUsername}`" class="text-sm font-bold hover:underline text-foreground">{{ r.reviewerName || 'A dancer' }}</NuxtLink>
            <span v-else class="text-sm font-bold text-foreground">{{ r.reviewerName || 'A dancer' }}</span>
            <span v-if="r.source === 'recommendation'" class="text-tag uppercase tracking-wider font-bold rounded-full px-1.5 py-0.5" :style="{ background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: GREEN_CHIP }">Recommended</span>
          </div>
          <div class="flex items-center gap-0.5">
            <Star v-for="n in 5" :key="n" class="w-3.5 h-3.5" :class="n <= r.rating ? 'text-wd-amber-500 fill-wd-amber-500' : 'text-border'" aria-hidden="true" />
          </div>
        </div>
        <p v-if="r.text" class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ r.text }}</p>
        <div class="mt-1 text-eyebrow text-secondary">{{ fmtDate(r.createdAt) }}</div>
      </li>
    </ul>
  </section>
</template>

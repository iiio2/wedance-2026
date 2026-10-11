<script setup lang="ts">
/**
 * "Ask locals" for a city — newcomers post a question; locals answer by
 * recommending an organizer/venue, which becomes an auto-5★ review on that
 * target. Client-side fetch. 2026 tropical style.
 */
import { MessagesSquare, Send, ThumbsUp } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Field } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { AskLocalsSchema, RecommendPlaceSchema } from '#shared/validation'

const props = defineProps<{ citySlug: string; cityName?: string }>()
const { $trpc } = useNuxtApp()
const { isSignedIn } = useAuth()

const questions = ref<any[]>([])
const loading = ref(true)

const asking = reactive({ open: false, text: '', busy: false, err: '' })
const rec = reactive({ open: false, type: 'organizer' as 'organizer' | 'venue', name: '', text: '', busy: false, err: '', done: false })
const askForm = reactive(useFormValidation(AskLocalsSchema, () => ({ question: asking.text })))
const recForm = reactive(useFormValidation(RecommendPlaceSchema, () => ({ targetType: rec.type, targetName: rec.name, text: rec.text })))
const uid = useId()

async function load() {
  loading.value = true
  try { questions.value = await $trpc.askLocals.listByCity.query({ citySlug: props.citySlug }) }
  catch { questions.value = [] } finally { loading.value = false }
}
onMounted(load)

async function ask() {
  asking.err = ''
  const result = askForm.validate()
  if (!result.success) return
  asking.busy = true
  try {
    await $trpc.askLocals.ask.mutate({ citySlug: props.citySlug, ...result.data })
    // CUJ: "Ask locals" — question posted.
    useTrack().track('ask_locals_post', { city: props.citySlug, kind: 'ask' })
    asking.text = ''; asking.open = false
    await load()
  } catch (e: any) { asking.err = e?.message || 'Could not post.' } finally { asking.busy = false }
}

async function recommend() {
  rec.err = ''; rec.done = false
  const result = recForm.validate()
  if (!result.success) return
  rec.busy = true
  try {
    await $trpc.askLocals.recommend.mutate({ citySlug: props.citySlug, ...result.data })
    // CUJ: "Ask locals" — recommendation posted (auto 5-star review).
    useTrack().track('ask_locals_post', { city: props.citySlug, kind: 'recommend', target_type: rec.type })
    rec.done = true; rec.name = ''; rec.text = ''
  } catch (e: any) { rec.err = e?.message || 'Could not recommend.' } finally { rec.busy = false }
}
</script>

<template>
  <section class="mt-10 font-sans">
    <div class="flex items-center gap-2">
      <MessagesSquare class="w-5 h-5 text-wd-purple-500" aria-hidden="true" />
      <h3 class="text-2xl font-display text-foreground">Ask locals</h3>
    </div>
    <p class="mt-1 text-sm text-muted-foreground">
      New{{ cityName ? ` to ${cityName}` : ' in town' }}? Ask who's good — locals recommend the best organizers &amp; venues.
    </p>

    <!-- Recommend (locals share picks) -->
    <div class="mt-4 flex flex-wrap gap-2">
      <Button v-if="isSignedIn && !rec.open" type="button" variant="soft" size="pill-sm" accent="var(--wd-violet-600)" @click="rec.open = true">
        <ThumbsUp aria-hidden="true" /> Recommend a place
      </Button>
      <Button v-if="isSignedIn && !asking.open" type="button" variant="soft" size="pill-sm" @click="asking.open = true">
        Ask a question
      </Button>
      <p v-if="!isSignedIn" class="text-xs italic text-secondary">Sign in to ask or recommend.</p>
    </div>

    <!-- Ask form -->
    <div v-if="asking.open" class="mt-3 rounded-2xl border p-4 border-primary/20 bg-white">
      <Field :id="`${uid}-question`" label="Your question" hide-label :error="askForm.errors.question">
        <Textarea v-model="asking.text" :rows="2" :resize="false" maxlength="280" placeholder="e.g. Where's the best bachata social on Fridays?" class="min-h-0" v-bind="askForm.fieldAttrs('question', `${uid}-question-error`)" />
      </Field>
      <p v-if="asking.err" class="text-sm font-bold mt-1 text-primary">{{ asking.err }}</p>
      <div class="flex gap-2 mt-2">
        <Button type="button" variant="cta" size="pill-sm" :loading="asking.busy" @click="ask"><Send v-if="!asking.busy" aria-hidden="true" /> {{ asking.busy ? 'Posting…' : 'Post' }}</Button>
        <Button type="button" variant="ghost" class="h-8 rounded-full px-3 text-xs font-bold text-secondary" @click="asking.open = false; askForm.reset()">Cancel</Button>
      </div>
    </div>

    <!-- Recommend form -->
    <div v-if="rec.open" class="mt-3 rounded-2xl border p-4 border-wd-violet-600/20 bg-white">
      <div class="flex gap-2 mb-2" role="group" aria-label="What are you recommending?">
        <Button
          v-for="t in (['organizer', 'venue'] as const)"
          :key="t"
          type="button"
          variant="ghost"
          class="flex-1 h-9 rounded-lg text-xs font-bold"
          :class="rec.type === t ? 'bg-wd-violet-600 text-white hover:bg-wd-violet-600 hover:text-white' : 'bg-wd-violet-600/[7.8%] text-wd-violet-600 hover:bg-wd-violet-600/15 hover:text-wd-violet-600'"
          :aria-pressed="rec.type === t ? 'true' : 'false'"
          @click="rec.type = t"
        >
          {{ t === 'organizer' ? 'Organizer' : 'Venue' }}
        </Button>
      </div>
      <Field :id="`${uid}-rec-name`" :label="rec.type === 'organizer' ? 'Organizer name' : 'Venue name'" hide-label :error="recForm.errors.targetName">
        <Input v-model="rec.name" :placeholder="rec.type === 'organizer' ? 'Organizer name' : 'Venue name'" class="h-10" v-bind="recForm.fieldAttrs('targetName', `${uid}-rec-name-error`)" />
      </Field>
      <Field :id="`${uid}-rec-text`" label="Why do you recommend them?" hide-label :error="recForm.errors.text" class="mt-2">
        <Textarea v-model="rec.text" :rows="2" :resize="false" maxlength="1000" placeholder="Why do you recommend them?" class="min-h-0" v-bind="recForm.fieldAttrs('text', `${uid}-rec-text-error`)" />
      </Field>
      <p v-if="rec.err" class="text-sm font-bold mt-1 text-primary">{{ rec.err }}</p>
      <p v-if="rec.done" class="text-sm font-bold mt-1 text-success">Thanks — added as a 5★ recommendation.</p>
      <div class="flex gap-2 mt-2">
        <Button type="button" variant="pill" size="pill-sm" accent="var(--wd-violet-600)" :loading="rec.busy" @click="recommend"><ThumbsUp v-if="!rec.busy" aria-hidden="true" /> {{ rec.busy ? 'Adding…' : 'Recommend' }}</Button>
        <Button type="button" variant="ghost" class="h-8 rounded-full px-3 text-xs font-bold text-secondary" @click="rec.open = false; recForm.reset()">Close</Button>
      </div>
    </div>

    <!-- Open questions -->
    <div v-if="loading" class="mt-4 text-sm text-secondary">Loading…</div>
    <ul v-else-if="questions.length" class="mt-5 space-y-2">
      <li v-for="q in questions" :key="q.id" class="rounded-xl border p-3 border-wd-brown-900/[10.2%] bg-white">
        <p class="text-sm text-foreground">{{ q.question }}</p>
      </li>
    </ul>
  </section>
</template>

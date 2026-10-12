<script setup lang="ts">
/**
 * /business/claim — find an existing artist / venue / organizer profile and ask to
 * manage it. ?profile=<handle> pre-fills the search (linked from /@handle).
 */
import { Search, Check } from 'lucide-vue-next'

definePageMeta({ layout: 'business' })
useHead({ title: 'Find my profile | WeDance' })

const route = useRoute()
const { $trpc } = useNuxtApp()

type Result = Awaited<ReturnType<typeof $trpc.business.search.query>>[number]
const q = ref(String(route.query.profile ?? ''))
const results = ref<Result[]>([])
const searching = ref(false)
const searched = ref(false)
const error = ref<string | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
async function runSearch() {
  const term = q.value.trim()
  if (term.length < 2) { results.value = []; searched.value = false; return }
  searching.value = true
  error.value = null
  try {
    results.value = await $trpc.business.search.query({ q: term })
    searched.value = true
  } catch (e: any) {
    error.value = e?.message || 'Search failed.'
  } finally {
    searching.value = false
  }
}
watch(q, () => { clearTimeout(timer); timer = setTimeout(runSearch, 250) })
onMounted(() => { if (q.value) runSearch() })

const openFor = ref<string | null>(null)
const mode = ref<'claim' | 'join' | 'reclaim'>('claim')
const message = ref('')
const role = ref<'editor' | 'owner'>('editor')
const title = ref('')
const messageError = ref<string | undefined>()
const sending = ref(false)
// Handle → what was sent, for the confirmation badge.
const sent = ref(new Map<string, 'owners' | 'wedance'>())

function start(username: string, m: 'claim' | 'join' | 'reclaim') {
  openFor.value = username
  mode.value = m
  message.value = ''
  title.value = ''
  role.value = 'editor'
  messageError.value = undefined
}
async function send(username: string) {
  if (message.value.trim().length < 3) { messageError.value = 'Tell us who you are and how we can check it.'; return }
  sending.value = true
  error.value = null
  try {
    const res = await $trpc.businessTeam.requestAccess.mutate({
      username, kind: mode.value, role: role.value, title: title.value.trim() || null, message: message.value,
    })
    sent.value = new Map(sent.value).set(username, res.reviewer)
    openFor.value = null
  } catch (e: any) {
    error.value = e?.message || 'Could not send your request.'
  } finally {
    sending.value = false
  }
}

const formCopy = {
  claim: { label: 'How can we confirm it’s you?', hint: 'For example: “I’ll DM you from @myhandle on Instagram” or “email me at the address on our website”.' },
  join: { label: 'Who are you to them?', hint: 'The owners see this. For example: “Alösha, I do the promotion for the Thursday party.”' },
  reclaim: { label: 'Why is this page yours?', hint: 'WeDance checks this, not the people who manage it now. Give us something we can verify, e.g. a DM from the profile’s Instagram account.' },
}

const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer' }
</script>

<template>
  <div>
    <AdminPageHeader eyebrow="Business" title="Find my profile" description="Search for your artist name, venue or event brand. If it’s already on WeDance, ask to manage it." />

    <Field label="Search" hide-label class="mt-6">
      <div class="relative">
        <Search class="size-4 absolute left-3.5 top-3.5 text-muted-foreground" aria-hidden="true" />
        <Input v-model="q" type="search" placeholder="Name or @handle" class="pl-10" autofocus />
      </div>
    </Field>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="searching" kind="loading" message="Searching…" />
    <AdminState v-else-if="searched && !results.length" kind="empty" message="Nothing found." hint="Try another spelling, or create a new profile." />

    <div v-if="results.length" class="mt-4 grid gap-2">
      <div v-for="r in results" :key="r.username" class="rounded-2xl border bg-card p-4">
        <div class="flex items-center gap-3">
          <img v-if="r.photo" :src="r.photo" :alt="r.name" class="size-10 rounded-xl object-cover bg-muted">
          <div v-else class="size-10 rounded-xl bg-muted" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <NuxtLink :to="`/@${r.username}`" target="_blank" class="text-sm font-bold truncate hover:underline">{{ r.name }}</NuxtLink>
              <AdminStatus>{{ typeLabel[r.type] || r.type }}</AdminStatus>
            </div>
            <p class="text-xs text-muted-foreground truncate">@{{ r.username }}<template v-if="r.city"> · {{ r.city }}</template></p>
          </div>
          <AdminStatus v-if="sent.has(r.username)" tone="success"><Check class="size-3" aria-hidden="true" /> {{ sent.get(r.username) === 'owners' ? 'Sent to the owners' : 'Sent to WeDance' }}</AdminStatus>
          <template v-else-if="openFor !== r.username">
            <Button v-if="!r.managed" variant="outline-pill" size="pill-sm" @click="start(r.username, 'claim')">This is me</Button>
            <Button v-else variant="outline-pill" size="pill-sm" @click="start(r.username, 'join')">Join the team</Button>
          </template>
        </div>
        <p v-if="r.managed && !sent.has(r.username) && openFor !== r.username" class="mt-2 text-right text-xs">
          <button type="button" class="text-muted-foreground hover:text-foreground hover:underline" @click="start(r.username, 'reclaim')">This is my page, someone else has it</button>
        </p>

        <form v-if="openFor === r.username" class="mt-4 border-t pt-4" novalidate @submit.prevent="send(r.username)">
          <div v-if="mode === 'join'" class="mb-3 grid gap-3 sm:grid-cols-2">
            <Field :id="`role-${r.username}`" label="Role">
              <Select v-model="role" :options="[{ label: 'Editor — edit the profile and events', value: 'editor' }, { label: 'Owner — also manage the team', value: 'owner' }]" />
            </Field>
            <Field :id="`title-${r.username}`" label="Your title" optional hint="Shown on the team, e.g. Promoter, Resident DJ.">
              <Input v-model="title" />
            </Field>
          </div>
          <Field :id="`claim-${r.username}`" :label="formCopy[mode].label" :hint="formCopy[mode].hint" :error="messageError">
            <Textarea v-model="message" :rows="3" />
          </Field>
          <div class="mt-3 flex gap-2">
            <Button type="submit" variant="pill" :loading="sending">{{ mode === 'join' ? 'Ask to join' : 'Send request' }}</Button>
            <Button type="button" variant="outline-pill" @click="openFor = null">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * /business/claim — find an existing artist / venue / organizer profile and ask to
 * manage it. ?profile=<handle> pre-fills the search (linked from /@handle).
 * Paste an Instagram link to find the page that links it — or, if there's none,
 * import it: /business/new with the link filled in.
 */
import { Search, Check, Instagram, Plus } from 'lucide-vue-next'
import { parseInstagramHandle } from '#shared/utils/instagram'

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
const evidence = ref('')
const evidenceType = ref<'domain_email' | 'social_media' | 'website_link' | 'documentation' | 'other'>('other')
const role = ref<'editor' | 'owner'>('editor')
const title = ref('')
const messageError = ref<string | undefined>()
const sending = ref(false)
// Handle → what was sent, for the confirmation badge.
const sent = ref(new Map<string, 'owners' | 'wedance'>())

const evidenceTypeOptions = [
  { label: "Email from your organisation's domain", value: 'domain_email' },
  { label: 'Social media (Instagram DM, Facebook page)', value: 'social_media' },
  { label: 'Official website link', value: 'website_link' },
  { label: 'Other documentation', value: 'documentation' },
  { label: 'Other', value: 'other' },
]

function start(username: string, m: 'claim' | 'join' | 'reclaim') {
  openFor.value = username
  mode.value = m
  message.value = ''
  evidence.value = ''
  evidenceType.value = 'other'
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
      evidence: evidence.value, evidenceType: evidenceType.value,
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

// A pasted link or @handle → offer to import it unless a page already links it.
const igHandle = computed(() => {
  const t = q.value.trim()
  return /instagram\.com\/|^@/i.test(t) ? parseInstagramHandle(t) : null
})
const igMatched = computed(() => results.value.some(r => r.linksInstagram))
const importTo = computed(() => ({ path: '/business/new', query: { instagram: `https://instagram.com/${igHandle.value}` } }))

const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer', promoter: 'Promoter' }
</script>

<template>
  <div>
    <AdminPageHeader eyebrow="Business" title="Find my profile" description="Search for your artist name, venue or event brand, or paste its Instagram link. If it’s already on WeDance, ask to manage it." />

    <Field label="Search" hide-label class="mt-6">
      <div class="relative">
        <Search class="size-4 absolute left-3.5 top-3.5 text-muted-foreground" aria-hidden="true" />
        <Input v-model="q" type="search" placeholder="Name, @handle or Instagram link" class="pl-10" autofocus />
      </div>
    </Field>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="searching" kind="loading" message="Searching…" />
    <div v-else-if="searched && igHandle && !igMatched" class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-input bg-card p-4">
      <Instagram class="size-6 shrink-0 text-secondary" aria-hidden="true" />
      <div class="min-w-[12rem] flex-1">
        <p class="text-sm font-bold">@{{ igHandle }} isn’t on WeDance yet</p>
        <p class="text-xs text-muted-foreground">{{ results.length ? 'None of the pages below links this Instagram account.' : 'Import it: we fill in the name and handle, you check them.' }} You’ll manage it straight away.</p>
      </div>
      <Button variant="pill" size="pill-sm" as-child><NuxtLink :to="importTo"><Instagram /> Import from Instagram</NuxtLink></Button>
    </div>
    <div v-else-if="searched && !results.length" class="mt-4">
      <AdminState kind="empty" message="Nothing found." hint="Try another spelling or paste its Instagram link. Or create a new profile." />
      <Button variant="outline-pill" size="pill-sm" class="mt-2" as-child><NuxtLink to="/business/new"><Plus /> Create a profile</NuxtLink></Button>
    </div>

    <div v-if="results.length" class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2">
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
          <div v-if="mode !== 'join'" class="mt-3 grid gap-3 sm:grid-cols-2">
            <Field :id="`etype-${r.username}`" label="Evidence type" hint="How can we verify your relationship?">
              <Select v-model="evidenceType" :options="evidenceTypeOptions" />
            </Field>
            <Field :id="`evidence-${r.username}`" label="Evidence link or detail" optional hint="URL to your official page, email domain, or other proof.">
              <Input v-model="evidence" placeholder="https://…" />
            </Field>
          </div>
          <div class="mt-3 flex gap-2">
            <Button type="submit" variant="pill" :loading="sending">{{ mode === 'join' ? 'Ask to join' : 'Send request' }}</Button>
            <Button type="button" variant="outline-pill" @click="openFor = null">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

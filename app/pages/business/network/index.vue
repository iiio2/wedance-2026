<script setup lang="ts">
/**
 * /business/network — "Network" (RAZ-408). My pages, the artists, venues and
 * organizers I work with, and my claim requests.
 *
 * "People you work with" comes from shared events (businessNetwork.list), and
 * my team curates it: add anyone by search, hide a contact, restore it. It
 * follows the sidebar profile switcher: one page, or all pages I manage.
 */
import { ArrowRight, Search, Plus, EyeOff, Undo2, X, CalendarDays, UserPlus } from 'lucide-vue-next'

definePageMeta({ layout: 'business' })
useHead({ title: 'Network | Business | WeDance' })

const { $trpc } = useNuxtApp()
const businessProfile = useBusinessProfile()

type Data = Awaited<ReturnType<typeof $trpc.business.myProfiles.query>>
type Net = Awaited<ReturnType<typeof $trpc.businessNetwork.list.query>>
type Contact = Net['contacts'][number]
const data = ref<Data | null>(null)
const net = ref<Net | null>(null)
const loading = ref(true)
const netLoading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await $trpc.business.myProfiles.query()
  } catch (e: any) {
    error.value = e?.message || 'Could not load your network.'
  } finally {
    loading.value = false
  }
}

async function loadNetwork() {
  netLoading.value = true
  try {
    net.value = await $trpc.businessNetwork.list.query(businessProfile.value ? { username: businessProfile.value } : undefined)
  } catch (e: any) {
    error.value = e?.message || 'Could not load your network.'
  } finally {
    netLoading.value = false
  }
}
onMounted(() => { load(); loadNetwork() })
watch(businessProfile, loadNetwork)

const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer', promoter: 'Promoter' }

// The switcher may point at one page; "Your pages" always lists them all.
const pageNames = computed(() => new Map((data.value?.managed ?? []).map(p => [p.username, p.name])))
const multiplePages = computed(() => (net.value?.pages.length ?? 0) > 1)

// Type filter for the contacts list.
const filter = ref<'all' | 'artist' | 'venue' | 'organizer'>('all')
const filters = computed(() => {
  const cs = net.value?.contacts ?? []
  return [
    { value: 'all' as const, label: 'All', count: cs.length },
    { value: 'artist' as const, label: 'Artists', count: cs.filter(c => c.type === 'artist').length },
    { value: 'venue' as const, label: 'Venues', count: cs.filter(c => c.type === 'venue').length },
    { value: 'organizer' as const, label: 'Organizers', count: cs.filter(c => c.type === 'organizer').length },
  ]
})
const shown = computed(() => (net.value?.contacts ?? []).filter(c => filter.value === 'all' || c.type === filter.value))

const monthYear = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  : ''

// ── Curate: hide / restore ────────────────────────────────────────────────
const busy = ref<string | null>(null)
const lastHidden = ref<Contact | null>(null)

async function hide(c: Contact) {
  busy.value = c.username
  try {
    await $trpc.businessNetwork.hide.mutate({ from: c.via, username: c.username })
    lastHidden.value = c
    await loadNetwork()
  } finally {
    busy.value = null
  }
}
async function restore(c: { username: string; via: string[] }) {
  busy.value = c.username
  try {
    await $trpc.businessNetwork.restore.mutate({ from: c.via, username: c.username })
    if (lastHidden.value?.username === c.username) lastHidden.value = null
    await loadNetwork()
  } finally {
    busy.value = null
  }
}
const showHidden = ref(false)

// ── Curate: add by search ─────────────────────────────────────────────────
const adding = ref(false)
const query = ref('')
const results = ref<{ username: string; name: string; type: string; city: string | null; photo: string | null }[]>([])
const searching = ref(false)
const addFrom = ref('')
const addError = ref<string | null>(null)
const inNetwork = computed(() => new Set([
  ...(net.value?.contacts ?? []).map(c => c.username),
  ...(net.value?.pages ?? []).map(p => p.username),
]))

function openAdd() {
  adding.value = true
  addError.value = null
  addFrom.value = businessProfile.value || net.value?.pages[0]?.username || ''
}
function closeAdd() {
  adding.value = false
  query.value = ''
  results.value = []
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(searchTimer)
  if (q.trim().length < 2) {
    results.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      results.value = await $trpc.businessEvents.searchProfiles.query({ q: q.trim() })
    } finally {
      searching.value = false
    }
  }, 250)
})

async function add(username: string) {
  if (!addFrom.value) return
  addError.value = null
  busy.value = username
  try {
    await $trpc.businessNetwork.add.mutate({ from: addFrom.value, username })
    await loadNetwork()
  } catch (e: any) {
    addError.value = e?.message || 'Could not add them.'
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div>
    <AdminPageHeader eyebrow="Business" title="Network" description="Your pages, and the artists, venues and organizers you work with.">
      <Button variant="outline-pill" size="pill-sm" as-child>
        <NuxtLink to="/business/claim"><Search /> Find my page</NuxtLink>
      </Button>
      <Button variant="pill" size="pill-sm" as-child>
        <NuxtLink to="/business/new"><Plus /> Create</NuxtLink>
      </Button>
    </AdminPageHeader>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="loading" kind="loading" />

    <template v-else-if="data">
      <AdminState
        v-if="!data.managed.length && !data.claims.length"
        kind="empty"
        message="Your network starts with your own page."
        hint="It may already be here: WeDance lists thousands of artists, venues and organizers. Find yours and claim it, or create a new one."
      />

      <section v-if="data.managed.length" class="mt-6">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Your pages</h2>
        <div class="mt-3 grid gap-3">
          <NuxtLink
            v-for="p in data.managed"
            :key="p.username"
            :to="`/business/network/${p.username}`"
            class="group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-wd-card transition-colors hover:bg-accent/40"
          >
            <img v-if="p.photo" :src="p.photo" :alt="p.name" class="size-12 rounded-xl object-cover bg-muted">
            <div v-else class="size-12 rounded-xl bg-muted" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-base font-bold leading-tight truncate">{{ p.name }}</h3>
                <AdminStatus>{{ typeLabel[p.type] || p.type }}</AdminStatus>
              </div>
              <p class="mt-0.5 text-sm text-muted-foreground truncate">@{{ p.username }}<template v-if="p.city"> · {{ p.city }}</template></p>
            </div>
            <ArrowRight class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </NuxtLink>
        </div>
      </section>

      <!-- People you work with (RAZ-408) -->
      <section v-if="data.managed.length" class="mt-10">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">People you work with</h2>
          <Button v-if="!adding" variant="outline-pill" size="pill-sm" class="ml-auto" @click="openAdd"><UserPlus /> Add</Button>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">Everyone you shared an event with, plus anyone you add. Hide anyone who doesn’t belong.</p>

        <!-- Add by search -->
        <div v-if="adding" class="mt-4 rounded-2xl border bg-card p-4 shadow-wd-card">
          <div class="flex items-center gap-2">
            <p class="font-display font-bold">Add to your network</p>
            <button type="button" class="ml-auto p-1 text-muted-foreground hover:text-foreground" aria-label="Close" @click="closeAdd"><X class="size-4" /></button>
          </div>
          <div class="mt-3 grid gap-3" :class="multiplePages ? 'sm:grid-cols-[1fr_14rem]' : ''">
            <div class="relative">
              <Search class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input v-model="query" placeholder="Search artists, venues, organizers…" class="pl-9" autocomplete="off" autofocus />
            </div>
            <Field v-if="multiplePages" label="Add to" hide-label>
              <Select v-model="addFrom" :options="(net?.pages ?? []).map(p => ({ label: `For ${p.name}`, value: p.username }))" />
            </Field>
          </div>
          <p v-if="addError" class="mt-2 text-xs text-destructive">{{ addError }}</p>
          <div class="mt-3 grid gap-1">
            <p v-if="searching" class="text-xs text-muted-foreground px-1">Searching…</p>
            <p v-else-if="query.trim().length >= 2 && !results.length" class="text-xs text-muted-foreground px-1">No one found. Try their name or @handle.</p>
            <div v-for="r in results" :key="r.username" class="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
              <img v-if="r.photo" :src="r.photo" :alt="r.name" class="size-9 rounded-lg object-cover bg-muted">
              <div v-else class="size-9 rounded-lg bg-muted" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">{{ r.name }} <span class="font-normal text-muted-foreground">· {{ typeLabel[r.type] || r.type }}</span></p>
                <p class="text-xs text-muted-foreground truncate">@{{ r.username }}<template v-if="r.city"> · {{ r.city }}</template></p>
              </div>
              <AdminStatus v-if="inNetwork.has(r.username)" tone="success">In network</AdminStatus>
              <Button v-else variant="outline-pill" size="pill-sm" :disabled="busy === r.username" @click="add(r.username)"><Plus /> Add</Button>
            </div>
          </div>
        </div>

        <!-- Undo the last hide -->
        <div v-if="lastHidden" class="mt-4 flex items-center gap-3 rounded-xl border bg-muted/50 px-4 py-2.5 text-sm" role="status">
          <EyeOff class="size-4 text-muted-foreground" aria-hidden="true" />
          <span class="flex-1 min-w-0 truncate">{{ lastHidden.name }} is hidden from your network.</span>
          <Button variant="link" class="h-auto p-0" @click="restore(lastHidden)"><Undo2 class="size-4" /> Undo</Button>
        </div>

        <AdminState v-if="netLoading && !net" kind="loading" />
        <template v-else-if="net">
          <div v-if="net.contacts.length" class="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by type">
            <button
              v-for="f in filters"
              :key="f.value"
              type="button"
              role="tab"
              :aria-selected="filter === f.value"
              :disabled="!f.count && f.value !== 'all'"
              class="h-8 px-3 rounded-full border text-xs font-semibold transition-colors disabled:opacity-40"
              :class="filter === f.value ? 'border-primary bg-primary/10 text-wd-red-800' : 'border-border text-muted-foreground hover:text-foreground'"
              @click="filter = f.value"
            >{{ f.label }} <span class="opacity-70">{{ f.count }}</span></button>
          </div>

          <AdminState
            v-if="!net.contacts.length"
            kind="empty"
            class="mt-4"
            message="No one here yet."
            hint="People show up when you share an event with them: the venue you play at, the organizer who books you, the artists on the same night. You can also add anyone yourself."
          />

          <div v-else class="mt-3 grid gap-3" :class="netLoading ? 'opacity-60' : ''">
            <div
              v-for="c in shown"
              :key="c.username"
              class="group flex items-start gap-4 rounded-2xl border bg-card p-4 shadow-wd-card"
            >
              <NuxtLink :to="`/@${c.username}`" class="shrink-0">
                <img v-if="c.photo" :src="c.photo" :alt="c.name" class="size-12 rounded-xl object-cover bg-muted">
                <div v-else class="size-12 rounded-xl bg-muted" />
              </NuxtLink>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <NuxtLink :to="`/@${c.username}`" class="text-base font-bold leading-tight truncate hover:underline">{{ c.name }}</NuxtLink>
                  <AdminStatus>{{ typeLabel[c.type] || c.type }}</AdminStatus>
                  <AdminStatus v-if="c.added && !c.sharedEvents" tone="info">Added by you</AdminStatus>
                </div>
                <p class="mt-0.5 text-sm text-muted-foreground truncate">@{{ c.username }}<template v-if="c.city"> · {{ c.city }}</template></p>
                <p v-if="c.sharedEvents" class="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                  <CalendarDays class="size-3.5 shrink-0" aria-hidden="true" />
                  <span class="truncate">
                    {{ c.sharedEvents }} shared {{ c.sharedEvents === 1 ? 'event' : 'events' }}<template v-if="c.next || c.last"> · {{ c.next ? 'next' : 'last' }}:
                    <NuxtLink :to="(c.next || c.last)!.href" class="text-foreground hover:underline">{{ (c.next || c.last)!.name }}</NuxtLink><template v-if="(c.next || c.last)!.startDate">, {{ monthYear((c.next || c.last)!.startDate) }}</template></template>
                  </span>
                </p>
                <p v-if="multiplePages && !businessProfile" class="mt-1 text-[11px] text-muted-foreground truncate">
                  via {{ c.via.map(v => pageNames.get(v) || v).join(', ') }}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="shrink-0 text-muted-foreground"
                :aria-label="c.added && !c.sharedEvents ? `Remove ${c.name}` : `Hide ${c.name}`"
                :title="c.added && !c.sharedEvents ? 'Remove from network' : 'Hide from network'"
                :disabled="busy === c.username"
                @click="c.added && !c.sharedEvents ? restore(c) : hide(c)"
              >
                <X v-if="c.added && !c.sharedEvents" class="size-4" />
                <EyeOff v-else class="size-4" />
              </Button>
            </div>
          </div>

          <!-- Hidden contacts, restorable -->
          <div v-if="net.hidden.length" class="mt-4">
            <button type="button" class="text-xs font-semibold text-muted-foreground hover:text-foreground" :aria-expanded="showHidden" @click="showHidden = !showHidden">
              {{ showHidden ? 'Hide' : 'Show' }} {{ net.hidden.length }} hidden
            </button>
            <div v-if="showHidden" class="mt-2 grid gap-2">
              <div v-for="c in net.hidden" :key="c.username" class="flex items-center gap-3 rounded-xl border border-dashed px-4 py-2.5">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold truncate">{{ c.name }} <span class="font-normal text-muted-foreground">· {{ typeLabel[c.type] || c.type }}</span></p>
                  <p class="text-xs text-muted-foreground truncate">@{{ c.username }}</p>
                </div>
                <Button variant="link" class="h-auto p-0" :disabled="busy === c.username" @click="restore(c)"><Undo2 class="size-4" /> Restore</Button>
              </div>
            </div>
          </div>
        </template>
      </section>

      <section v-if="data.claims.length" class="mt-10">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Your requests</h2>
        <div class="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
          <div v-for="c in data.claims" :key="c.id" class="rounded-2xl border bg-card p-4">
            <div class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">{{ c.name }}</p>
                <p class="text-xs text-muted-foreground">@{{ c.username }}</p>
              </div>
              <AdminStatus v-if="c.status === 'pending'" tone="warning">{{ c.kind === 'join' ? 'Waiting for the owners' : 'Waiting for WeDance' }}</AdminStatus>
              <AdminStatus v-else-if="c.status === 'info_required'" tone="warning">More info needed</AdminStatus>
              <AdminStatus v-else tone="danger">Not approved</AdminStatus>
            </div>
            <div v-if="c.status === 'info_required' && c.reviewerNote" class="mt-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm">
              <p class="text-muted-foreground text-xs font-medium mb-1">WeDance asked:</p>
              <p class="whitespace-pre-line">{{ c.reviewerNote }}</p>
              <NuxtLink :to="`/business/claim?profile=${c.username}`" class="mt-2 inline-block text-xs font-medium text-secondary hover:underline">
                Update your claim &rarr;
              </NuxtLink>
            </div>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">WeDance reviews claims by hand; join requests go to the page’s owners.</p>
      </section>
    </template>
  </div>
</template>

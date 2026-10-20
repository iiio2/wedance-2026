<script setup lang="ts">
/**
 * /elections/<handle> — the moderator election for a free/OpenAir commons
 * (epic G800). Open verifiable ballot: candidates propose guidelines, the
 * community votes on a timestamped, attributable, editable-with-history ledger,
 * and the winner's guidelines become the space's active ruleset.
 */
import { ShieldCheck, ArrowLeft, Check, X, ScrollText, Clock, History, Trophy, Users, Plus, Inbox, Calendar } from 'lucide-vue-next'
import { NominationSchema } from '#shared/validation'
import { initialOf } from '#shared/utils/initials'

definePageMeta({ layout: false })

const route = useRoute()
const { $trpc } = useNuxtApp()
const { isSignedIn, username, isAdmin } = useAuth()

const handle = computed(() => String(route.params.handle).replace(/^@/, ''))

const pending = ref(true)
const notFound = ref(false)
const profile = ref<any>(null)
const data = ref<any>(null)         // election.forProfile result
const mine = ref<any>(null)         // election.myVote result
const queue = ref<any[]>([])        // G804: pending free-booking requests (steward)
const showAuth = ref(false)
const busy = ref('')                // id of the in-flight action, for button state
const err = ref('')

const election = computed(() => data.value?.election ?? null)
const candidates = computed<any[]>(() => data.value?.candidates ?? [])
const ledger = computed<any[]>(() => data.value?.ledger ?? [])
const phase = computed<string>(() => election.value?.status ?? 'none')
const winner = computed(() => candidates.value.find(c => c.id === election.value?.winnerCandidateId) ?? null)
// Steward = admin or the space's current elected moderator (may run the election).
const isSteward = computed(() => {
  if (isAdmin.value) return true
  const h = (profile.value?.moderatorHandle || '').replace(/^@/, '')
  return Boolean(h && username.value && h === username.value)
})

const nom = reactive({ open: false, guidelines: '', statement: '', busy: false, err: '' })
const nomForm = reactive(useFormValidation(NominationSchema, nom))

async function resolve() {
  pending.value = true
  notFound.value = false
  try {
    const pro = await $trpc.entity.getByHandle.query({ handle: handle.value })
    if (!pro) { notFound.value = true; pending.value = false; return }
    profile.value = pro.profile
    await loadElection()
    if (isSteward.value) await loadQueue()
  } catch { notFound.value = true }
  pending.value = false
}

// G804 — the elected moderator's free-booking queue.
async function loadQueue() {
  try { queue.value = await $trpc.election.pendingBookings.query({ profileId: profile.value.id }) }
  catch { queue.value = [] }
}
async function moderateBooking(id: string, action: 'accept' | 'decline') {
  busy.value = id
  try {
    await $trpc.election.moderateBooking.mutate({ bookingId: id, action })
    await loadQueue()
  } catch (e: any) { err.value = e?.message || 'Could not update that request.' }
  busy.value = ''
}
function fmtDate(d: any) { if (!d) return 'Date TBD'; try { return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return String(d) } }

async function loadElection() {
  data.value = await $trpc.election.forProfile.query({ profileId: profile.value.id })
  mine.value = null
  if (isSignedIn.value && election.value) {
    try { mine.value = await $trpc.election.myVote.query({ electionId: election.value.id }) } catch { /* not voted */ }
  }
}

function requireAuth(): boolean {
  if (isSignedIn.value) return true
  showAuth.value = true
  return false
}

async function openElection() {
  err.value = ''
  busy.value = 'open'
  try {
    await $trpc.election.open.mutate({ profileId: profile.value.id })
    await loadElection()
  } catch (e: any) { err.value = e?.message || 'Could not open the election.' }
  busy.value = ''
}

async function submitNomination() {
  nom.err = ''
  if (!requireAuth()) return
  const result = nomForm.validate()
  if (!result.success) return
  nom.busy = true
  try {
    await $trpc.election.nominate.mutate({ electionId: election.value.id, ...result.data })
    useTrack().track('election_nominated', { election_id: election.value.id })
    nom.open = false; nom.guidelines = ''; nom.statement = ''
    await loadElection()
  } catch (e: any) { nom.err = e?.message || 'Could not submit your candidacy.' }
  nom.busy = false
}

async function advance() {
  busy.value = 'advance'
  try { await $trpc.election.advanceToVoting.mutate({ electionId: election.value.id }); await loadElection() }
  catch (e: any) { err.value = e?.message || 'Could not open voting.' }
  busy.value = ''
}

async function closeElection() {
  busy.value = 'close'
  try { await $trpc.election.close.mutate({ electionId: election.value.id }); await loadElection() }
  catch (e: any) { err.value = e?.message || 'Could not close the election.' }
  busy.value = ''
}

async function vote(candidateId: string) {
  err.value = ''
  if (!requireAuth()) return
  busy.value = candidateId
  try {
    await $trpc.election.castVote.mutate({ electionId: election.value.id, candidateId })
    useTrack().track('video_vote', { kind: 'moderator_election', election_id: election.value.id })
    await loadElection()
  } catch (e: any) { err.value = e?.message || 'Could not record your vote.' }
  busy.value = ''
}

function fmt(d: any) {
  if (!d) return ''
  try { return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(d) }
}
function candName(id: string) { return candidates.value.find(c => c.id === id)?.name ?? 'a candidate' }
const phaseLabel: Record<string, string> = { nominations: 'Nominations open', voting: 'Voting open', closed: 'Closed', none: 'Not started' }
const phaseTone: Record<string, 'warning' | 'success' | 'neutral'> = { nominations: 'warning', voting: 'success', closed: 'neutral', none: 'warning' }

watch(isSignedIn, async () => {
  if (election.value) await loadElection()
  if (isSteward.value) await loadQueue(); else queue.value = []
})
onMounted(resolve)
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <section v-if="pending" class="max-w-2xl mx-auto px-4 py-24 text-center">
      <div class="inline-block size-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </section>

    <section v-else-if="notFound" class="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 class="text-4xl">Space not found</h1>
      <p class="mt-4 text-sm text-muted-foreground font-sans">There's no WeDance space at <span class="font-bold">@{{ handle }}</span>.</p>
      <NuxtLink to="/cities" class="inline-flex items-center gap-1 mt-6 text-xs font-bold text-primary font-sans"><ArrowLeft class="size-3" aria-hidden="true" /> Browse cities</NuxtLink>
    </section>

    <template v-else>
      <!-- Header -->
      <section class="max-w-2xl mx-auto px-4 pt-12 pb-4 font-sans">
        <NuxtLink :to="`/@${handle}`" class="inline-flex items-center gap-1 text-xs font-bold mb-4 text-primary"><ArrowLeft class="size-3" aria-hidden="true" /> {{ profile.name }}</NuxtLink>
        <div class="rounded-2xl overflow-hidden bg-card border border-primary/20 shadow-[0_10px_28px_rgba(59,31,18,0.06)]">
          <div class="h-2 bg-linear-135/srgb from-wd-red-600 to-wd-orange-500" />
          <div class="p-6 sm:p-8">
            <div class="flex items-center gap-2">
              <ShieldCheck class="size-4 text-primary" aria-hidden="true" />
              <span class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">Moderator election</span>
              <AdminStatus :tone="phaseTone[phase] || 'warning'" class="ml-auto">{{ phaseLabel[phase] }}</AdminStatus>
            </div>
            <h1 class="text-3xl leading-tight mt-1 font-display">{{ profile.name }}</h1>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
              This is a free, community-run space. Each year the community elects a moderator, who proposes the guidelines the space runs by. Votes are <b>public and timestamped</b> — you can always check your own vote is unchanged.
            </p>
            <div v-if="election" class="mt-3 flex flex-wrap gap-4 text-xs text-secondary">
              <span v-if="election.termStart" class="inline-flex items-center gap-1"><Clock class="size-3" aria-hidden="true" /> Term {{ String(election.termStart).slice(0,4) }}–{{ String(election.termEnd).slice(0,4) }}</span>
              <span class="inline-flex items-center gap-1"><Users class="size-3" aria-hidden="true" /> {{ data.totalVotes }} vote{{ data.totalVotes === 1 ? '' : 's' }}</span>
            </div>
          </div>
        </div>
      </section>

      <p v-if="err" role="alert" class="max-w-2xl mx-auto px-4 text-sm text-primary font-sans">{{ err }}</p>

      <!-- No election yet -->
      <section v-if="!election" class="max-w-2xl mx-auto px-4 py-8 text-center font-sans">
        <ScrollText class="size-8 mx-auto text-secondary/40" aria-hidden="true" />
        <p class="mt-3 text-sm text-muted-foreground">No election has been held for this space yet.</p>
        <Button v-if="isSteward" variant="cta" class="mt-5" :loading="busy==='open'" @click="openElection">
          <Plus v-if="busy!=='open'" /> Open the first election
        </Button>
      </section>

      <!-- Winner banner (closed) -->
      <section v-if="phase==='closed' && winner" class="max-w-2xl mx-auto px-4 pb-2 font-sans">
        <div class="rounded-2xl p-5 flex items-start gap-3 bg-success/6 border border-success/20">
          <Trophy class="size-6 shrink-0 text-success" aria-hidden="true" />
          <div>
            <div class="text-sm font-bold text-wd-green-700">{{ winner.name }} is the elected moderator</div>
            <div class="text-xs mt-0.5 text-muted-foreground">Their guidelines are now the space's active ruleset.</div>
          </div>
        </div>
      </section>

      <!-- Candidates -->
      <section v-if="election && candidates.length" class="max-w-2xl mx-auto px-4 py-4 font-sans">
        <h2 class="text-xs uppercase tracking-[0.28em] font-bold mb-3 text-secondary">Candidates &amp; their guidelines</h2>
        <div class="space-y-3">
          <div v-for="c in candidates" :key="c.id" class="rounded-2xl bg-card border p-5" :class="c.id===election.winnerCandidateId ? 'border-success/35' : 'border-primary/20'">
            <div class="flex items-start gap-3">
              <img v-if="c.photo" :src="c.photo" :alt="c.name" class="size-11 rounded-full object-cover border-2 border-primary/20">
              <div v-else class="size-11 rounded-full flex items-center justify-center text-white font-bold bg-linear-135/srgb from-wd-red-600 to-wd-orange-500">{{ initialOf(c.name) }}</div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-foreground">{{ c.name }}</span>
                  <NuxtLink v-if="c.username" :to="`/@${c.username}`" class="text-xs text-secondary">@{{ c.username }}</NuxtLink>
                  <span class="ml-auto text-xs font-bold text-primary">{{ c.votes }} vote{{ c.votes===1?'':'s' }}</span>
                </div>
                <p v-if="c.statement" class="text-sm mt-1 italic text-muted-foreground">"{{ c.statement }}"</p>
                <p class="text-sm mt-2 whitespace-pre-line text-foreground">{{ c.guidelines }}</p>
                <div v-if="phase==='voting'" class="mt-3">
                  <Button
                    :variant="mine?.candidateId===c.id ? 'pill' : 'soft'"
                    size="pill-sm"
                    :accent="mine?.candidateId===c.id ? 'var(--wd-green-700)' : undefined"
                    :loading="busy===c.id"
                    :aria-pressed="mine?.candidateId===c.id"
                    @click="vote(c.id)"
                  >
                    <Check v-if="mine?.candidateId===c.id && busy!==c.id" />
                    {{ mine?.candidateId===c.id ? 'Your vote' : (mine?.candidateId ? 'Switch to this' : 'Vote') }}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Your vote (trust panel) -->
      <section v-if="election && mine?.candidateId" class="max-w-2xl mx-auto px-4 py-2 font-sans">
        <div class="rounded-2xl p-4 text-sm bg-wd-orange-500/6 border border-wd-orange-500/20 text-wd-amber-800">
          <div class="flex items-center gap-1.5 font-bold"><History class="size-4" aria-hidden="true" /> Your vote is on the record</div>
          <p class="mt-1">You're currently backing <b>{{ candName(mine.candidateId) }}</b><span v-if="mine.history?.length > 1"> · changed {{ mine.history.length - 1 }} time{{ mine.history.length-1===1?'':'s' }}</span><span v-if="mine.lastChangedAt"> · last set {{ fmt(mine.lastChangedAt) }}</span>. Anyone can see it in the ledger below — so a friend can confirm it's unchanged.</p>
        </div>
      </section>

      <!-- Nominate (nominations phase) -->
      <section v-if="phase==='nominations'" class="max-w-2xl mx-auto px-4 py-4 font-sans">
        <div v-if="!nom.open">
          <Button variant="cta" @click="requireAuth() && (nom.open = true)">
            <Plus /> Stand as a candidate
          </Button>
        </div>
        <form v-else class="rounded-2xl bg-card border border-primary/20 p-5" novalidate @submit.prevent="submitNomination">
          <h3 class="font-bold text-foreground">Your candidacy</h3>
          <p class="text-xs mt-1 text-secondary">Propose the guidelines you'd run the space by. The community elects you on this.</p>
          <Field id="nom-guidelines" label="Guidelines the space would run by" :error="nomForm.errors.guidelines" class="mt-4">
            <Textarea v-model="nom.guidelines" :rows="5" placeholder="e.g. Open to all levels; no reserved slots before 6pm; keep the volume neighbour-friendly after 22:00…" v-bind="nomForm.fieldAttrs('guidelines', 'nom-guidelines-error')" />
          </Field>
          <Field id="nom-statement" label="Short pitch" optional :error="nomForm.errors.statement" class="mt-3">
            <Input v-model="nom.statement" maxlength="600" placeholder="One line on why you'd steward it well." v-bind="nomForm.fieldAttrs('statement', 'nom-statement-error')" />
          </Field>
          <p v-if="nom.err" role="alert" class="text-xs mt-2 text-primary">{{ nom.err }}</p>
          <div class="flex gap-2 mt-4">
            <Button type="submit" variant="pill" :loading="nom.busy">Submit candidacy</Button>
            <Button type="button" variant="ghost" class="text-secondary" @click="nom.open = false; nomForm.reset()">Cancel</Button>
          </div>
        </form>
      </section>

      <!-- Open ledger -->
      <section v-if="election && ledger.length" class="max-w-2xl mx-auto px-4 py-4 font-sans">
        <h2 class="text-xs uppercase tracking-[0.28em] font-bold mb-1 text-secondary">The ledger</h2>
        <p class="text-xs mb-3 text-muted-foreground">
          Every vote, timestamped and public.
          <span v-if="!data.viewerSignedIn">Sign in to see who each vote belongs to.</span>
          <span v-else>Voter identity is shown to signed-in members only.</span>
        </p>
        <div class="rounded-2xl bg-card border border-primary/20 divide-y divide-primary/20">
          <div v-for="(v, i) in ledger" :key="i" class="flex items-center gap-3 px-4 py-2.5 text-sm">
            <template v-if="v.voter">
              <img v-if="v.voter.photo" :src="v.voter.photo" class="size-6 rounded-full object-cover" :alt="v.voter.name">
              <div v-else class="size-6 rounded-full flex items-center justify-center text-eyebrow text-white font-bold bg-secondary">{{ initialOf(v.voter.name) }}</div>
              <span class="text-foreground">{{ v.voter.name }}</span>
            </template>
            <template v-else>
              <div class="size-6 rounded-full flex items-center justify-center bg-primary/8"><Users class="size-3 text-secondary" aria-hidden="true" /></div>
              <span class="text-secondary">A member</span>
            </template>
            <span class="text-muted-foreground">→ {{ candName(v.candidateId) }}</span>
            <AdminStatus v-if="v.changed" tone="warning">changed</AdminStatus>
            <span class="ml-auto text-xs text-secondary">{{ fmt(v.votedAt) }}</span>
          </div>
        </div>
      </section>

      <!-- Booking queue (G804) — the elected moderator approves/declines free bookings -->
      <section v-if="isSteward" class="max-w-2xl mx-auto px-4 py-4 font-sans">
        <h2 class="text-xs uppercase tracking-[0.28em] font-bold mb-1 text-secondary">Booking queue</h2>
        <p class="text-xs mb-3 text-muted-foreground">Pending requests for the free floor. Approve against the active guidelines — accepted slots show up in the space's schedule.</p>
        <div v-if="!queue.length" class="rounded-2xl bg-card border border-primary/20 p-6 text-center text-sm text-secondary">
          <Inbox class="size-6 mx-auto mb-2 text-secondary/40" aria-hidden="true" /> No pending requests.
        </div>
        <div v-else class="space-y-3">
          <div v-for="b in queue" :key="b.id" class="rounded-2xl bg-card border border-primary/20 p-4">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-foreground">{{ b.title || 'Untitled event' }}<AdminStatus v-if="b.eventType" tone="accent" class="ml-2">{{ b.eventType }}</AdminStatus></div>
                <div class="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-secondary">
                  <span class="inline-flex items-center gap-1"><Calendar class="size-3" aria-hidden="true" /> {{ fmtDate(b.eventDate) }}<span v-if="b.startTime"> · {{ b.startTime }}<span v-if="b.endTime">–{{ b.endTime }}</span></span></span>
                  <span v-if="b.requesterName || b.requesterEmail" class="inline-flex items-center gap-1"><Users class="size-3" aria-hidden="true" /> {{ b.requesterName || b.requesterEmail }}</span>
                </div>
                <p v-if="b.message" class="text-sm mt-2 text-muted-foreground">{{ b.message }}</p>
              </div>
            </div>
            <div class="flex gap-2 mt-3">
              <Button variant="pill" size="pill-sm" accent="var(--wd-green-700)" :disabled="busy===b.id" @click="moderateBooking(b.id, 'accept')"><Check /> Approve</Button>
              <Button variant="soft" size="pill-sm" :disabled="busy===b.id" @click="moderateBooking(b.id, 'decline')"><X /> Decline</Button>
            </div>
          </div>
        </div>
      </section>

      <!-- Steward controls -->
      <section v-if="election && isSteward && phase!=='closed'" class="max-w-2xl mx-auto px-4 py-6 font-sans">
        <div class="rounded-2xl p-4 bg-foreground/3 border border-dashed border-input">
          <div class="text-eyebrow uppercase tracking-[0.28em] font-bold mb-2 text-secondary">Steward controls</div>
          <div class="flex flex-wrap gap-2">
            <Button v-if="phase==='nominations'" variant="pill" accent="var(--wd-green-700)" :loading="busy==='advance'" :disabled="!candidates.length" @click="advance">Open voting</Button>
            <Button v-if="phase==='voting'" variant="pill" :loading="busy==='close'" @click="closeElection">Close &amp; declare winner</Button>
          </div>
        </div>
      </section>
    </template>

    <SignUpModal v-model:open="showAuth" action="signin" />
  </div>
</template>

<script setup lang="ts">
/**
 * /business/profiles/<handle>/team — who manages this profile. Owners approve
 * join requests, change roles and titles, remove people, and see the history.
 * Everyone on the team can leave (except the last owner). WeDance admins can
 * release the page: everyone leaves, so its owner can claim it.
 */
import { Check, X, LogOut, Unlink } from 'lucide-vue-next'

definePageMeta({ layout: 'business' })

const route = useRoute()
const { $trpc } = useNuxtApp()
const username = computed(() => String(route.params.username))

type Team = Awaited<ReturnType<typeof $trpc.businessTeam.team.query>>
type History = Awaited<ReturnType<typeof $trpc.businessTeam.history.query>>
const team = ref<Team | null>(null)
const history = ref<History>([])
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const busy = ref<string | null>(null)

const { isAdmin } = useAuth()
const isOwner = computed(() => team.value?.myRole === 'owner')
const confirmRelease = ref(false)
const release = () => run('release', () => $trpc.businessTeam.release.mutate({ username: username.value }), 'Released. Nobody manages this page now: its owner can claim it from an invite link or the page.').then(() => { confirmRelease.value = false })
const ownerCount = computed(() => team.value?.members.filter(m => m.role === 'owner').length ?? 0)

async function load() {
  error.value = null
  try {
    team.value = await $trpc.businessTeam.team.query({ username: username.value })
    history.value = isOwner.value ? await $trpc.businessTeam.history.query({ username: username.value }) : []
  } catch (e: any) {
    error.value = e?.message || 'Could not load the team.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
useHead(() => ({ title: `Team · ${team.value?.profile.name ?? 'Profile'} | Business | WeDance` }))

async function run(key: string, fn: () => Promise<unknown>, done: string) {
  busy.value = key
  error.value = null
  notice.value = null
  try {
    await fn()
    notice.value = done
    await load()
  } catch (e: any) {
    error.value = e?.message || 'That didn’t work.'
  } finally {
    busy.value = null
  }
}

// Per-request role choice, defaulting to what they asked for.
const joinRole = reactive<Record<string, 'owner' | 'editor'>>({})
const decide = (r: Team['requests'][number], approve: boolean) =>
  run(r.id, () => $trpc.businessTeam.decideJoin.mutate({ requestId: r.id, approve, role: joinRole[r.id] ?? r.requestedRole as any }), approve ? `${r.name} is on the team.` : `Declined ${r.name}’s request.`)

const setRole = (m: Team['members'][number], role: 'owner' | 'editor') =>
  run(m.dancerId, () => $trpc.businessTeam.setRole.mutate({ username: username.value, dancerId: m.dancerId, role }), `${m.name} is now ${role === 'owner' ? 'an owner' : 'an editor'}.`)

const confirmRemove = ref<string | null>(null)
const remove = (m: Team['members'][number]) =>
  run(m.dancerId, async () => {
    await $trpc.businessTeam.removeMember.mutate({ username: username.value, dancerId: m.dancerId })
    if (m.me) await navigateTo('/business/profiles')
  }, m.me ? 'You left the team.' : `${m.name} was removed.`)

const roleOptions = [{ label: 'Owner — edits and manages the team', value: 'owner' }, { label: 'Editor — edits the profile and events', value: 'editor' }]
const actionLabel: Record<string, string> = { created: 'created the profile', requested: 'asked for access', approved: 'approved', rejected: 'declined', role_changed: 'changed the role of', removed: 'removed', left: 'left' }
const fmt = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
</script>

<template>
  <div>
    <AdminState v-if="loading" kind="loading" />
    <AdminState v-else-if="!team" kind="error" :message="error || 'Team not found.'" />

    <template v-else>
      <AdminPageHeader
        :eyebrow="team.profile.name"
        title="Team"
        description="Owners edit everything and manage the team. Editors edit the profile and events."
        :back="{ to: `/business/profiles/${team.profile.username}`, label: team.profile.name }"
      />

      <AdminState v-if="error" kind="error" :message="error" />
      <p v-if="notice" role="status" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm font-bold text-wd-green-700">
        <Check class="size-4" aria-hidden="true" /> {{ notice }}
      </p>

      <section v-if="team.requests.length" class="mt-6">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Asking to join</h2>
        <div class="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
          <div v-for="r in team.requests" :key="r.id" class="rounded-2xl border bg-card p-4">
            <p class="text-sm font-bold">{{ r.name }}<span v-if="r.title" class="font-normal text-muted-foreground"> · {{ r.title }}</span></p>
            <p class="mt-1 rounded-xl bg-muted p-3 text-sm whitespace-pre-line">{{ r.message }}</p>
            <div class="mt-3 flex flex-wrap items-end gap-2">
              <Field :id="`role-${r.id}`" label="Role" class="w-full sm:w-72">
                <Select :model-value="joinRole[r.id] ?? r.requestedRole" :options="roleOptions" size="sm" @update:model-value="v => (joinRole[r.id] = v as any)" />
              </Field>
              <Button variant="pill" size="pill-sm" :loading="busy === r.id" @click="decide(r, true)"><Check /> Approve</Button>
              <Button variant="outline-pill" size="pill-sm" :disabled="busy === r.id" @click="decide(r, false)"><X /> Decline</Button>
            </div>
          </div>
        </div>
      </section>

      <section class="mt-6">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Members</h2>
        <p v-if="!team.members.length" class="mt-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">Nobody manages this page. Its owner can claim it from an organizer’s invite link or “Is this you? Claim this page” on <NuxtLink :to="`/@${team.profile.username}`" class="font-bold text-foreground hover:underline">/@{{ team.profile.username }}</NuxtLink>.</p>
        <div class="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
          <div v-for="m in team.members" :key="m.dancerId" class="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
            <img v-if="m.photo" :src="m.photo" alt="" class="size-10 rounded-full object-cover">
            <div v-else class="size-10 rounded-full bg-muted" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold">{{ m.name }}<span v-if="m.me" class="font-normal text-muted-foreground"> (you)</span></p>
              <p class="text-xs text-muted-foreground">
                <AdminStatus :tone="m.role === 'owner' ? 'accent' : 'neutral'">{{ m.role }}</AdminStatus>
                <span v-if="m.title" class="ml-1">{{ m.title }}</span>
                <span class="ml-1">· since {{ fmt(m.since) }}</span>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <template v-if="isOwner && !m.me">
                <Button v-if="m.role === 'editor'" variant="ghost" size="sm" :loading="busy === m.dancerId" @click="setRole(m, 'owner')">Make owner</Button>
                <Button v-else variant="ghost" size="sm" :loading="busy === m.dancerId" :disabled="ownerCount <= 1" @click="setRole(m, 'editor')">Make editor</Button>
              </template>
              <template v-if="(isOwner || m.me) && !(m.role === 'owner' && ownerCount <= 1)">
                <Button v-if="confirmRemove !== m.dancerId" variant="ghost" size="sm" @click="confirmRemove = m.dancerId">
                  <LogOut v-if="m.me" /> {{ m.me ? 'Leave' : 'Remove' }}
                </Button>
                <template v-else>
                  <Button variant="destructive" size="sm" :loading="busy === m.dancerId" @click="remove(m)">{{ m.me ? 'Yes, leave' : `Yes, remove ${m.name}` }}</Button>
                  <Button variant="ghost" size="sm" @click="confirmRemove = null">Cancel</Button>
                </template>
              </template>
            </div>
          </div>
        </div>
        <p v-if="ownerCount === 1 && team.members.some(m => m.me && m.role === 'owner')" class="mt-2 text-xs text-muted-foreground">You’re the only owner. Make someone else owner before you leave.</p>
        <p class="mt-3 text-xs text-muted-foreground">
          To add someone, send them this page’s link: <span class="font-mono">/@{{ team.profile.username }}</span> → “Join the team”. You’ll see their request here.
        </p>
      </section>

      <!-- WeDance admins: hand the page back to its owner -->
      <section v-if="isAdmin && team.members.length" class="mt-8 rounded-2xl border border-dashed bg-card p-4">
        <h2 class="flex items-center gap-1.5 text-sm font-bold"><Unlink class="size-4 text-muted-foreground" aria-hidden="true" /> Release this page</h2>
        <p class="mt-1 text-xs text-muted-foreground">Admin only. Everyone above leaves the team, so {{ team.profile.name }} can take the page over from an organizer’s invite link or “Is this you? Claim this page”. The page’s details stay. You can still edit it as an admin.</p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Button v-if="!confirmRelease" type="button" variant="outline-pill" size="pill-sm" @click="confirmRelease = true"><Unlink /> Release page</Button>
          <template v-else>
            <span class="text-sm font-bold">Remove all {{ team.members.length }} from the team?</span>
            <Button type="button" variant="destructive" size="sm" :disabled="busy === 'release'" @click="release">{{ busy === 'release' ? 'Releasing…' : 'Yes, release' }}</Button>
            <Button type="button" variant="ghost" size="sm" @click="confirmRelease = false">Cancel</Button>
          </template>
        </div>
      </section>

      <section v-if="isOwner && history.length" class="mt-8">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">History</h2>
        <ul class="mt-3 grid gap-1 text-sm">
          <li v-for="h in history" :key="h.id" class="text-muted-foreground">
            <span class="tabular-nums">{{ fmt(h.createdAt) }}</span> ·
            <span class="text-foreground">{{ h.actorName || 'WeDance' }}</span>
            {{ actionLabel[h.action] || h.action }}
            <template v-if="h.subjectName && h.subjectName !== h.actorName"> <span class="text-foreground">{{ h.subjectName }}</span></template>
            <template v-else-if="h.subjectName && h.action === 'removed'"> themselves</template>
            <template v-if="h.role"> ({{ h.role }}<template v-if="h.note && h.action !== 'role_changed'">, {{ h.note }}</template>)</template>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

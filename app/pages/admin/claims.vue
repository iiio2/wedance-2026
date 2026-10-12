<script setup lang="ts">
/**
 * /admin/claims — review "this is me" requests for artist / venue / organizer
 * profiles. Approve → the requester manages the profile (business mode).
 */
import { Check, X, RotateCcw, ExternalLink } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Admin: Profile claims | WeDance' })

const { $trpc } = useNuxtApp()
type Claim = Awaited<ReturnType<typeof $trpc.business.listClaims.query>>[number]
const items = ref<Claim[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = await $trpc.business.listClaims.query()
  } catch (e: any) {
    error.value = e?.message || 'Failed to load claims.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function decide(c: Claim, approve: boolean) {
  busyId.value = c.id
  error.value = null
  try {
    await $trpc.business.decideClaim.mutate({ claimId: c.id, approve })
    items.value = items.value.filter(x => x.id !== c.id)
  } catch (e: any) {
    error.value = e?.message || 'Could not update that claim.'
  } finally {
    busyId.value = null
  }
}

const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer' }
const fmt = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
</script>

<template>
  <div>
    <AdminPageHeader title="Profile claims" description="People asking to manage an artist, venue or organizer page. Check the proof they give before approving.">
      <Button variant="ghost" size="sm" class="text-secondary" :disabled="loading" @click="load">
        <RotateCcw /> Refresh
      </Button>
    </AdminPageHeader>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="loading" kind="loading" />
    <AdminState v-else-if="!items.length" kind="empty" message="No claims waiting." />

    <div v-else class="mt-6 grid gap-3">
      <div v-for="c in items" :key="c.id" class="rounded-2xl border bg-card p-4 shadow-wd-card">
        <div class="flex flex-wrap items-center gap-2">
          <AdminStatus>{{ typeLabel[c.profileType] || c.profileType }}</AdminStatus>
          <AdminStatus v-if="c.profileManaged" tone="danger">Already managed</AdminStatus>
          <span class="text-xs text-muted-foreground">{{ fmt(c.createdAt) }}</span>
        </div>
        <NuxtLink :to="`/@${c.profileUsername}`" target="_blank" class="mt-2 inline-flex items-center gap-1 text-base font-bold hover:underline">
          {{ c.profileName }} <ExternalLink class="size-3.5 text-muted-foreground" aria-hidden="true" />
        </NuxtLink>
        <p class="text-sm text-muted-foreground">
          Requested by {{ c.dancerName }} · {{ c.dancerEmail }}<template v-if="c.dancerInstagram"> · {{ c.dancerInstagram }}</template>
        </p>
        <p class="mt-2 rounded-xl bg-muted p-3 text-sm whitespace-pre-line">{{ c.message }}</p>
        <div class="mt-3 flex gap-2">
          <Button variant="pill" size="pill-sm" :loading="busyId === c.id" @click="decide(c, true)">
            <Check /> Approve
          </Button>
          <Button variant="outline-pill" size="pill-sm" :disabled="busyId === c.id" @click="decide(c, false)">
            <X /> Reject
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

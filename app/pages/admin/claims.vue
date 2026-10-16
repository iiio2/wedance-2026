<script setup lang="ts">
/**
 * /admin/claims — review "this is me" requests for artist / venue / organizer
 * profiles. Approve → the requester manages the profile (business mode).
 */
import { Check, X, RotateCcw, ExternalLink, MessageSquare, Link as LinkIcon } from 'lucide-vue-next'

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

// Reclaim: also take the current managers off (the admin decides each time).
const removeOthers = reactive<Record<string, boolean>>({})
// Reviewer notes per claim (for approve/reject/info-required).
const reviewerNotes = reactive<Record<string, string>>({})
// Which claim has the "request info" form open.
const infoFormOpen = ref<string | null>(null)

async function decide(c: Claim, approve: boolean) {
  busyId.value = c.id
  error.value = null
  try {
    await $trpc.business.decideClaim.mutate({
      claimId: c.id, approve, removeOthers: !!removeOthers[c.id],
      reviewerNote: reviewerNotes[c.id] || '',
    })
    items.value = items.value.filter(x => x.id !== c.id)
  } catch (e: any) {
    error.value = e?.message || 'Could not update that claim.'
  } finally {
    busyId.value = null
  }
}

async function requestInfo(c: Claim) {
  const note = reviewerNotes[c.id]?.trim()
  if (!note) { error.value = 'Tell them what you need before requesting more info.'; return }
  busyId.value = c.id
  error.value = null
  try {
    await $trpc.business.decideClaim.mutate({
      claimId: c.id, approve: false, requestInfo: true,
      reviewerNote: note,
    })
    items.value = items.value.filter(x => x.id !== c.id)
  } catch (e: any) {
    error.value = e?.message || 'Could not request more info.'
  } finally {
    busyId.value = null
    infoFormOpen.value = null
  }
}

const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer', promoter: 'Promoter' }
const evidenceTypeLabel: Record<string, string> = {
  domain_email: 'Email from org domain', social_media: 'Social media', website_link: 'Website link',
  documentation: 'Documentation', other: 'Other',
}
const fmt = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')
</script>

<template>
  <div>
    <AdminPageHeader title="Profile claims" description="Claims for unmanaged pages and reclaims (“it’s mine, someone else has it”). Check the proof before approving. Join requests go to each profile’s owners.">
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
          <AdminStatus :tone="c.kind === 'reclaim' ? 'danger' : c.status === 'info_required' ? 'warning' : 'neutral'">
            {{ c.status === 'info_required' ? 'Needs more info' : c.kind === 'reclaim' ? 'Reclaim' : 'Claim' }}
          </AdminStatus>
          <AdminStatus>{{ typeLabel[c.profileType] || c.profileType }}</AdminStatus>
          <span class="text-xs text-muted-foreground">{{ fmt(c.createdAt) }}</span>
        </div>
        <NuxtLink :to="`/@${c.profileUsername}`" target="_blank" class="mt-2 inline-flex items-center gap-1 text-base font-bold hover:underline">
          {{ c.profileName }} <ExternalLink class="size-3.5 text-muted-foreground" aria-hidden="true" />
        </NuxtLink>
        <p class="text-sm text-muted-foreground">
          Requested by {{ c.dancerName }} · {{ c.dancerEmail }}<template v-if="c.dancerInstagram"> · {{ c.dancerInstagram }}</template>
        </p>
        <p class="mt-2 rounded-xl bg-muted p-3 text-sm whitespace-pre-line">{{ c.message }}</p>

        <!-- Evidence section -->
        <div v-if="c.evidence" class="mt-2 rounded-xl bg-muted/50 border border-input p-3 text-sm">
          <div class="flex items-center gap-2 text-muted-foreground mb-1">
            <LinkIcon class="size-3.5" aria-hidden="true" />
            <span class="font-medium">{{ evidenceTypeLabel[c.evidenceType] || 'Evidence' }}</span>
          </div>
          <p class="whitespace-pre-line break-all">{{ c.evidence }}</p>
        </div>

        <!-- Previous reviewer note (if info was already requested once) -->
        <div v-if="c.reviewerNote" class="mt-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm">
          <p class="text-muted-foreground text-xs font-medium mb-1">Previous reviewer note</p>
          <p class="whitespace-pre-line">{{ c.reviewerNote }}</p>
        </div>

        <div v-if="c.managers.length" class="mt-2 text-sm">
          <p class="text-muted-foreground">Managed today by:
            <span v-for="(m, i) in c.managers" :key="m.email" class="text-foreground">{{ i ? ', ' : '' }}{{ m.name }} ({{ m.role }}, {{ m.email }})</span>
          </p>
          <label v-if="c.kind === 'reclaim'" class="mt-1 inline-flex items-center gap-2">
            <Checkbox :model-value="!!removeOthers[c.id]" @update:model-value="v => (removeOthers[c.id] = !!v)" /> On approve, remove them from the profile
          </label>
        </div>

        <!-- Reviewer note input (for request-info form or optional note on approve/reject) -->
        <div v-if="infoFormOpen === c.id" class="mt-3 border-t pt-3">
          <Field :id="`note-${c.id}`" label="What do you need?" hint="The claimant will see this and get an email.">
            <Textarea v-model="reviewerNotes[c.id]" :rows="2" placeholder="e.g. Please send a DM from the venue's Instagram account so we can confirm." />
          </Field>
          <div class="mt-2 flex gap-2">
            <Button variant="pill" size="pill-sm" :loading="busyId === c.id" @click="requestInfo(c)">
              <MessageSquare /> Send &amp; request info
            </Button>
            <Button variant="outline-pill" size="pill-sm" @click="infoFormOpen = null">Cancel</Button>
          </div>
        </div>

        <div v-else class="mt-3 flex flex-wrap gap-2">
          <Button variant="pill" size="pill-sm" :loading="busyId === c.id" @click="decide(c, true)">
            <Check /> Approve
          </Button>
          <Button variant="outline-pill" size="pill-sm" :disabled="busyId === c.id" @click="decide(c, false)">
            <X /> Reject
          </Button>
          <Button variant="outline-pill" size="pill-sm" :disabled="busyId === c.id" @click="infoFormOpen = c.id; reviewerNotes[c.id] = reviewerNotes[c.id] || ''">
            <MessageSquare /> Need more info
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

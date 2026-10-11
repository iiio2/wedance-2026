<script setup lang="ts">
/**
 * /admin/community-groups — list every community chat group and add new ones.
 * `admin` layout provides the sidebar + is_admin gate. Data via
 * communityGroup.listAll / .create (adminProcedure).
 */
import { Plus, ExternalLink, RotateCcw, CheckCircle2 } from 'lucide-vue-next'
import { CommunityGroupSchema } from '#shared/validation'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Admin: Community groups | WeDance' })

const { $trpc } = useNuxtApp()

type Group = {
  id: string
  citySlug: string
  name: string
  platform: 'whatsapp' | 'telegram' | 'facebook' | 'other'
  inviteUrl: string
  styles: string[]
  source: string | null
  verified: boolean | null
  status: 'visible' | 'hidden'
  createdAt: string | Date | null
}

const items = ref<Group[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = (await $trpc.communityGroup.listAll.query({})) as Group[]
  } catch (e: any) {
    error.value = e?.message || 'Failed to load community groups.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const showForm = ref(false)
const saving = ref(false)
const form = reactive({
  citySlug: '', name: '', platform: 'whatsapp' as Group['platform'], inviteUrl: '', styles: '', source: '', verified: false,
})
const { errors, validate, reset: resetValidation, fieldAttrs } = useFormValidation(CommunityGroupSchema, form)
function resetForm() {
  Object.assign(form, { citySlug: '', name: '', platform: 'whatsapp', inviteUrl: '', styles: '', source: '', verified: false })
  resetValidation()
}

async function submit() {
  error.value = null
  const result = validate()
  if (!result.success) return
  saving.value = true
  try {
    await $trpc.communityGroup.create.mutate(result.data)
    resetForm()
    showForm.value = false
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Could not create group.'
  } finally {
    saving.value = false
  }
}

const platformTone: Record<Group['platform'], 'success' | 'info' | 'neutral' | 'warning'> = { whatsapp: 'success', telegram: 'info', facebook: 'neutral', other: 'warning' }
const platformOptions = [
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Telegram', value: 'telegram' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Other', value: 'other' },
]
</script>

<template>
  <div>
    <AdminPageHeader title="Community groups" description="WhatsApp / Telegram groups shown on city pages.">
      <Button variant="ghost" size="sm" class="text-secondary" :disabled="loading" @click="load">
        <RotateCcw /> Refresh
      </Button>
      <Button variant="pill" size="pill-sm" :aria-expanded="showForm" @click="showForm = !showForm">
        <Plus /> New
      </Button>
    </AdminPageHeader>

    <AdminState v-if="error" kind="error" :message="error" />

    <form v-if="showForm" class="mt-6 rounded-2xl border bg-card p-5 shadow-wd-card" novalidate @submit.prevent="submit">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary mb-4">New group</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <Field id="group-citySlug" label="City slug" :error="errors.citySlug">
          <Input v-model="form.citySlug" placeholder="e.g. munich" v-bind="fieldAttrs('citySlug', 'group-citySlug-error')" />
        </Field>
        <Field id="group-name" label="Group name" :error="errors.name">
          <Input v-model="form.name" placeholder="e.g. Salsa Munich" v-bind="fieldAttrs('name', 'group-name-error')" />
        </Field>
        <Field id="group-platform" label="Platform">
          <Select v-model="form.platform" :options="platformOptions" />
        </Field>
        <Field id="group-inviteUrl" label="Invite URL" :error="errors.inviteUrl">
          <Input v-model="form.inviteUrl" type="url" placeholder="https://…" v-bind="fieldAttrs('inviteUrl', 'group-inviteUrl-error')" />
        </Field>
        <Field id="group-styles" label="Styles" hint="Comma-separated" optional>
          <Input v-model="form.styles" placeholder="Salsa, Bachata" />
        </Field>
        <Field id="group-source" label="Source" optional :error="errors.source">
          <Input v-model="form.source" v-bind="fieldAttrs('source', 'group-source-error')" />
        </Field>
        <Checkbox v-model="form.verified" class="sm:col-span-2">Verified</Checkbox>
      </div>
      <div class="mt-4 flex gap-2">
        <Button type="submit" variant="pill" :loading="saving">Create</Button>
        <Button type="button" variant="outline-pill" @click="showForm = false">Cancel</Button>
      </div>
    </form>

    <AdminState v-if="loading" kind="loading" />
    <AdminState v-else-if="!items.length" kind="empty" message="No community groups yet." />

    <div v-else class="mt-6 grid gap-3">
      <div v-for="grp in items" :key="grp.id" class="rounded-2xl border bg-card p-4">
        <div class="flex flex-wrap items-center gap-2">
          <AdminStatus tone="info">{{ grp.citySlug }}</AdminStatus>
          <AdminStatus :tone="platformTone[grp.platform] || 'warning'">{{ grp.platform }}</AdminStatus>
          <CheckCircle2 v-if="grp.verified" class="size-3.5 text-success" aria-label="Verified" />
          <AdminStatus v-if="grp.status === 'hidden'" tone="danger">hidden</AdminStatus>
        </div>
        <h3 class="mt-1.5 font-display text-base font-bold leading-tight text-foreground">{{ grp.name }}</h3>
        <p v-if="grp.styles?.length" class="text-xs text-muted-foreground">{{ grp.styles.join(' · ') }}</p>
        <a :href="grp.inviteUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 mt-1 text-xs font-bold text-wd-cyan-700 hover:underline">Invite link <ExternalLink class="size-3" aria-hidden="true" /></a>
      </div>
    </div>
  </div>
</template>

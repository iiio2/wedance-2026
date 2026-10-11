<script setup lang="ts">
/**
 * /admin/giveaways — list every sponsor giveaway and create new ones.
 * `admin` layout provides the sidebar + is_admin gate. Data via
 * giveaway.listAll / giveaway.create (adminProcedure).
 */
import { Plus, ExternalLink, RotateCcw } from 'lucide-vue-next'
import { GiveawaySchema } from '#shared/validation'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Admin: Giveaways | WeDance' })

const { $trpc } = useNuxtApp()

type Giveaway = {
  id: string
  citySlug: string
  sponsorName: string
  title: string
  description: string
  prizeDescription: string
  ctaUrl: string
  imageUrl: string | null
  termsUrl: string | null
  startsAt: string | Date
  endsAt: string | Date
  status: 'active' | 'ended' | 'draft'
  createdAt: string | Date | null
}

const items = ref<Giveaway[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = (await $trpc.giveaway.listAll.query({})) as Giveaway[]
  } catch (e: any) {
    error.value = e?.message || 'Failed to load giveaways.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const showForm = ref(false)
const saving = ref(false)
const form = reactive({
  citySlug: '', sponsorName: '', title: '', description: '', prizeDescription: '',
  ctaUrl: '', imageUrl: '', termsUrl: '', startsAt: '', endsAt: '', status: 'active' as 'active' | 'ended' | 'draft',
})
const { errors, validate, reset: resetValidation, fieldAttrs } = useFormValidation(GiveawaySchema, form)
function resetForm() {
  resetValidation()
  Object.assign(form, {
    citySlug: '', sponsorName: '', title: '', description: '', prizeDescription: '',
    ctaUrl: '', imageUrl: '', termsUrl: '', startsAt: '', endsAt: '', status: 'active',
  })
}

async function submit() {
  error.value = null
  const result = validate()
  if (!result.success) return
  saving.value = true
  try {
    await $trpc.giveaway.create.mutate(result.data)
    resetForm()
    showForm.value = false
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Could not create giveaway.'
  } finally {
    saving.value = false
  }
}

const fmt = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const statusTone: Record<Giveaway['status'], 'success' | 'warning' | 'neutral'> = { active: 'success', ended: 'warning', draft: 'neutral' }
const statusOptions = ['active', 'draft', 'ended']
</script>

<template>
  <div>
    <AdminPageHeader title="Giveaways" description="Create and manage sponsor giveaways per city.">
      <Button variant="ghost" size="sm" class="text-secondary" :disabled="loading" @click="load">
        <RotateCcw /> Refresh
      </Button>
      <Button variant="pill" size="pill-sm" :aria-expanded="showForm" @click="showForm = !showForm">
        <Plus /> New
      </Button>
    </AdminPageHeader>

    <AdminState v-if="error" kind="error" :message="error" />

    <!-- Create form -->
    <form v-if="showForm" class="mt-6 rounded-2xl border bg-card p-5 shadow-wd-card" novalidate @submit.prevent="submit">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary mb-4">New giveaway</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <Field id="giveaway-citySlug" label="City slug" :error="errors.citySlug">
          <Input v-model="form.citySlug" placeholder="e.g. munich" v-bind="fieldAttrs('citySlug', 'giveaway-citySlug-error')" />
        </Field>
        <Field id="giveaway-sponsorName" label="Sponsor name" :error="errors.sponsorName">
          <Input v-model="form.sponsorName" v-bind="fieldAttrs('sponsorName', 'giveaway-sponsorName-error')" />
        </Field>
        <Field id="giveaway-title" label="Title" :error="errors.title">
          <Input v-model="form.title" v-bind="fieldAttrs('title', 'giveaway-title-error')" />
        </Field>
        <Field id="giveaway-prizeDescription" label="Prize" :error="errors.prizeDescription">
          <Input v-model="form.prizeDescription" placeholder="e.g. 2 festival passes" v-bind="fieldAttrs('prizeDescription', 'giveaway-prizeDescription-error')" />
        </Field>
        <Field id="giveaway-description" label="Short description" :error="errors.description" class="sm:col-span-2">
          <Input v-model="form.description" v-bind="fieldAttrs('description', 'giveaway-description-error')" />
        </Field>
        <Field id="giveaway-ctaUrl" label="CTA URL" :error="errors.ctaUrl">
          <Input v-model="form.ctaUrl" type="url" placeholder="https://…" v-bind="fieldAttrs('ctaUrl', 'giveaway-ctaUrl-error')" />
        </Field>
        <Field id="giveaway-imageUrl" label="Image URL" optional :error="errors.imageUrl">
          <Input v-model="form.imageUrl" type="url" placeholder="https://…" v-bind="fieldAttrs('imageUrl', 'giveaway-imageUrl-error')" />
        </Field>
        <Field id="giveaway-termsUrl" label="Terms URL" optional :error="errors.termsUrl">
          <Input v-model="form.termsUrl" type="url" placeholder="https://…" v-bind="fieldAttrs('termsUrl', 'giveaway-termsUrl-error')" />
        </Field>
        <Field id="giveaway-status" label="Status">
          <Select v-model="form.status" :options="statusOptions" />
        </Field>
        <Field id="giveaway-startsAt" label="Starts" :error="errors.startsAt">
          <Input v-model="form.startsAt" type="date" v-bind="fieldAttrs('startsAt', 'giveaway-startsAt-error')" />
        </Field>
        <Field id="giveaway-endsAt" label="Ends" :error="errors.endsAt">
          <Input v-model="form.endsAt" type="date" v-bind="fieldAttrs('endsAt', 'giveaway-endsAt-error')" />
        </Field>
      </div>
      <div class="mt-4 flex gap-2">
        <Button type="submit" variant="pill" :loading="saving">Create</Button>
        <Button type="button" variant="outline-pill" @click="showForm = false">Cancel</Button>
      </div>
    </form>

    <AdminState v-if="loading" kind="loading" />
    <AdminState v-else-if="!items.length" kind="empty" message="No giveaways yet." hint="Create one with “New”." />

    <div v-else class="mt-6 grid gap-3">
      <div v-for="g in items" :key="g.id" class="rounded-2xl border bg-card p-4">
        <div class="flex flex-wrap items-center gap-2">
          <AdminStatus tone="accent">{{ g.citySlug }}</AdminStatus>
          <AdminStatus :tone="statusTone[g.status] || 'warning'">{{ g.status }}</AdminStatus>
          <span class="text-meta text-secondary">{{ fmt(g.startsAt) }} → {{ fmt(g.endsAt) }}</span>
        </div>
        <h3 class="mt-1.5 font-display text-base font-bold leading-tight text-foreground">{{ g.title }}</h3>
        <p class="text-xs text-muted-foreground">{{ g.sponsorName }} · {{ g.prizeDescription }}</p>
        <a :href="g.ctaUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 mt-1 text-xs font-bold text-wd-cyan-700 hover:underline">CTA <ExternalLink class="size-3" aria-hidden="true" /></a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * /admin/festivals — pick a festival to manage its dinner groups.
 * `admin` layout provides the sidebar + is_admin gate; list via
 * admin.listFestivals (adminProcedure).
 */
import { ArrowRight, RotateCcw } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Admin: Festivals | WeDance' })

const { $trpc } = useNuxtApp()

type Festival = { slug: string; name: string; startDate: string | null; endDate: string | null }
const items = ref<Festival[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = (await $trpc.admin.listFestivals.query()) as Festival[]
  } catch (e: any) {
    error.value = e?.message || 'Failed to load festivals.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
</script>

<template>
  <div>
    <AdminPageHeader title="Festival dinners" description="Pick a festival to assign dinner groups and reveal restaurants.">
      <Button variant="ghost" size="sm" class="text-secondary" :disabled="loading" @click="load">
        <RotateCcw /> Refresh
      </Button>
    </AdminPageHeader>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="loading" kind="loading" />
    <AdminState v-else-if="!items.length" kind="empty" message="No festivals." />

    <div v-else class="mt-6 grid gap-3">
      <NuxtLink
        v-for="f in items"
        :key="f.slug"
        :to="`/admin/festivals/${f.slug}`"
        class="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all duration-wd-standard hover:-translate-y-0.5 hover:border-input"
      >
        <div class="flex-1 min-w-0">
          <h3 class="font-display text-base font-bold leading-tight text-foreground">{{ f.name }}</h3>
          <p class="text-xs text-secondary">{{ fmt(f.startDate) }} → {{ fmt(f.endDate) }} · {{ f.slug }}</p>
        </div>
        <ArrowRight class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>

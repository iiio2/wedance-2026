<script setup lang="ts">
/**
 * /admin/users — every user, newest first. Search by name or email; filter to
 * people who manage or claim a business profile. Click a name to see their
 * Business and act as them ("view as", see useViewAs).
 */
import { Search, Eye, ExternalLink, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Users | Admin | WeDance' })

const { $trpc } = useNuxtApp()
type Data = Awaited<ReturnType<typeof $trpc.admin.users.query>>
const data = ref<Data | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const q = ref('')
const business = ref(false)
const offset = ref(0)
const PAGE = 50

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await $trpc.admin.users.query({ q: q.value.trim(), business: business.value, offset: offset.value })
  } catch (e: any) {
    error.value = e?.message || 'Could not load users.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
let timer: ReturnType<typeof setTimeout> | undefined
watch([q, business], () => { clearTimeout(timer); offset.value = 0; timer = setTimeout(load, 250) })
watch(offset, load)

const viewAs = useViewAs()
function openBusiness(u: { id: string; name: string }) {
  viewAs.value = { id: u.id, name: u.name }
  navigateTo('/business')
}

const fmt = (d: string | Date | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer' }
</script>

<template>
  <div>
    <AdminPageHeader title="Users" :description="data ? `${data.total.toLocaleString('en-GB')} ${business ? 'with a business' : 'in total'}. Click a name to open their Business and act as them.` : 'Everyone on WeDance.'" />

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <Field label="Search users" hide-label class="min-w-[16rem] flex-1">
        <div class="relative">
          <Search class="size-4 absolute left-3.5 top-3.5 text-muted-foreground" aria-hidden="true" />
          <Input v-model="q" type="search" placeholder="Name or email" class="pl-10" />
        </div>
      </Field>
      <label class="inline-flex items-center gap-2 text-sm"><Checkbox v-model="business" /> Only with a business</label>
    </div>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="loading && !data" kind="loading" />
    <AdminState v-else-if="data && !data.rows.length" kind="empty" message="No users match." />

    <div v-else-if="data" class="mt-4 overflow-hidden rounded-2xl border bg-card" :class="loading ? 'opacity-60' : ''">
      <ul class="divide-y">
        <li v-for="u in data.rows" :key="u.id" class="flex flex-wrap items-center gap-3 px-4 py-3">
          <img v-if="u.photo" :src="u.photo" alt="" class="size-9 shrink-0 rounded-full object-cover">
          <span v-else class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{{ u.name.slice(0, 1).toUpperCase() }}</span>
          <div class="min-w-[12rem] flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="text-left text-sm font-bold hover:underline focus-visible:shadow-wd-focus" :title="`See ${u.name}’s Business`" @click="openBusiness(u)">{{ u.name }}</button>
              <AdminStatus v-if="u.isAdmin" tone="info"><ShieldCheck class="size-3" aria-hidden="true" /> Admin</AdminStatus>
              <AdminStatus v-if="u.pendingClaims" tone="warning">{{ u.pendingClaims }} claim{{ u.pendingClaims > 1 ? 's' : '' }} pending</AdminStatus>
            </div>
            <p class="truncate text-xs text-muted-foreground">{{ u.email }}<template v-if="u.city"> · {{ u.city }}</template> · joined {{ fmt(u.createdAt) }}</p>
            <div v-if="u.profiles.length" class="mt-1.5 flex flex-wrap gap-1.5">
              <NuxtLink
                v-for="p in u.profiles"
                :key="p.username"
                :to="`/@${p.username}`"
                target="_blank"
                class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-accent"
              >
                {{ p.name }} <span class="text-muted-foreground">· {{ typeLabel[p.type] || p.type }} · {{ p.role }}</span> <ExternalLink class="size-3 text-muted-foreground" aria-hidden="true" />
              </NuxtLink>
            </div>
          </div>
          <div class="flex shrink-0 gap-2">
            <Button v-if="u.username" variant="ghost" size="sm" as-child><NuxtLink :to="`/u/${u.username}`" target="_blank">Dancer page</NuxtLink></Button>
            <Button variant="outline-pill" size="pill-sm" @click="openBusiness(u)"><Eye /> Business</Button>
          </div>
        </li>
      </ul>
      <div v-if="data.total > PAGE" class="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <span>{{ offset + 1 }}–{{ Math.min(offset + PAGE, data.total) }} of {{ data.total.toLocaleString('en-GB') }}</span>
        <div class="flex gap-1">
          <Button variant="ghost" size="sm" :disabled="offset === 0" @click="offset = Math.max(0, offset - PAGE)"><ChevronLeft /> Newer</Button>
          <Button variant="ghost" size="sm" :disabled="offset + PAGE >= data.total" @click="offset += PAGE">Older <ChevronRight /></Button>
        </div>
      </div>
    </div>
  </div>
</template>

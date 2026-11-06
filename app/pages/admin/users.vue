<script setup lang="ts">
import { sizedImage, IMG } from '#shared/utils/image'
/**
 * /admin/users — every user with when they joined, last logged in, were last
 * active and how many days they've used WeDance. Sort by any of those, either
 * way. Search by name, email, @handle or a business page they run or claim;
 * filter to people who manage or claim a business profile. Click a name to see their Business and act as them ("view as", see useViewAs).
 */
import { Search, Eye, ExternalLink, ShieldCheck, ChevronLeft, ChevronRight, ArrowDownWideNarrow, ArrowUpNarrowWide, ShieldPlus, ShieldMinus, Ellipsis, UserPlus } from 'lucide-vue-next'
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem } from 'reka-ui'
import { initialOf } from '#shared/utils/initials'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Users | Admin | WeDance' })

const { $trpc } = useNuxtApp()
type Data = Awaited<ReturnType<typeof $trpc.admin.users.query>>
const data = ref<Data | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const q = ref('')
const business = ref(false)
type Sort = 'registered' | 'lastLogin' | 'lastActive' | 'daysUsed'
const sort = ref<Sort>('registered')
const dir = ref<'asc' | 'desc'>('desc')
const sortOptions = [
  { label: 'Registered', value: 'registered' },
  { label: 'Last logged in', value: 'lastLogin' },
  { label: 'Last active', value: 'lastActive' },
  { label: 'Days used', value: 'daysUsed' },
]
const offset = ref(0)
const PAGE = 50

// Only the latest request may land: a slow earlier search mustn't overwrite a newer one.
let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  error.value = null
  try {
    const res = await $trpc.admin.users.query({ q: q.value.trim(), business: business.value, sort: sort.value, dir: dir.value, offset: offset.value })
    if (mine === seq) data.value = res
  } catch (e: any) {
    if (mine === seq) error.value = e?.message || 'Could not load users.'
  } finally {
    if (mine === seq) loading.value = false
  }
}
onMounted(load)
let timer: ReturnType<typeof setTimeout> | undefined
watch([q, business, sort, dir], () => { clearTimeout(timer); offset.value = 0; timer = setTimeout(load, 250) })
watch(offset, load)

const { dancerId: myId } = useAuth()
const savingAdmin = ref<string | null>(null)
async function toggleAdmin(u: { id: string; name: string; isAdmin: boolean | null }) {
  const make = !u.isAdmin
  if (!confirm(make ? `Make ${u.name} an admin? They'll be able to see every user and act as them.` : `Remove ${u.name}'s admin rights?`)) return
  savingAdmin.value = u.id
  try {
    const row = await $trpc.admin.setAdmin.mutate({ dancerId: u.id, isAdmin: make })
    u.isAdmin = row.isAdmin
  } catch (e: any) {
    error.value = e?.message || 'Could not change admin rights.'
  } finally {
    savingAdmin.value = null
  }
}

const viewAs = useViewAs()
function openBusiness(u: { id: string; name: string }) {
  viewAs.value = { id: u.id, name: u.name }
  navigateTo('/business')
}

const fmt = (d: string | Date | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
// "today" / "3d ago" / "5 Mar 2026" — recent activity reads faster as a distance.
function ago(d: string | Date | null) {
  if (!d) return 'never'
  // Whole UTC calendar days, so a day ("2026-10-25") and a time that day agree.
  const day = (t: string | number | Date) => Math.floor(new Date(t).getTime() / 86_400_000)
  const days = day(Date.now()) - day(d)
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return fmt(d)
}
// Sessions store UTC without a zone; read them as UTC.
const utc = (d: string | null) => d && !/[zZ+]/.test(d.slice(10)) ? `${d.replace(' ', 'T')}Z` : d
const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer', promoter: 'Promoter' }
const sourceLabel: Record<string, string> = { 'v3-own': 'their own page on wedance.vip', 'v3-team': 'team on wedance.vip', 'v3-creator': 'created it on wedance.vip' }

// Owners for pages nobody runs: a suggested owner, or anyone by email / @handle.
const notice = ref<string | null>(null)
const busyPage = ref<string | null>(null)
const assignTo = reactive<Record<string, string>>({})
const assigning = ref<string | null>(null)
async function makeOwner(page: { username: string; name: string }, person: { dancerId?: string; name?: string; who?: string }) {
  if (!confirm(`Make ${person.name || person.who} an owner of ${page.name}? They'll get an email.`)) return
  busyPage.value = page.username
  error.value = null
  try {
    const r = await $trpc.admin.addPageOwner.mutate({ username: page.username, dancerId: person.dancerId, who: person.who })
    notice.value = `${r.owner.name} now owns ${page.name}. We emailed them.`
    assigning.value = null
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Could not add the owner.'
  } finally {
    busyPage.value = null
  }
}
async function dismiss(page: { username: string }, dancerId: string) {
  busyPage.value = page.username
  try {
    await $trpc.admin.dismissSuggestion.mutate({ username: page.username, dancerId })
    await load()
  } finally {
    busyPage.value = null
  }
}
</script>

<template>
  <div>
    <AdminPageHeader title="Users" :description="data ? `${data.total.toLocaleString('en-GB')} ${business ? 'with a business' : 'in total'}. Click a name to open their Business and act as them.` : 'Everyone on WeDance.'" />

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <Field label="Search users" hide-label class="min-w-[16rem] flex-1">
        <div class="relative">
          <Search class="size-4 absolute left-3.5 top-3.5 text-muted-foreground" aria-hidden="true" />
          <Input v-model="q" type="search" placeholder="Name, email, @handle or business page" class="pl-10" />
        </div>
      </Field>
      <label class="inline-flex items-center gap-2 text-sm"><Checkbox v-model="business" /> Only with a business</label>
      <div class="flex items-center gap-1">
        <Field label="Sort by" hide-label class="w-44">
          <Select v-model="sort" :options="sortOptions" />
        </Field>
        <Button variant="ghost" size="icon" :title="dir === 'desc' ? 'Newest / most first' : 'Oldest / least first'" :aria-label="dir === 'desc' ? 'Sorted descending, switch to ascending' : 'Sorted ascending, switch to descending'" @click="dir = dir === 'desc' ? 'asc' : 'desc'">
          <ArrowDownWideNarrow v-if="dir === 'desc'" /><ArrowUpNarrowWide v-else />
        </Button>
      </div>
    </div>

    <div v-if="data?.orphanPages.length" class="mt-4 rounded-2xl border border-dashed bg-card px-4 py-3">
      <p class="text-xs font-bold text-muted-foreground">Business pages nobody runs</p>
      <ul class="mt-1.5 flex flex-col divide-y" :class="busyPage ? 'opacity-60' : ''">
        <li v-for="p in data.orphanPages" :key="p.username" class="py-2">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <NuxtLink :to="`/@${p.username}`" target="_blank" class="inline-flex items-center gap-1 font-bold hover:underline">
              {{ p.name }} <ExternalLink class="size-3 text-muted-foreground" aria-hidden="true" />
            </NuxtLink>
            <span class="text-xs text-muted-foreground">@{{ p.username }} · {{ typeLabel[p.type] || p.type }}<template v-if="p.city"> · {{ p.city }}</template></span>
            <NuxtLink v-if="p.pendingClaims" to="/admin/claims"><AdminStatus tone="warning">{{ p.pendingClaims }} claim{{ p.pendingClaims > 1 ? 's' : '' }} pending</AdminStatus></NuxtLink>
            <Button v-if="assigning !== p.username" variant="ghost" size="sm" class="ml-auto" @click="assigning = p.username"><UserPlus /> Add owner</Button>
          </div>
          <div v-for="s in p.suggestions" :key="s.dancerId" class="mt-1 flex flex-wrap items-center gap-2 pl-3 text-xs">
            <span><span class="font-semibold">{{ s.name }}</span> <span class="text-muted-foreground">· {{ s.email }} · {{ sourceLabel[s.source] || s.source }}</span></span>
            <Button variant="outline-pill" size="pill-sm" :disabled="busyPage === p.username" @click="makeOwner(p, { dancerId: s.dancerId, name: s.name })">Make owner</Button>
            <Button variant="ghost" size="sm" :disabled="busyPage === p.username" @click="dismiss(p, s.dancerId)">Not them</Button>
          </div>
          <form v-if="assigning === p.username" novalidate class="mt-2 flex flex-wrap items-center gap-2 pl-3" @submit.prevent="assignTo[p.username] && makeOwner(p, { who: assignTo[p.username] })">
            <Field :label="`Owner for ${p.name}`" hide-label class="min-w-[14rem] flex-1">
              <Input v-model="assignTo[p.username]" placeholder="Their email or @handle" autofocus />
            </Field>
            <Button type="submit" variant="outline-pill" size="pill-sm" :disabled="!assignTo[p.username] || busyPage === p.username">Make owner</Button>
            <Button type="button" variant="ghost" size="sm" @click="assigning = null">Cancel</Button>
          </form>
        </li>
      </ul>
    </div>

    <p v-if="notice" class="mt-3 text-sm font-semibold text-success" role="status">{{ notice }}</p>
    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="loading && !data" kind="loading" />
    <AdminState v-else-if="data && !data.rows.length" kind="empty" :message="data.orphanPages.length ? 'No users match. The pages above have nobody running them yet.' : 'No users match.'" />

    <div v-else-if="data" class="mt-4 overflow-hidden rounded-2xl border bg-card" :class="loading ? 'opacity-60' : ''">
      <ul class="divide-y">
        <li v-for="u in data.rows" :key="u.id" class="flex flex-wrap items-center gap-3 px-4 py-3">
          <img v-if="u.photo" :src="sizedImage(u.photo, IMG.avatar)" alt="" class="size-9 shrink-0 rounded-full object-cover">
          <span v-else class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{{ initialOf(u.name) }}</span>
          <div class="min-w-[12rem] flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="text-left text-sm font-bold hover:underline focus-visible:shadow-wd-focus" :title="`See ${u.name}’s Business`" @click="openBusiness(u)">{{ u.name }}</button>
              <AdminStatus v-if="u.isAdmin" tone="info"><ShieldCheck class="size-3" aria-hidden="true" /> Admin</AdminStatus>
              <AdminStatus v-if="u.pendingClaims" tone="warning">{{ u.pendingClaims }} claim{{ u.pendingClaims > 1 ? 's' : '' }} pending</AdminStatus>
            </div>
            <p class="truncate text-xs text-muted-foreground">{{ u.email }}<template v-if="u.city"> · {{ u.city }}</template></p>
            <p class="text-xs text-muted-foreground">
              <span :class="sort === 'registered' && 'font-semibold text-foreground'">joined {{ fmt(u.createdAt) }}</span>
              · <span :class="sort === 'lastLogin' && 'font-semibold text-foreground'" :title="u.lastLoginAt ? new Date(utc(u.lastLoginAt)!).toLocaleString('en-GB') : undefined">last login {{ ago(utc(u.lastLoginAt)) }}</span>
              · <span :class="sort === 'lastActive' && 'font-semibold text-foreground'">active {{ ago(u.lastActiveDay) }}</span>
              · <span :class="sort === 'daysUsed' && 'font-semibold text-foreground'">{{ u.daysUsed }} day{{ u.daysUsed === 1 ? '' : 's' }} used</span>
            </p>
            <div v-if="u.suggestedPages.length" class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span class="text-muted-foreground">Probably runs:</span>
              <span v-for="p in u.suggestedPages" :key="p.username" class="inline-flex items-center gap-1 rounded-full border border-dashed py-0.5 pl-2 pr-0.5">
                <NuxtLink :to="`/@${p.username}`" target="_blank" class="hover:underline">{{ p.name }}</NuxtLink>
                <span class="text-muted-foreground">· {{ sourceLabel[p.source] || p.source }}</span>
                <button type="button" class="rounded-full bg-accent px-2 py-0.5 font-semibold hover:bg-muted focus-visible:shadow-wd-focus" @click="makeOwner(p, { dancerId: u.id, name: u.name })">Make owner</button>
              </span>
            </div>
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
            <DropdownMenuRoot v-if="!u.isAdmin || u.id !== myId">
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" :aria-label="`More for ${u.name}`" :disabled="savingAdmin === u.id"><Ellipsis /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent align="end" :side-offset="4" class="z-50 min-w-[10rem] rounded-xl border bg-popover p-1 text-popover-foreground shadow-md">
                  <DropdownMenuItem class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent [&_svg]:size-4" @select="toggleAdmin(u)">
                    <ShieldMinus v-if="u.isAdmin" /><ShieldPlus v-else /> {{ u.isAdmin ? 'Remove admin' : 'Make admin' }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>
        </li>
      </ul>
      <div v-if="data.total > PAGE" class="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <span>{{ offset + 1 }}–{{ Math.min(offset + PAGE, data.total) }} of {{ data.total.toLocaleString('en-GB') }}</span>
        <div class="flex gap-1">
          <Button variant="ghost" size="sm" :disabled="offset === 0" @click="offset = Math.max(0, offset - PAGE)"><ChevronLeft /> Previous</Button>
          <Button variant="ghost" size="sm" :disabled="offset + PAGE >= data.total" @click="offset += PAGE">Next <ChevronRight /></Button>
        </div>
      </div>
    </div>
  </div>
</template>

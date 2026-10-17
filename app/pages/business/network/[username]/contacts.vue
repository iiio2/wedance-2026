<script setup lang="ts">
/**
 * /business/network/<handle>/contacts — people who signed up on the profile's
 * own website (RAZ-412): WeDance is its CRM. Search, note, mark unsubscribed,
 * download as CSV.
 */
import { Download, Search, Trash2, Globe, Mail, Phone, StickyNote, Check } from 'lucide-vue-next'

definePageMeta({ layout: 'business' })
const route = useRoute()
const { $trpc } = useNuxtApp()
const username = computed(() => String(route.params.username))

type Row = Awaited<ReturnType<typeof $trpc.businessSite.contacts.query>>[number]
const rows = ref<Row[] | null>(null)
const name = ref('')
const error = ref<string | null>(null)
async function load() {
  try {
    const [list, site] = await Promise.all([
      $trpc.businessSite.contacts.query({ username: username.value }),
      $trpc.businessSite.get.query({ username: username.value }),
    ])
    rows.value = list
    name.value = site.profile.name
    error.value = null
  } catch (e: any) { error.value = e?.message || 'Couldn’t load the contacts.' }
}
onMounted(load)
useHead(() => ({ title: `Contacts · ${name.value} | Business | WeDance` }))

const q = ref('')
const show = ref<'subscribed' | 'all'>('subscribed')
const list = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return (rows.value ?? []).filter(r => (show.value === 'all' || r.status === 'subscribed')
    && (!needle || [r.name, r.email, r.phone, r.note, ...Object.values(r.source ?? {})].some(v => v?.toLowerCase().includes(needle))))
})
const when = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const from = (r: Row) => [r.source?.utm_source, r.source?.utm_medium, r.source?.utm_campaign].filter(Boolean).join(' / ') || r.source?.form || r.source?.referrer || ''

const editing = ref<string | null>(null)
const note = ref('')
async function saveNote(r: Row) {
  try { await $trpc.businessSite.updateContact.mutate({ username: username.value, id: r.id, note: note.value }); r.note = note.value; editing.value = null } catch (e: any) { error.value = e?.message || 'Couldn’t save the note.' }
}
async function setStatus(r: Row, status: 'subscribed' | 'unsubscribed') {
  try { await $trpc.businessSite.updateContact.mutate({ username: username.value, id: r.id, status }); r.status = status } catch (e: any) { error.value = e?.message || 'Couldn’t change it.' }
}
const confirmRemove = ref<string | null>(null)
async function remove(r: Row) {
  try { await $trpc.businessSite.removeContact.mutate({ username: username.value, id: r.id }); rows.value = rows.value!.filter(x => x.id !== r.id); confirmRemove.value = null } catch (e: any) { error.value = e?.message || 'Couldn’t delete it.' }
}

function csv() {
  const cols = ['name', 'email', 'phone', 'locale', 'status', 'created', 'source', 'note']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [cols.join(','), ...list.value.map(r => [r.name, r.email, r.phone, r.locale, r.status, new Date(r.createdAt).toISOString(), from(r), r.note].map(esc).join(','))]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = `${username.value}-contacts.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div>
    <AdminState v-if="!rows && !error" kind="loading" />
    <AdminState v-else-if="!rows" kind="error" :message="error!" />
    <template v-else>
      <AdminPageHeader
        eyebrow="Contacts"
        :title="name"
        description="People who signed up on your website. They also get your welcome email; you get an email for each one."
        :back="{ to: `/business/network/${username}`, label: 'The profile' }"
      >
        <Button variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="`/business/network/${username}/website`"><Globe /> Website</NuxtLink>
        </Button>
        <Button variant="outline-pill" size="pill-sm" :disabled="!list.length" @click="csv"><Download /> CSV</Button>
      </AdminPageHeader>
      <AdminState v-if="error" kind="error" :message="error" />

      <div class="mt-6 flex flex-wrap items-center gap-2">
        <div class="relative w-full max-w-xs">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input v-model="q" placeholder="Search name, email, source…" class="pl-9" aria-label="Search contacts" />
        </div>
        <Button type="button" size="sm" :variant="show === 'subscribed' ? 'soft' : 'outline'" :aria-pressed="show === 'subscribed'" @click="show = 'subscribed'">Subscribed · {{ rows.filter(r => r.status === 'subscribed').length }}</Button>
        <Button type="button" size="sm" :variant="show === 'all' ? 'soft' : 'outline'" :aria-pressed="show === 'all'" @click="show = 'all'">All · {{ rows.length }}</Button>
      </div>

      <AdminState v-if="!rows.length" kind="empty" message="Nobody has signed up on your website yet. When someone does, they show up here." class="mt-6" />
      <p v-else-if="!list.length" class="mt-6 text-sm text-muted-foreground">No contact matches.</p>

      <ul v-else class="mt-4 divide-y rounded-2xl border bg-card shadow-wd-card">
        <li v-for="r in list" :key="r.id" class="grid gap-2 p-4 sm:grid-cols-[1fr_auto]" :class="r.status === 'unsubscribed' ? 'opacity-60' : ''">
          <div class="min-w-0">
            <p class="font-bold">{{ r.name || r.email }} <span v-if="r.status === 'unsubscribed'" class="ml-1 text-xs font-normal text-muted-foreground">unsubscribed</span></p>
            <p class="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a :href="`mailto:${r.email}`" class="inline-flex items-center gap-1 underline-offset-2 hover:underline"><Mail class="size-3.5" aria-hidden="true" /> {{ r.email }}</a>
              <a v-if="r.phone" :href="`https://wa.me/${r.phone.replace(/[^\d+]/g, '').replace(/^00/, '+').replace(/^\+/, '')}`" target="_blank" rel="noopener" class="inline-flex items-center gap-1 underline-offset-2 hover:underline"><Phone class="size-3.5" aria-hidden="true" /> {{ r.phone }}</a>
            </p>
            <p class="mt-1 text-xs text-muted-foreground">{{ when(r.createdAt) }}<template v-if="r.locale"> · {{ r.locale.toUpperCase() }}</template><template v-if="from(r)"> · {{ from(r) }}</template><template v-if="r.source?.promo_code"> · code {{ r.source.promo_code }}</template></p>
            <p v-if="r.note && editing !== r.id" class="mt-1 whitespace-pre-line text-sm"><StickyNote class="mr-1 inline size-3.5 text-muted-foreground" aria-hidden="true" />{{ r.note }}</p>
            <div v-if="editing === r.id" class="mt-2 grid gap-2">
              <Textarea v-model="note" :rows="2" aria-label="Note" />
              <div class="flex gap-2"><Button type="button" size="sm" variant="cta" @click="saveNote(r)"><Check /> Save note</Button><Button type="button" size="sm" variant="ghost" @click="editing = null">Cancel</Button></div>
            </div>
          </div>
          <div class="flex flex-wrap items-start gap-1">
            <Button type="button" size="sm" variant="ghost" @click="editing = r.id; note = r.note ?? ''"><StickyNote /> Note</Button>
            <Button v-if="r.status === 'subscribed'" type="button" size="sm" variant="ghost" @click="setStatus(r, 'unsubscribed')">Unsubscribe</Button>
            <Button v-else type="button" size="sm" variant="ghost" @click="setStatus(r, 'subscribed')">Resubscribe</Button>
            <Button v-if="confirmRemove !== r.id" type="button" size="icon" variant="ghost" aria-label="Delete contact" @click="confirmRemove = r.id"><Trash2 /></Button>
            <template v-else>
              <Button type="button" size="sm" variant="destructive" @click="remove(r)">Delete</Button>
              <Button type="button" size="sm" variant="ghost" @click="confirmRemove = null">Keep</Button>
            </template>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

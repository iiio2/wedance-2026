<script setup lang="ts">
/**
 * /business/network/<handle>/website — the profile's own website, edited here
 * (RAZ-412). WeDance is its CMS: the site renders exactly these sections from
 * /api/profiles/<handle>/site. Events aren't typed in: an "Events" section
 * lists the profile's events on WeDance. Sign-ups from the site land in Contacts.
 *
 * Three tabs: the page (an outline of sections + the one being edited),
 * settings (address, languages, search & sharing) and the welcome email. The
 * language being edited applies everywhere; every save is a version (History).
 */
import { Check, ExternalLink, Contact, History, ArrowLeft, Plus, LayoutList, Settings2, Mail, Languages, CircleAlert } from 'lucide-vue-next'
import { SECTION_INFO, SITE_LOCALES, missingTexts, newId, type ProfileSite, type SectionKind, type SiteSection } from '#shared/types/profileSite'

definePageMeta({ layout: 'business', wide: true })
const route = useRoute()
const router = useRouter()
const { $trpc } = useNuxtApp()
const username = computed(() => String(route.params.username))

const profile = ref<{ username: string; name: string } | null>(null)
const site = ref<ProfileSite | null>(null)
const saved = ref('')
const error = ref<string | null>(null)
const savedAt = ref<Date | null>(null)
async function load() {
  try {
    const r = await $trpc.businessSite.get.query({ username: username.value })
    profile.value = r.profile
    site.value = structuredClone(r.site) as ProfileSite
    saved.value = JSON.stringify(site.value)
    savedAt.value = r.updatedAt ? new Date(r.updatedAt) : null
    if (!site.value.locales.includes(lang.value)) lang.value = site.value.locales[0] ?? 'en'
    if (selected.value && !site.value.sections.some(s => s.id === selected.value)) selected.value = null
    error.value = null
  } catch (e: any) { error.value = e?.message || 'Couldn’t load the website.' }
}
onMounted(load)
useHead(() => ({ title: `Website · ${profile.value?.name ?? ''} | Business | WeDance` }))

// --- where you are: tab, section and language live in the URL, so a reload keeps your place
type Tab = 'page' | 'settings' | 'email'
const tab = ref<Tab>((['page', 'settings', 'email'] as const).find(t => t === route.query.tab) ?? 'page')
const selected = ref<string | null>(typeof route.query.section === 'string' ? route.query.section : null)
const lang = ref(typeof route.query.lang === 'string' ? route.query.lang : 'en')
watch([tab, selected, lang], () => {
  router.replace({ query: { ...route.query, tab: tab.value === 'page' ? undefined : tab.value, section: selected.value ?? undefined, lang: lang.value === main.value ? undefined : lang.value } })
})

// --- saving
const dirty = computed(() => !!site.value && JSON.stringify(site.value) !== saved.value)
const saving = ref(false)
const justSaved = ref(false)
async function save() {
  if (!site.value || !dirty.value || saving.value) return
  saving.value = true
  error.value = null
  try {
    const r = await $trpc.businessSite.save.mutate({ username: username.value, site: site.value as any })
    saved.value = JSON.stringify(site.value)
    savedAt.value = new Date(r.updatedAt)
    justSaved.value = true
    setTimeout(() => { justSaved.value = false }, 4000)
  } catch (e: any) { error.value = e?.message || 'Couldn’t save.' } finally { saving.value = false }
}
const confirmUndo = ref(false)
async function undoAll() { confirmUndo.value = false; await load() }
function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty.value) { e.preventDefault(); e.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave(() => !dirty.value || window.confirm('You have changes that aren’t saved. Leave anyway?'))
const savedLabel = computed(() => savedAt.value ? savedAt.value.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null)

// --- languages
const main = computed(() => site.value?.locales[0] ?? 'en')
/** Texts not yet in language l: sections, search & sharing and the welcome email. */
const welcomeMissing = (l: string) => {
  const w = site.value?.welcome
  if (!w || l === main.value) return 0
  return (['subject', 'body'] as const).filter(k => w[k]?.[main.value] && !w[k]?.[l]).length
}
const missing = (l: string) => site.value && l !== main.value ? missingTexts(site.value, l) + welcomeMissing(l) : 0
const LANG_NAMES: Record<string, string> = { en: 'English', de: 'Deutsch', es: 'Español', ru: 'Русский', uk: 'Українська', fr: 'Français', it: 'Italiano', pt: 'Português', pl: 'Polski' }
function toggleLocale(l: string) {
  const s = site.value!
  if (s.locales.includes(l)) {
    if (s.locales.length === 1) return
    s.locales = s.locales.filter(x => x !== l)
    if (lang.value === l) lang.value = s.locales[0]!
  } else s.locales = [...s.locales, l]
}
const makeMain = (l: string) => { site.value!.locales = [l, ...site.value!.locales.filter(x => x !== l)] }

// --- sections
const index = computed(() => site.value?.sections.findIndex(s => s.id === selected.value) ?? -1)
const current = computed({
  get: () => (index.value >= 0 ? site.value!.sections[index.value] : null) as SiteSection | null,
  set: (v) => { if (v && index.value >= 0) site.value!.sections[index.value] = v },
})
function select(id: string) {
  selected.value = id
  // On a phone the editor replaces the outline; start at its top.
  nextTick(() => document.getElementById('section-editor')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
}
function move(from: number, to: number) {
  const list = site.value!.sections
  if (to < 0 || to >= list.length) return
  const [s] = list.splice(from, 1)
  list.splice(to, 0, s!)
}
const adding = ref(false)
const addAt = ref(0)
function startAdd(at: number) { addAt.value = at; adding.value = true }
function add(kind: SectionKind) {
  const s: SiteSection = { id: newId(), kind }
  if (SECTION_INFO[kind].items) s.items = []
  site.value!.sections.splice(addAt.value, 0, s)
  select(s.id)
}
function duplicate() {
  const i = index.value
  const copy = { ...structuredClone(toRaw(site.value!.sections[i]!)), id: newId(), anchor: undefined, navLabel: undefined }
  copy.items = copy.items?.map(it => ({ ...it, id: newId() }))
  site.value!.sections.splice(i + 1, 0, copy)
  select(copy.id)
}
function remove() {
  const i = index.value
  site.value!.sections.splice(i, 1)
  selected.value = site.value!.sections[Math.min(i, site.value!.sections.length - 1)]?.id ?? null
}

// --- settings / email
function setSeo(key: 'title' | 'description', v: any) { site.value!.seo = { ...site.value!.seo, [key]: v } }
function setSeoImage(v: string | undefined) { site.value!.seo = { ...site.value!.seo, image: v } }
function setWelcome(key: 'subject' | 'body', v: any) { site.value!.welcome = { ...site.value!.welcome, [key]: v } }
const seoMissing = computed(() => site.value && lang.value !== main.value ? missingTexts({ locales: site.value.locales, sections: [], seo: site.value.seo }, lang.value) : 0)
const emailMissing = computed(() => welcomeMissing(lang.value))
const sectionsMissing = computed(() => site.value && lang.value !== main.value ? missingTexts({ locales: site.value.locales, sections: site.value.sections }, lang.value) : 0)
</script>

<template>
  <div class="pb-24">
    <AdminState v-if="!site && !error" kind="loading" />
    <AdminState v-else-if="!site" kind="error" :message="error!" />
    <template v-else-if="profile && site">
      <AdminPageHeader
        eyebrow="Website"
        :title="profile.name"
        description="Your own website, run from WeDance: change the words and sections here and the site follows. Events come from your events on WeDance; people who sign up land in Contacts."
        :back="{ to: `/business/network/${profile.username}`, label: 'The profile' }"
      >
        <Button v-if="site.domain" variant="outline-pill" size="pill-sm" as-child>
          <a :href="site.domain" target="_blank" rel="noopener"><ExternalLink /> View site</a>
        </Button>
        <Button variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="`/business/network/${profile.username}/website-history`"><History /> History</NuxtLink>
        </Button>
        <Button variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="`/business/network/${profile.username}/contacts`"><Contact /> Contacts</NuxtLink>
        </Button>
      </AdminPageHeader>

      <!-- Toolbar: what you edit, and in which language -->
      <div class="sticky top-0 z-20 -mx-4 mt-6 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex gap-1 rounded-full border bg-card p-1" role="tablist" aria-label="What to edit">
            <button
              v-for="t in ([['page', 'Page', LayoutList, sectionsMissing], ['settings', 'Settings', Settings2, seoMissing], ['email', 'Welcome email', Mail, emailMissing]] as const)"
              :key="t[0]"
              type="button"
              role="tab"
              :aria-selected="tab === t[0]"
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-visible:shadow-wd-focus focus-visible:outline-none"
              :class="tab === t[0] ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="tab = t[0]"
            >
              <component :is="t[2]" class="size-3.5" aria-hidden="true" /> {{ t[1] }}
              <span v-if="t[3]" class="rounded-full bg-wd-amber-500/25 px-1.5 text-[10px] text-wd-amber-800">{{ t[3] }}</span>
            </button>
          </div>
          <div v-if="site.locales.length > 1" class="flex flex-wrap items-center gap-1" role="group" aria-label="Language you edit">
            <Languages class="size-4 text-muted-foreground" aria-hidden="true" />
            <button
              v-for="l in site.locales"
              :key="l"
              type="button"
              class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors focus-visible:shadow-wd-focus focus-visible:outline-none"
              :class="lang === l ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50'"
              :aria-pressed="lang === l"
              :title="`${LANG_NAMES[l] ?? l}${l === main ? ' (main language)' : missing(l) ? ` — ${missing(l)} texts not translated` : ''}`"
              @click="lang = l"
            >
              {{ l.toUpperCase() }}
              <span v-if="missing(l)" class="rounded-full px-1 text-[10px]" :class="lang === l ? 'bg-white/25' : 'bg-wd-amber-500/25 text-wd-amber-800'">{{ missing(l) }}</span>
            </button>
          </div>
        </div>
        <p v-if="lang !== main" class="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleAlert class="size-3.5 text-wd-amber-800" aria-hidden="true" />
          Editing the {{ LANG_NAMES[lang] ?? lang }} texts. Empty fields show the {{ LANG_NAMES[main] ?? main }} text to visitors, and here as a grey hint.
        </p>
      </div>

      <AdminState v-if="error" kind="error" :message="error" class="mt-4" />

      <!-- PAGE: outline + the section being edited -->
      <div v-if="tab === 'page'" class="mt-4">
        <div v-if="!site.sections.length" class="rounded-2xl border border-dashed p-8 text-center">
          <p class="font-bold">Your page has no sections yet.</p>
          <p class="mt-1 text-sm text-muted-foreground">Start with a hero: the big title at the top. Then add what you offer, your events and how to sign up.</p>
          <Button type="button" variant="cta" class="mt-4" @click="startAdd(0)"><Plus /> Add the first section</Button>
        </div>
        <div v-else class="grid gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-start">
          <aside class="lg:sticky lg:top-20 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:pb-4" :class="current ? 'hidden lg:block' : ''">
            <p class="mb-2 px-1 text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Sections, top to bottom</p>
            <BusinessSiteOutline :sections="site.sections" :selected="selected" :lang="lang" :main="main" :locales="site.locales" @select="select" @move="move" @add="startAdd" />
          </aside>
          <div id="section-editor" class="min-w-0 scroll-mt-28">
            <template v-if="current">
              <Button type="button" variant="ghost" size="sm" class="mb-2 lg:hidden" @click="selected = null"><ArrowLeft /> All sections</Button>
              <BusinessSiteSectionEditor v-model="current" :lang="lang" :main="main" :domain="site.domain" :index="index" :count="site.sections.length" @move="d => { move(index, index + d) }" @duplicate="duplicate" @remove="remove" />
            </template>
            <div v-else class="hidden rounded-2xl border border-dashed p-10 text-center text-muted-foreground lg:block">
              <LayoutList class="mx-auto size-8" aria-hidden="true" />
              <p class="mt-2 font-bold text-foreground">Pick a section on the left to edit it.</p>
              <p class="text-sm">Drag to reorder, or use Alt + ↑ / ↓.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- SETTINGS -->
      <div v-else-if="tab === 'settings'" class="mt-4 grid max-w-3xl gap-4">
        <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Address</h2>
          <Field label="Where the site lives" hint="Links in emails point here." class="mt-3">
            <Input v-model="site.domain" placeholder="https://yourdanceschool.com" />
          </Field>
        </section>
        <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Languages</h2>
          <p class="mt-1 text-sm text-muted-foreground">The main language comes first: a text not translated yet shows in it.</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <Button v-for="l in SITE_LOCALES" :key="l" type="button" size="sm" :variant="site.locales.includes(l) ? 'soft' : 'outline'" :aria-pressed="site.locales.includes(l)" @click="toggleLocale(l)">
              {{ LANG_NAMES[l] ?? l.toUpperCase() }}<span v-if="l === main" class="text-[10px] font-normal">· main</span>
            </Button>
          </div>
          <div v-if="site.locales.length > 1" class="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            Main language:
            <Select :model-value="main" :options="site.locales.map(l => ({ label: LANG_NAMES[l] ?? l, value: l }))" size="sm" class="w-40" @update:model-value="v => makeMain(String(v))" />
          </div>
        </section>
        <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Search engines and sharing</h2>
          <p class="mt-1 text-sm text-muted-foreground">What Google shows, and the preview when someone shares a link to your site.</p>
          <div class="mt-3 grid gap-4">
            <BusinessSiteText :model-value="site.seo?.title" label="Page title" :lang="lang" :main="main" @update:model-value="setSeo('title', $event)" />
            <BusinessSiteText :model-value="site.seo?.description" label="Description" multiline :rows="2" :lang="lang" :main="main" @update:model-value="setSeo('description', $event)" />
            <BusinessSiteImage :model-value="site.seo?.image" label="Image when shared" :domain="site.domain" @update:model-value="setSeoImage" />
          </div>
        </section>
      </div>

      <!-- WELCOME EMAIL -->
      <section v-else class="mt-4 max-w-3xl rounded-2xl border bg-card p-5 shadow-wd-card">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Welcome email</h2>
        <p class="mt-1 text-sm text-muted-foreground">Sent once to everyone who signs up on the site, in their language. <code>{name}</code> becomes their first name. Leave it empty to send nothing.</p>
        <div class="mt-4 grid gap-4">
          <BusinessSiteText :model-value="site.welcome?.subject" label="Subject" :lang="lang" :main="main" @update:model-value="setWelcome('subject', $event)" />
          <BusinessSiteText :model-value="site.welcome?.body" label="Message" multiline :rows="10" :lang="lang" :main="main" @update:model-value="setWelcome('body', $event)" />
        </div>
      </section>

      <BusinessSiteAddSection v-model:open="adding" @pick="add" />

      <!-- Save bar: always there, so you always know where you stand -->
      <div class="fixed inset-x-0 bottom-[var(--wd-tabbar-h,0px)] z-30 border-t bg-background/95 backdrop-blur md:left-60" role="region" aria-label="Saving">
        <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 py-3 pl-16 pr-4 md:px-4">
          <p class="min-w-0 flex-1 truncate text-sm" role="status">
            <span v-if="saving" class="font-bold">Saving…</span>
            <span v-else-if="dirty" class="font-bold text-wd-amber-800">Unsaved changes</span>
            <span v-else-if="justSaved" class="inline-flex items-center gap-1 font-bold text-wd-green-700"><Check class="size-4 shrink-0" aria-hidden="true" /> Saved<span class="hidden sm:inline">. Your website shows it within a minute.</span></span>
            <span v-else class="text-muted-foreground">All changes saved<template v-if="savedLabel"><span class="hidden sm:inline"> · {{ savedLabel }}</span></template></span>
          </p>
          <div class="flex shrink-0 items-center gap-2">
            <template v-if="dirty && confirmUndo">
              <span class="hidden text-sm sm:inline">Throw away your changes?</span>
              <Button type="button" variant="destructive" size="sm" @click="undoAll">Throw away</Button>
              <Button type="button" variant="ghost" size="sm" @click="confirmUndo = false">Keep editing</Button>
            </template>
            <Button v-else-if="dirty" type="button" variant="ghost" size="sm" @click="confirmUndo = true">Undo all</Button>
            <Button type="button" variant="cta" :loading="saving" :disabled="!dirty" @click="save"><Check /> Save <kbd class="ml-1 hidden rounded border border-white/30 px-1 text-[10px] font-normal sm:inline">⌘S</kbd></Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

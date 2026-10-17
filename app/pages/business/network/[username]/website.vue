<script setup lang="ts">
/**
 * /business/network/<handle>/website — the profile's own website, edited here
 * (RAZ-412). WeDance is its CMS: the site (e.g. montuno.club) renders exactly
 * these sections from /api/profiles/<handle>/site. Events aren't typed in: an
 * "Events" section lists the profile's events on WeDance. Sign-ups from the
 * site land in Contacts.
 */
import { ArrowUp, ArrowDown, Eye, EyeOff, Trash2, Plus, Check, ExternalLink, ChevronDown, ChevronRight, Contact, Globe } from 'lucide-vue-next'
import { SECTION_INFO, SECTION_KINDS, SITE_LOCALES, missingTexts, newId, pick, type ProfileSite, type SectionKind, type SiteSection, type SiteItem, type L10n } from '#shared/types/profileSite'

definePageMeta({ layout: 'business' })
const route = useRoute()
const { $trpc } = useNuxtApp()
const username = computed(() => String(route.params.username))

const profile = ref<{ username: string; name: string } | null>(null)
const site = ref<ProfileSite | null>(null)
const saved = ref('')
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
async function load() {
  try {
    const r = await $trpc.businessSite.get.query({ username: username.value })
    profile.value = r.profile
    site.value = structuredClone(r.site) as ProfileSite
    saved.value = JSON.stringify(site.value)
    lang.value = site.value.locales[0] ?? 'en'
    error.value = null
  } catch (e: any) { error.value = e?.message || 'Couldn’t load the website.' }
}
onMounted(load)
useHead(() => ({ title: `Website · ${profile.value?.name ?? ''} | Business | WeDance` }))

const dirty = computed(() => !!site.value && JSON.stringify(site.value) !== saved.value)
const saving = ref(false)
async function save() {
  if (!site.value) return
  saving.value = true
  error.value = null
  try {
    await $trpc.businessSite.save.mutate({ username: username.value, site: site.value as any })
    saved.value = JSON.stringify(site.value)
    notice.value = 'Saved. Your website shows it within a minute.'
  } catch (e: any) { error.value = e?.message || 'Couldn’t save.' } finally { saving.value = false }
}
onBeforeRouteLeave(() => !dirty.value || window.confirm('You have changes that aren’t saved. Leave anyway?'))

// --- languages
const lang = ref('en')
const main = computed(() => site.value?.locales[0] ?? 'en')
const missing = (l: string) => site.value ? missingTexts(site.value, l) : 0
function toggleLocale(l: string) {
  const s = site.value!
  if (s.locales.includes(l)) {
    if (s.locales.length === 1) return
    s.locales = s.locales.filter(x => x !== l)
    if (lang.value === l) lang.value = s.locales[0]!
  } else s.locales = [...s.locales, l]
}
function makeMain(l: string) {
  const s = site.value!
  s.locales = [l, ...s.locales.filter(x => x !== l)]
}

// --- sections
const open = ref<Set<string>>(new Set())
const toggle = (id: string) => { const n = new Set(open.value); n.has(id) ? n.delete(id) : n.add(id); open.value = n }
const has = (s: SiteSection, f: keyof SiteSection) => SECTION_INFO[s.kind].fields.includes(f)
const itemHas = (s: SiteSection, f: keyof SiteItem) => !!SECTION_INFO[s.kind].items?.fields.includes(f)
const heading = (s: SiteSection) => [pick(s.title, lang.value, main.value), pick(s.titleAccent, lang.value, main.value)].filter(Boolean).join(' ') || pick(s.eyebrow, lang.value, main.value) || '(no title)'
function move(i: number, d: -1 | 1) {
  const list = site.value!.sections
  const j = i + d
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
}
const confirmRemove = ref<string | null>(null)
function remove(i: number) { site.value!.sections.splice(i, 1); confirmRemove.value = null }
const addKind = ref<SectionKind>('text')
function add() {
  const s: SiteSection = { id: newId(), kind: addKind.value }
  if (SECTION_INFO[addKind.value].items) s.items = []
  site.value!.sections.push(s)
  open.value = new Set([...open.value, s.id])
}
const addItem = (s: SiteSection) => { s.items = [...(s.items ?? []), { id: newId() }] }
function moveItem(s: SiteSection, i: number, d: -1 | 1) {
  const list = s.items!
  const j = i + d
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
}
const addButton = (s: SiteSection) => { s.buttons = [...(s.buttons ?? []), { label: {}, url: '' }] }
function setSeo(key: 'title' | 'description', v: L10n | undefined) { site.value!.seo = { ...site.value!.seo, [key]: v } }
function setSeoImage(v: string | undefined) { site.value!.seo = { ...site.value!.seo, image: v } }
function setWelcome(key: 'subject' | 'body', v: L10n | undefined) { site.value!.welcome = { ...site.value!.welcome, [key]: v } }
function setCallout(sec: SiteSection, key: 'title' | 'body', v: L10n | undefined) { sec.callout = { ...sec.callout, [key]: v } }
function setCalloutButton(sec: SiteSection, patch: { label?: L10n; url?: string }) {
  const b = { label: sec.callout?.button?.label ?? {}, url: sec.callout?.button?.url ?? '', ...patch }
  sec.callout = { ...sec.callout, button: b }
}
const setDays = (sec: SiteSection, v: unknown) => { sec.days = Math.min(180, Math.max(1, Number(v) || 35)) }
const setAnchor = (sec: SiteSection, v: unknown) => { sec.anchor = String(v ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '') || undefined }
const kindOptions = SECTION_KINDS.map(k => ({ label: SECTION_INFO[k].label, value: k }))
const LANG_NAMES: Record<string, string> = { en: 'English', de: 'Deutsch', es: 'Español', ru: 'Русский', uk: 'Українська', fr: 'Français', it: 'Italiano', pt: 'Português', pl: 'Polski' }
</script>

<template>
  <div>
    <AdminState v-if="!site && !error" kind="loading" />
    <AdminState v-else-if="!site" kind="error" :message="error!" />
    <template v-else-if="profile && site">
      <AdminPageHeader
        eyebrow="Website"
        :title="profile.name"
        description="Your own website, run from WeDance: change the words and sections here and the site follows. Events come from your events on WeDance; people who sign up land in Contacts."
        :back="{ to: `/business/network/${profile.username}`, label: 'The profile' }"
      >
        <Button variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="`/business/network/${profile.username}/contacts`"><Contact /> Contacts</NuxtLink>
        </Button>
        <Button v-if="site.domain" variant="outline-pill" size="pill-sm" as-child>
          <a :href="site.domain" target="_blank" rel="noopener"><ExternalLink /> View site</a>
        </Button>
      </AdminPageHeader>
      <AdminState v-if="error" kind="error" :message="error" />
      <p v-if="notice && !dirty" role="status" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm font-bold text-wd-green-700"><Check class="size-4" aria-hidden="true" /> {{ notice }}</p>

      <!-- The site -->
      <section class="mt-6 rounded-2xl border bg-card p-5 shadow-wd-card">
        <h2 class="flex items-center gap-1.5 text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary"><Globe class="size-4" aria-hidden="true" /> The site</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Address" hint="Where the site lives, e.g. https://montuno.club">
            <Input v-model="site.domain" placeholder="https://…" />
          </Field>
          <div>
            <p class="text-sm font-bold">Languages</p>
            <p class="text-xs text-muted-foreground">The first one is the main language: a text not translated yet shows in it.</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <Button v-for="l in SITE_LOCALES" :key="l" type="button" size="sm" :variant="site.locales.includes(l) ? 'soft' : 'outline'" :aria-pressed="site.locales.includes(l)" @click="toggleLocale(l)">
                {{ l.toUpperCase() }}<span v-if="l === main" class="text-[10px] font-normal">· main</span>
              </Button>
            </div>
            <div v-if="site.locales.length > 1" class="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Make main:
              <button v-for="l in site.locales.filter(x => x !== main)" :key="l" type="button" class="font-bold underline underline-offset-2" @click="makeMain(l)">{{ l.toUpperCase() }}</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Editing language -->
      <div class="sticky top-0 z-10 -mx-1 mt-6 flex flex-wrap items-center gap-2 bg-background/95 px-1 py-2 backdrop-blur">
        <span class="text-sm font-bold">Editing in</span>
        <Button v-for="l in site.locales" :key="l" type="button" size="sm" :variant="lang === l ? 'cta' : 'outline'" :aria-pressed="lang === l" @click="lang = l">
          {{ LANG_NAMES[l] ?? l.toUpperCase() }}
          <span v-if="l !== main && missing(l)" class="rounded-full bg-wd-amber-500/20 px-1.5 text-[10px] font-bold text-wd-amber-800">{{ missing(l) }} missing</span>
        </Button>
      </div>

      <!-- Search engines + welcome email -->
      <section class="mt-2 rounded-2xl border bg-card p-5 shadow-wd-card">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Search engines and sharing</h2>
        <div class="mt-4 grid gap-4">
          <BusinessSiteText :model-value="site.seo?.title" label="Page title" :lang="lang" :main="main" @update:model-value="setSeo('title', $event)" />
          <BusinessSiteText :model-value="site.seo?.description" label="Description" multiline :rows="2" :lang="lang" :main="main" @update:model-value="setSeo('description', $event)" />
          <BusinessSiteImage :model-value="site.seo?.image" label="Image when shared" :domain="site.domain" @update:model-value="setSeoImage" />
        </div>
      </section>
      <section class="mt-4 rounded-2xl border bg-card p-5 shadow-wd-card">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Welcome email</h2>
        <p class="mt-1 text-sm text-muted-foreground">Sent once to everyone who signs up on the site, in their language. <code>{name}</code> becomes their first name. Leave it empty to send nothing.</p>
        <div class="mt-4 grid gap-4">
          <BusinessSiteText :model-value="site.welcome?.subject" label="Subject" :lang="lang" :main="main" @update:model-value="setWelcome('subject', $event)" />
          <BusinessSiteText :model-value="site.welcome?.body" label="Message" multiline :rows="8" :lang="lang" :main="main" @update:model-value="setWelcome('body', $event)" />
        </div>
      </section>

      <!-- Sections -->
      <h2 class="mt-8 text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Sections, top to bottom</h2>
      <div class="mt-3 space-y-3">
        <article v-for="(sec, i) in site.sections" :key="sec.id" class="rounded-2xl border bg-card shadow-wd-card" :class="sec.hidden ? 'opacity-60' : ''">
          <div class="flex items-center gap-2 p-3">
            <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" :aria-expanded="open.has(sec.id)" @click="toggle(sec.id)">
              <component :is="open.has(sec.id) ? ChevronDown : ChevronRight" class="size-4 shrink-0" aria-hidden="true" />
              <span class="shrink-0 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">{{ SECTION_INFO[sec.kind].label }}</span>
              <span class="truncate font-bold">{{ heading(sec) }}</span>
              <span v-if="sec.hidden" class="shrink-0 text-xs text-muted-foreground">hidden</span>
            </button>
            <Button type="button" variant="ghost" size="icon" :disabled="i === 0" aria-label="Move up" @click="move(i, -1)"><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon" :disabled="i === site.sections.length - 1" aria-label="Move down" @click="move(i, 1)"><ArrowDown /></Button>
            <Button type="button" variant="ghost" size="icon" :aria-label="sec.hidden ? 'Show on the site' : 'Hide from the site'" @click="sec.hidden = !sec.hidden"><component :is="sec.hidden ? EyeOff : Eye" /></Button>
            <Button v-if="confirmRemove !== sec.id" type="button" variant="ghost" size="icon" aria-label="Delete section" @click="confirmRemove = sec.id"><Trash2 /></Button>
            <template v-else>
              <Button type="button" variant="destructive" size="sm" @click="remove(i)">Delete</Button>
              <Button type="button" variant="ghost" size="sm" @click="confirmRemove = null">Keep</Button>
            </template>
          </div>

          <div v-if="open.has(sec.id)" class="grid gap-4 border-t p-4">
            <p class="text-sm text-muted-foreground">{{ SECTION_INFO[sec.kind].hint }}</p>
            <div class="grid gap-4 sm:grid-cols-3">
              <BusinessSiteText v-if="has(sec, 'eyebrow')" v-model="sec.eyebrow" label="Small line above" :lang="lang" :main="main" />
              <BusinessSiteText v-if="has(sec, 'title')" v-model="sec.title" label="Title" :lang="lang" :main="main" />
              <BusinessSiteText v-if="has(sec, 'titleAccent')" v-model="sec.titleAccent" label="Title, highlighted end" :lang="lang" :main="main" />
            </div>
            <BusinessSiteText v-if="has(sec, 'body')" v-model="sec.body" label="Text" hint="A blank line starts a new paragraph." multiline :lang="lang" :main="main" />
            <BusinessSiteImage v-if="has(sec, 'image')" v-model="sec.image" label="Photo" :domain="site.domain" />
            <Field v-if="has(sec, 'video')" label="YouTube video" hint="The link to the video."><Input v-model="sec.video" placeholder="https://www.youtube.com/watch?v=…" /></Field>
            <BusinessSiteText v-if="has(sec, 'address')" v-model="sec.address" label="Address" :lang="lang" :main="main" />
            <Field v-if="has(sec, 'mapUrl')" label="Map link" hint="Google Maps link people tap for directions."><Input v-model="sec.mapUrl" placeholder="https://maps.google.com/?q=…" /></Field>
            <Field v-if="has(sec, 'days')" label="How far ahead" hint="Days of events to list.">
              <Input :model-value="String(sec.days ?? 35)" type="number" min="1" max="180" @update:model-value="setDays(sec, $event)" />
            </Field>

            <!-- Buttons -->
            <div v-if="has(sec, 'buttons')" class="grid gap-2">
              <p class="text-sm font-bold">Buttons</p>
              <div v-for="(b, bi) in sec.buttons ?? []" :key="bi" class="grid items-end gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto]">
                <BusinessSiteText v-model="b.label" label="Label" :lang="lang" :main="main" />
                <Field label="Goes to" hint="A link, or #section on the page."><Input v-model="b.url" placeholder="#join or https://…" /></Field>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove button" @click="sec.buttons!.splice(bi, 1)"><Trash2 /></Button>
              </div>
              <Button v-if="(sec.buttons?.length ?? 0) < 4" type="button" variant="outline" size="sm" class="justify-self-start" @click="addButton(sec)"><Plus /> Add a button</Button>
            </div>

            <!-- Items -->
            <div v-if="has(sec, 'items') && SECTION_INFO[sec.kind].items" class="grid gap-2">
              <p class="text-sm font-bold">{{ SECTION_INFO[sec.kind].items!.label }}</p>
              <div v-for="(it, ii) in sec.items ?? []" :key="it.id" class="grid gap-3 rounded-xl border p-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-bold text-muted-foreground">{{ ii + 1 }}</span>
                  <div class="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" :disabled="ii === 0" aria-label="Move up" @click="moveItem(sec, ii, -1)"><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon" :disabled="ii === (sec.items?.length ?? 0) - 1" aria-label="Move down" @click="moveItem(sec, ii, 1)"><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove" @click="sec.items!.splice(ii, 1)"><Trash2 /></Button>
                  </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                  <BusinessSiteText v-if="itemHas(sec, 'tag')" v-model="it.tag" label="Label" :lang="lang" :main="main" />
                  <BusinessSiteText v-if="itemHas(sec, 'title')" v-model="it.title" :label="sec.kind === 'faq' ? 'Question' : 'Title'" :lang="lang" :main="main" />
                </div>
                <BusinessSiteText v-if="itemHas(sec, 'body')" v-model="it.body" :label="sec.kind === 'faq' ? 'Answer' : 'Text'" multiline :rows="3" :lang="lang" :main="main" />
                <BusinessSiteImage v-if="itemHas(sec, 'image')" v-model="it.image" label="Photo" :domain="site.domain" />
                <Field v-if="itemHas(sec, 'url')" label="Link" optional><Input v-model="it.url" placeholder="https://…" /></Field>
              </div>
              <Button v-if="(sec.items?.length ?? 0) < 24" type="button" variant="outline" size="sm" class="justify-self-start" @click="addItem(sec)"><Plus /> Add</Button>
            </div>

            <!-- Callout -->
            <div v-if="has(sec, 'callout')" class="grid gap-3 rounded-xl border border-dashed p-3">
              <p class="text-sm font-bold">Box under the section <span class="font-normal text-muted-foreground">(optional, e.g. join our WhatsApp group)</span></p>
              <div class="grid gap-3 sm:grid-cols-2">
                <BusinessSiteText :model-value="sec.callout?.title" label="Title" :lang="lang" :main="main" @update:model-value="setCallout(sec, 'title', $event)" />
                <BusinessSiteText :model-value="sec.callout?.body" label="Text" :lang="lang" :main="main" @update:model-value="setCallout(sec, 'body', $event)" />
                <BusinessSiteText :model-value="sec.callout?.button?.label" label="Button" :lang="lang" :main="main" @update:model-value="setCalloutButton(sec, { label: $event ?? {} })" />
                <Field label="Button goes to"><Input :model-value="sec.callout?.button?.url ?? ''" placeholder="https://…" @update:model-value="setCalloutButton(sec, { url: String($event) })" /></Field>
              </div>
            </div>

            <!-- In the menu -->
            <div class="grid gap-3 sm:grid-cols-2">
              <Field label="Anchor" hint="Lets links point here as #anchor. Lowercase, no spaces." optional><Input :model-value="sec.anchor ?? ''" placeholder="schedule" @update:model-value="setAnchor(sec, $event)" /></Field>
              <BusinessSiteText v-model="sec.navLabel" label="In the menu as" hint="Needs an anchor. Leave empty to keep it out of the menu." :lang="lang" :main="main" />
            </div>
          </div>
        </article>
      </div>

      <div class="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-dashed p-4">
        <Field label="Add a section" class="w-56"><Select v-model="addKind" :options="kindOptions" size="sm" /></Field>
        <Button type="button" variant="outline-pill" size="pill-sm" @click="add"><Plus /> Add</Button>
        <p class="basis-full text-xs text-muted-foreground">{{ SECTION_INFO[addKind].hint }}</p>
      </div>

      <!-- Save bar -->
      <div v-if="dirty" class="sticky bottom-0 z-20 -mx-1 mt-6 rounded-t-2xl border border-b-0 bg-background/95 shadow-wd-card backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p class="text-sm font-bold">You have changes that aren’t saved.</p>
          <div class="flex gap-2">
            <Button type="button" variant="ghost" @click="load">Undo all</Button>
            <Button type="button" variant="cta" :loading="saving" @click="save"><Check /> Save</Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

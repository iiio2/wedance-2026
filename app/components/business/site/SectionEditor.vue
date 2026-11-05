<script setup lang="ts">
/**
 * Editing one section of a profile's website (RAZ-412), grouped by what people
 * change most: the words, then photo/video, buttons, the list (cards,
 * questions…), the box under it, and — tucked away — link & menu settings.
 */
import { ArrowUp, ArrowDown, Trash2, Plus, Eye, EyeOff, Copy, ChevronDown, ChevronRight, Link2 } from 'lucide-vue-next'
import { SECTION_INFO, newId, pick, type L10n, type SiteSection, type SiteItem } from '#shared/types/profileSite'
import { sizedImage, IMG } from '#shared/utils/image'
import { KIND_ICONS } from '~/lib/site-kinds'

const props = defineProps<{ lang: string; main: string; domain?: string; index: number; count: number }>()
const sec = defineModel<SiteSection>({ required: true })
const emit = defineEmits<{ remove: []; duplicate: []; move: [delta: -1 | 1] }>()

const info = computed(() => SECTION_INFO[sec.value.kind])
const has = (f: keyof SiteSection) => info.value.fields.includes(f)
const itemHas = (f: keyof SiteItem) => !!info.value.items?.fields.includes(f)
const hasWords = computed(() => ['eyebrow', 'title', 'titleAccent', 'body', 'address'].some(f => has(f as keyof SiteSection)))
const hasMedia = computed(() => has('image') || has('video') || has('mapUrl'))

// Items (cards, questions, facts): one open at a time keeps long lists short.
const openItem = ref<string | null>(null)
watch(() => sec.value.id, () => { openItem.value = null; confirmRemove.value = false; advanced.value = false })
const itemTitle = (it: SiteItem) => pick(it.title, props.lang, props.main) || pick(it.tag, props.lang, props.main) || pick(it.body, props.lang, props.main).slice(0, 60) || 'New'
function addItem() {
  const it: SiteItem = { id: newId() }
  sec.value.items = [...(sec.value.items ?? []), it]
  openItem.value = it.id
}
function moveItem(i: number, d: -1 | 1) {
  const list = sec.value.items!
  const j = i + d
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
}
const addButton = () => { sec.value.buttons = [...(sec.value.buttons ?? []), { label: {}, url: '' }] }

function setCallout(key: 'title' | 'body', v: L10n | undefined) { sec.value.callout = { ...sec.value.callout, [key]: v } }
function setCalloutButton(patch: { label?: L10n; url?: string }) {
  const b = { label: sec.value.callout?.button?.label ?? {}, url: sec.value.callout?.button?.url ?? '', ...patch }
  sec.value.callout = { ...sec.value.callout, button: b }
}
const showCallout = ref(false)
const calloutOn = computed(() => showCallout.value || !!(sec.value.callout?.title || sec.value.callout?.body || sec.value.callout?.button?.url))

const setDays = (v: unknown) => { sec.value.days = Math.min(180, Math.max(1, Number(v) || 35)) }
const setAnchor = (v: unknown) => { sec.value.anchor = String(v ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '') || undefined }
const advanced = ref(false)
const confirmRemove = ref(false)
</script>

<template>
  <article class="rounded-2xl border bg-card shadow-wd-card" :aria-label="`${info.label} section`">
    <!-- Header: what it is + section actions -->
    <header class="flex flex-wrap items-center gap-3 border-b p-4">
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary"><component :is="KIND_ICONS[sec.kind]" class="size-5" aria-hidden="true" /></span>
      <div class="min-w-[10rem] flex-1">
        <p class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Section {{ index + 1 }} of {{ count }}</p>
        <h2 class="font-display text-xl font-bold leading-tight">{{ info.label }}</h2>
      </div>
      <p class="order-last basis-full text-sm text-muted-foreground">{{ info.hint }}</p>
      <div class="flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" :variant="sec.hidden ? 'soft' : 'ghost'" :aria-pressed="!!sec.hidden" @click="sec.hidden = !sec.hidden">
          <component :is="sec.hidden ? EyeOff : Eye" /> {{ sec.hidden ? 'Hidden' : 'Visible' }}
        </Button>
        <Button type="button" variant="ghost" size="icon" :disabled="index === 0" aria-label="Move section up" @click="emit('move', -1)"><ArrowUp /></Button>
        <Button type="button" variant="ghost" size="icon" :disabled="index === count - 1" aria-label="Move section down" @click="emit('move', 1)"><ArrowDown /></Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Duplicate section" @click="emit('duplicate')"><Copy /></Button>
        <Button v-if="!confirmRemove" type="button" variant="ghost" size="icon" aria-label="Delete section" @click="confirmRemove = true"><Trash2 /></Button>
        <template v-else>
          <Button type="button" variant="destructive" size="sm" @click="emit('remove')">Delete</Button>
          <Button type="button" variant="ghost" size="sm" @click="confirmRemove = false">Keep</Button>
        </template>
      </div>
      <p v-if="sec.hidden" class="basis-full rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">Hidden: saved here, but not shown on the site.</p>
    </header>

    <div class="grid gap-6 p-4 sm:p-5">
      <!-- Words -->
      <section v-if="hasWords" class="grid gap-3" aria-labelledby="sec-words">
        <h3 id="sec-words" class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Words</h3>
        <BusinessSiteText v-if="has('eyebrow')" v-model="sec.eyebrow" label="Small line above the title" :lang="lang" :main="main" />
        <div v-if="has('title') || has('titleAccent')" class="grid gap-3 sm:grid-cols-2">
          <BusinessSiteText v-if="has('title')" v-model="sec.title" label="Title" :lang="lang" :main="main" />
          <BusinessSiteText v-if="has('titleAccent')" v-model="sec.titleAccent" label="Highlighted end of the title" hint="Shown in the accent colour right after the title." :lang="lang" :main="main" />
        </div>
        <BusinessSiteText v-if="has('body')" v-model="sec.body" label="Text" hint="A blank line starts a new paragraph." multiline :rows="5" :lang="lang" :main="main" />
        <BusinessSiteText v-if="has('address')" v-model="sec.address" label="Address" :lang="lang" :main="main" />
        <Field v-if="has('days')" label="How far ahead" hint="Days of upcoming events to list. The events themselves come from your events on WeDance.">
          <Input :model-value="String(sec.days ?? 35)" type="number" min="1" max="180" class="w-28" @update:model-value="setDays($event)" />
        </Field>
      </section>

      <!-- Photo, video, map -->
      <section v-if="hasMedia" class="grid gap-3" aria-labelledby="sec-media">
        <h3 id="sec-media" class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">{{ has('mapUrl') ? 'Map' : 'Photo and video' }}</h3>
        <BusinessSiteImage v-if="has('image')" v-model="sec.image" label="Photo" :domain="domain" />
        <Field v-if="has('video') && sec.kind === 'hero'" label="Background video" hint="An .mp4 that plays silently on a loop behind the title. The photo shows while it loads." optional><Input v-model="sec.video" placeholder="https://…/hero.mp4" /></Field>
        <Field v-else-if="has('video')" label="YouTube video" :optional="sec.kind !== 'video'"><Input v-model="sec.video" placeholder="https://www.youtube.com/watch?v=…" /></Field>
        <Field v-if="has('mapUrl')" label="Map link" hint="The Google Maps link people tap for directions."><Input v-model="sec.mapUrl" placeholder="https://maps.google.com/?q=…" /></Field>
      </section>

      <!-- Buttons -->
      <section v-if="has('buttons')" class="grid gap-3" aria-labelledby="sec-buttons">
        <h3 id="sec-buttons" class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Buttons</h3>
        <p v-if="!sec.buttons?.length" class="text-sm text-muted-foreground">No buttons yet.</p>
        <div v-for="(b, bi) in sec.buttons ?? []" :key="bi" class="grid items-end gap-2 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <BusinessSiteText v-model="b.label" :label="`Button ${bi + 1}`" :lang="lang" :main="main" />
          <Field label="Goes to" hint="A link, or #section on this page."><Input v-model="b.url" placeholder="#join or https://…" /></Field>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove button" @click="sec.buttons!.splice(bi, 1)"><Trash2 /></Button>
        </div>
        <Button v-if="(sec.buttons?.length ?? 0) < 4" type="button" variant="outline" size="sm" class="justify-self-start" @click="addButton"><Plus /> Add a button</Button>
      </section>

      <!-- Items -->
      <section v-if="has('items') && info.items" class="grid gap-2" aria-labelledby="sec-items">
        <h3 id="sec-items" class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">{{ info.items.label }} <span class="font-normal normal-case tracking-normal text-muted-foreground">· {{ sec.items?.length ?? 0 }}</span></h3>
        <div v-for="(it, ii) in sec.items ?? []" :key="it.id" class="rounded-xl border" :class="openItem === it.id ? 'bg-muted/30' : ''">
          <div class="flex items-center gap-1 p-1.5">
            <button type="button" class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left focus-visible:shadow-wd-focus focus-visible:outline-none" :aria-expanded="openItem === it.id" @click="openItem = openItem === it.id ? null : it.id">
              <component :is="openItem === it.id ? ChevronDown : ChevronRight" class="size-4 shrink-0" aria-hidden="true" />
              <span class="text-xs font-bold text-muted-foreground">{{ ii + 1 }}</span>
              <img v-if="it.image" :src="sizedImage(it.image, IMG.avatar)" alt="" class="size-7 shrink-0 rounded object-cover">
              <span class="truncate text-sm font-bold">{{ itemTitle(it) }}</span>
            </button>
            <Button type="button" variant="ghost" size="icon" class="size-8" :disabled="ii === 0" aria-label="Move up" @click="moveItem(ii, -1)"><ArrowUp class="size-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" class="size-8" :disabled="ii === (sec.items?.length ?? 0) - 1" aria-label="Move down" @click="moveItem(ii, 1)"><ArrowDown class="size-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" class="size-8" aria-label="Remove" @click="sec.items!.splice(ii, 1)"><Trash2 class="size-3.5" /></Button>
          </div>
          <div v-if="openItem === it.id" class="grid gap-3 border-t p-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <BusinessSiteText v-if="itemHas('tag')" v-model="it.tag" label="Label" hint="A small tag above, e.g. “Beginners”." :lang="lang" :main="main" />
              <BusinessSiteText v-if="itemHas('title')" v-model="it.title" :label="sec.kind === 'faq' ? 'Question' : 'Title'" :lang="lang" :main="main" />
            </div>
            <BusinessSiteText v-if="itemHas('body')" v-model="it.body" :label="sec.kind === 'faq' ? 'Answer' : 'Text'" multiline :rows="3" :lang="lang" :main="main" />
            <BusinessSiteImage v-if="itemHas('image')" v-model="it.image" label="Photo" :domain="domain" />
            <Field v-if="itemHas('url')" label="Link" optional><Input v-model="it.url" placeholder="https://…" /></Field>
          </div>
        </div>
        <Button v-if="(sec.items?.length ?? 0) < 24" type="button" variant="outline" size="sm" class="justify-self-start" @click="addItem"><Plus /> Add {{ sec.kind === 'faq' ? 'a question' : sec.kind === 'cards' ? 'a card' : 'one' }}</Button>
      </section>

      <!-- Callout -->
      <section v-if="has('callout')" class="grid gap-3" aria-labelledby="sec-callout">
        <h3 id="sec-callout" class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Box under the section</h3>
        <template v-if="calloutOn">
          <div class="grid gap-3 rounded-xl border border-dashed p-3 sm:grid-cols-2">
            <BusinessSiteText :model-value="sec.callout?.title" label="Title" :lang="lang" :main="main" @update:model-value="setCallout('title', $event)" />
            <BusinessSiteText :model-value="sec.callout?.body" label="Text" :lang="lang" :main="main" @update:model-value="setCallout('body', $event)" />
            <BusinessSiteText :model-value="sec.callout?.button?.label" label="Button" :lang="lang" :main="main" @update:model-value="setCalloutButton({ label: $event ?? {} })" />
            <Field label="Button goes to"><Input :model-value="sec.callout?.button?.url ?? ''" placeholder="https://…" @update:model-value="setCalloutButton({ url: String($event) })" /></Field>
          </div>
          <Button type="button" variant="ghost" size="sm" class="justify-self-start" @click="sec.callout = undefined; showCallout = false"><Trash2 /> Remove the box</Button>
        </template>
        <Button v-else type="button" variant="outline" size="sm" class="justify-self-start" @click="showCallout = true"><Plus /> Add a box (e.g. join our WhatsApp group)</Button>
      </section>

      <!-- Link & menu -->
      <section class="border-t pt-4">
        <button type="button" class="inline-flex items-center gap-1.5 text-sm font-bold text-secondary" :aria-expanded="advanced" @click="advanced = !advanced">
          <component :is="advanced ? ChevronDown : ChevronRight" class="size-4" aria-hidden="true" /><Link2 class="size-4" aria-hidden="true" /> Link and menu
          <span v-if="sec.anchor" class="font-normal text-muted-foreground">· #{{ sec.anchor }}{{ pick(sec.navLabel, lang, main) ? ` · in the menu as “${pick(sec.navLabel, lang, main)}”` : '' }}</span>
        </button>
        <div v-if="advanced" class="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Anchor" hint="Lets buttons point here as #anchor. Lowercase, no spaces." optional><Input :model-value="sec.anchor ?? ''" placeholder="schedule" @update:model-value="setAnchor($event)" /></Field>
          <BusinessSiteText v-model="sec.navLabel" label="In the menu as" hint="Needs an anchor. Empty keeps it out of the menu." :lang="lang" :main="main" />
        </div>
      </section>
    </div>
  </article>
</template>

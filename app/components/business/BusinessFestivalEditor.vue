<script setup lang="ts">
/**
 * The festival fields of the event editor, one part at a time, so they sit
 * inside the same cards every event has (Branding, When and where, Entry and
 * tickets, Programme): logo, colour and links · practical info · passes · the
 * programme of workshops and parties day by day. Teacher videos live in the
 * line-up.
 *
 *   <BusinessFestivalEditor v-model="form.festival" part="programme" :days="festivalDays" :lineup="form.artists" />
 *
 * Session ids are kept as they are: dancers' picks are stored by them.
 */
import type { PropType } from 'vue'
import { Plus, X, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-vue-next'
import type { FestivalDetails, FestivalPass, FestivalSession } from '#shared/types/festivalDetails'

type Editable = Omit<FestivalDetails, 'key'>
const model = defineModel<Editable>({ required: true })
const props = defineProps({
  part: { type: String as PropType<'branding' | 'practical' | 'passes' | 'programme'>, required: true },
  /** The event’s days, yyyy-mm-dd, from its dates. */
  days: { type: Array as PropType<string[]>, required: true },
  /** Line-up handles, for the session artist and the videos. */
  lineup: { type: Array as PropType<string[]>, default: () => [] },
  /** The event's music: the styles a session can be. Empty = every style. */
  styles: { type: Array as PropType<string[]>, default: () => [] },
})

// Lists always exist, so rows can be added straight away.
model.value.socialLinks ??= []
model.value.practicalInfo ??= []
model.value.passes ??= []
model.value.sessions ??= []
model.value.videos ??= {}

const { $trpc } = useNuxtApp()
const names = ref(new Map<string, string>())
watch(() => props.lineup, async (h) => {
  if (props.part !== 'programme') return
  const missing = h.filter(x => !names.value.has(x))
  if (!missing.length) return
  try {
    const rows = await $trpc.businessEvents.lineupPhotos.query({ handles: missing })
    const next = new Map(names.value)
    for (const r of rows) next.set(r.username, r.name || r.username)
    names.value = next
  } catch { /* handles stay as labels */ }
}, { immediate: true })
const nameOf = (h: string) => names.value.get(h) || '@' + h

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
const weekdays = computed(() => [...new Set(props.days.map(weekday))])

// --- look and links
const PLATFORMS = ['website', 'instagram', 'facebook', 'youtube', 'tiktok', 'whatsapp', 'telegram']
const links = computed(() => model.value.socialLinks!)
const info = computed(() => model.value.practicalInfo!)

// --- passes
const passes = computed(() => model.value.passes!)
const openPass = ref<number | null>(null)
function addPass() { passes.value.push({ name: '', price: 0, days: [] }); openPass.value = passes.value.length - 1 }
function toggleDay(p: FestivalPass, d: string) {
  const i = p.days.indexOf(d)
  i > -1 ? p.days.splice(i, 1) : p.days.push(d)
}

// --- programme
const sessions = computed(() => model.value.sessions!)
const byDay = computed(() => {
  const all = [...props.days]
  // Sessions on a date outside the festival's days still show, so nothing is lost.
  for (const s of sessions.value) if (!all.includes(s.date)) all.push(s.date)
  // The open session keeps its place while its time is typed (re-sorting on each
  // key would move it away and lose focus); it moves when it's closed.
  const timeOf = (x: FestivalSession) => (x.id === open.value && heldTime.value != null ? heldTime.value : x.time)
  return all.sort().map(d => ({ date: d, items: sessions.value.filter(s => s.date === d).sort((a, b) => timeOf(a).localeCompare(timeOf(b))) }))
})
const open = ref<string | null>(null)
const heldTime = ref<string | null>(null)
watch(open, (id) => { heldTime.value = id ? sessions.value.find(x => x.id === id)?.time ?? null : null })
function addSession(date: string, type: 'workshop' | 'party') {
  const id = `s-${Math.random().toString(36).slice(2, 8)}`
  sessions.value.push({ id, date, time: type === 'party' ? '22:00' : '18:00', duration: type === 'party' ? 240 : 60, type, title: '', artist: '', style: '', level: 'Beginner' } as FestivalSession)
  open.value = id
}
function removeSession(id: string) {
  const i = sessions.value.findIndex(s => s.id === id)
  if (i > -1) sessions.value.splice(i, 1)
}
const LEVELS = ['Beginner', 'Intermediate', 'Advanced']
</script>

<template>
  <!-- Logo, colour, links -->
  <div v-if="part === 'branding'">
      <div class="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Logo" optional>
          <ImageUpload v-model="model.logo" folder="events" />
        </Field>
        <Field id="fest-accent" label="Colour" optional hint="The festival’s accent on its page.">
          <div class="flex items-center gap-2">
            <input id="fest-accent" v-model="model.accentColor" type="color" class="h-10 w-14 cursor-pointer rounded-lg border" aria-label="Accent colour">
            <Input v-model="model.accentColor" class="w-32 font-mono" placeholder="Colour code" aria-label="Accent colour as hex" />
          </div>
        </Field>
      </div>

      <p class="mt-4 text-sm font-bold">Links</p>
      <div class="mt-2 grid gap-2">
        <div v-for="(l, i) in links" :key="i" class="flex gap-2">
          <div class="w-36 shrink-0"><Select v-model="l.platform" :options="PLATFORMS" :aria-label="`Link ${i + 1} type`" /></div>
          <Input v-model="l.url" class="min-w-0 flex-1" placeholder="https://…" :aria-label="`Link ${i + 1}`" />
          <Button type="button" variant="ghost" size="icon-sm" :aria-label="`Remove link ${i + 1}`" @click="links.splice(i, 1)"><X /></Button>
        </div>
        <Button type="button" variant="ghost" size="sm" class="justify-self-start" @click="links.push({ platform: 'website', url: '' })"><Plus /> Add a link</Button>
      </div>

  </div>

  <!-- Practical info -->
  <div v-else-if="part === 'practical'">
      <p class="text-sm font-bold">Practical info <span class="font-normal text-muted-foreground">(optional)</span></p>
      <p class="text-xs text-muted-foreground">Venues, transport, payment, what to bring: one line each.</p>
      <div class="mt-2 grid gap-2">
        <div v-for="(_, i) in info" :key="i" class="flex gap-2">
          <Input v-model="info[i]" class="flex-1" :aria-label="`Practical info, line ${i + 1}`" />
          <Button type="button" variant="ghost" size="icon-sm" :aria-label="`Remove line ${i + 1}`" @click="info.splice(i, 1)"><X /></Button>
        </div>
        <Button type="button" variant="ghost" size="sm" class="justify-self-start" @click="info.push('')"><Plus /> Add a line</Button>
      </div>
  </div>

  <!-- Passes -->
  <div v-else-if="part === 'passes'">
      <p class="text-sm font-bold">Passes</p>
      <p class="text-xs text-muted-foreground">What dancers can buy. The page recommends the best-value pass for the sessions they pick.</p>
      <div class="mt-3 grid gap-3">
        <div v-for="(p, i) in passes" :key="i" class="rounded-xl border">
          <div class="flex items-center gap-3 px-3 py-2 text-sm">
            <span class="min-w-0 flex-1 truncate">
              <span class="font-bold">{{ p.name || 'Untitled pass' }}</span>
              <span class="tabular-nums"> · {{ p.price }} €</span>
              <span class="text-muted-foreground"> · {{ p.days.length ? p.days.join(', ') : 'All days' }}</span>
              <span v-if="p.description" class="text-muted-foreground"> · {{ p.description }}</span>
              <Badge v-if="p.soldOut" variant="outline" class="ml-1.5">Sold out</Badge>
            </span>
            <Button type="button" variant="ghost" size="sm" :aria-expanded="openPass === i" @click="openPass = openPass === i ? null : i"><template v-if="openPass === i"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
          </div>
          <div v-if="openPass === i" class="border-t p-3">
            <div class="flex flex-wrap items-end gap-2">
              <Field :id="`pass-name-${i}`" label="Name" class="min-w-[10rem] flex-1"><Input v-model="p.name" placeholder="Full Pass" /></Field>
              <Field :id="`pass-price-${i}`" label="Price (€)" class="w-28"><Input v-model.number="p.price" type="number" min="0" step="1" /></Field>
              <label class="mb-2 inline-flex items-center gap-2 text-sm"><Checkbox v-model="p.soldOut" /> Sold out</label>
              <Button type="button" variant="ghost" size="icon-sm" class="mb-1" :aria-label="`Remove pass ${p.name || i + 1}`" @click="passes.splice(i, 1); openPass = null"><X /></Button>
            </div>
            <Field :id="`pass-desc-${i}`" label="What’s included" optional class="mt-2"><Input v-model="p.description" placeholder="All workshops + all parties" /></Field>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span class="text-xs text-muted-foreground">Days:</span>
              <label v-for="d in weekdays" :key="d" class="inline-flex items-center gap-1.5"><Checkbox :model-value="p.days.includes(d)" @update:model-value="toggleDay(p, d)" /> {{ d }}</label>
              <span class="text-xs text-muted-foreground">{{ p.days.length ? '' : '(none ticked = all days)' }}</span>
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" class="justify-self-start" @click="addPass"><Plus /> Add a pass</Button>
      </div>
  </div>

  <!-- Programme -->
  <div v-else>
      <p class="text-xs text-muted-foreground">Workshops and parties, day by day. Dancers pick from it to build their plan.</p>
      <p v-if="!days.length" class="mt-3 text-sm text-muted-foreground">Set the date under “When” to plan its days.</p>
      <div v-for="d in byDay" :key="d.date" class="mt-4 first:mt-0">
        <h3 class="text-xs font-bold uppercase tracking-wider text-secondary">{{ fmtDay(d.date) }} <span v-if="!days.includes(d.date)" class="normal-case text-destructive">· outside the event’s dates</span></h3>
        <ul class="mt-2 grid gap-2">
          <li v-for="s in d.items" :key="s.id" class="rounded-xl border">
            <button type="button" class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm" :aria-expanded="open === s.id" @click="open = open === s.id ? null : s.id">
              <span class="w-12 shrink-0 font-bold tabular-nums">{{ s.time }}</span>
              <span class="min-w-0 flex-1 truncate">
                <span class="font-bold">{{ s.title || 'Untitled' }}</span>
                <span class="text-muted-foreground">{{ [s.type === 'party' ? 'Party' : s.style, s.artist && [s.artist, ...(s.with ?? [])].map(nameOf).join(' & '), s.room].filter(Boolean).map(x => ` · ${x}`).join('') }}</span>
              </span>
              <ChevronUp v-if="open === s.id" class="size-4 shrink-0" aria-hidden="true" /><ChevronDown v-else class="size-4 shrink-0" aria-hidden="true" />
            </button>
            <div v-if="open === s.id" class="grid gap-3 border-t p-3 sm:grid-cols-4">
              <Field :id="`s-title-${s.id}`" label="Title" class="sm:col-span-4"><Input v-model="s.title" placeholder="Bootcamp Son" /></Field>
              <Field :id="`s-type-${s.id}`" label="Type"><Select v-model="s.type" :options="[{ label: 'Workshop', value: 'workshop' }, { label: 'Party / concert', value: 'party' }]" /></Field>
              <Field :id="`s-date-${s.id}`" label="Day"><Select v-model="s.date" :options="(days.includes(s.date) ? days : [...days, s.date]).map(x => ({ label: fmtDay(x), value: x }))" /></Field>
              <Field :id="`s-time-${s.id}`" label="Starts"><Input v-model="s.time" type="time" /></Field>
              <Field :id="`s-dur-${s.id}`" label="Minutes"><Input v-model.number="s.duration" type="number" min="5" step="5" /></Field>
              <Field :id="`s-artist-${s.id}`" label="Artist" class="sm:col-span-2" hint="From the line-up.">
                <Select v-model="s.artist" :options="[{ label: 'Nobody', value: '' }, ...lineup.map(h => ({ label: nameOf(h), value: h }))]" />
              </Field>
              <div v-if="lineup.length > 1" class="sm:col-span-4">
                <p class="text-sm font-bold">Teaching with <span class="font-normal text-muted-foreground">(optional)</span></p>
                <div class="mt-1 flex flex-wrap gap-1.5">
                  <Button
                    v-for="h in lineup.filter(x => x !== s.artist)"
                    :key="h"
                    type="button"
                    size="sm"
                    :variant="(s.with ?? []).includes(h) ? 'soft' : 'outline'"
                    :aria-pressed="(s.with ?? []).includes(h)"
                    @click="s.with = (s.with ?? []).includes(h) ? s.with!.filter(x => x !== h) : [...(s.with ?? []), h]"
                  >{{ nameOf(h) }}</Button>
                </div>
              </div>
              <Field :id="`s-style-${s.id}`" label="Style" class="sm:col-span-4" :hint="styles.length ? 'From the event’s music.' : undefined">
                <DanceStylePicker
                  :model-value="s.style ? [s.style] : []"
                  single
                  :options="styles.length ? styles : undefined"
                  :searchable="!styles.length || styles.length > 8"
                  label="Session style"
                  @update:model-value="(v: string[]) => (s.style = v[0] ?? '')"
                />
              </Field>
              <Field :id="`s-level-${s.id}`" label="Level"><Select v-model="s.level" :options="LEVELS" /></Field>
              <Field :id="`s-room-${s.id}`" label="Room" optional><Input v-model="s.room" placeholder="Havana" /></Field>
              <Field :id="`s-venue-${s.id}`" label="Other venue" optional class="sm:col-span-3" hint="Only if not the main venue."><Input v-model="s.venue" placeholder="Danzón, Johannesgasse 3, 1010 Vienna" /></Field>
              <Field :id="`s-desc-${s.id}`" label="Description" optional class="sm:col-span-4"><Textarea v-model="s.description" :rows="2" /></Field>
              <div class="sm:col-span-4">
                <Button type="button" variant="ghost" size="sm" class="text-destructive" @click="removeSession(s.id)"><X /> Remove this session</Button>
              </div>
            </div>
          </li>
        </ul>
        <div class="mt-2 flex gap-2">
          <Button type="button" variant="ghost" size="sm" @click="addSession(d.date, 'workshop')"><Plus /> Workshop</Button>
          <Button type="button" variant="ghost" size="sm" @click="addSession(d.date, 'party')"><Plus /> Party</Button>
        </div>
      </div>
  </div>
</template>

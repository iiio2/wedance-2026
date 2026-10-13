<script setup lang="ts">
/**
 * Prototype — the event editor, rebuilt from the flyer's "Check the details"
 * step. Every card reads like the event and opens to edit. Beside it, the
 * flyer panel: no flyer yet → make it; made → matches; changed since → refresh.
 * Making the flyer starts from here, so the details are always checked first.
 */
import { Check, Pencil, Plus, X, MapPin, ListOrdered, Ticket, Users, FileText, Sparkles, Wand2, Download, AlertTriangle, ArrowLeft, Eye, ImagePlus } from 'lucide-vue-next'

definePageMeta({ layout: false })
useHead({ title: 'Prototype · Edit event | WeDance', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const { ev, flyer, flyerText, pictured, changes, reset } = useSketchEvent()
const img = sketchImg

const editing = ref<string | null>(null)
const toggle = (k: string) => (editing.value = editing.value === k ? null : k)
const saved = ref(false)
const error = ref<string | null>(null)
const fromHome = computed(() => route.query.flyer === '1' && !flyer.value.story)

function problems() {
  const e = ev.value
  if (!e.name.trim()) return 'Add a name.'
  if (!e.date.trim() || !e.start.trim()) return 'Add the date and start time.'
  if (!e.venue.trim()) return 'Add the venue.'
  return null
}
function save() {
  error.value = problems()
  if (error.value) return
  editing.value = null
  saved.value = true
  setTimeout(() => (saved.value = false), 2500)
}
// Making or refreshing the flyer saves first: the flyer is painted from saved details.
function toFlyer() {
  error.value = problems()
  if (error.value) return
  editing.value = null
  // A kept look means no style questions: straight to painting.
  return navigateTo(`/sketches/first-flyer/event?step=${flyer.value.look ? 'quick' : 'ask'}`)
}
const status = computed(() => !flyer.value.story ? 'none' : changes.value.length ? 'stale' : 'fresh')
const coverInput = ref<string | null>(null)
function addCover(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) coverInput.value = URL.createObjectURL(f) }
</script>

<template>
  <SketchBusinessShell active="events">
    <NuxtLink to="/sketches/first-flyer" class="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline">
      <ArrowLeft class="size-3.5" aria-hidden="true" /> Home
    </NuxtLink>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-display text-3xl font-bold">{{ ev.name || 'Untitled event' }}</h1>
        <p class="text-sm text-muted-foreground">{{ ev.repeats }} · next: {{ ev.date }} · <span class="font-bold text-wd-green-700">Published</span></p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline-pill" size="pill-sm"><Eye /> View page</Button>
        <Button variant="pill" size="pill-sm" @click="save"><Check /> {{ saved ? 'Saved' : 'Save' }}</Button>
      </div>
    </div>

    <div v-if="fromHome" class="mt-4 rounded-2xl bg-secondary/10 p-4 text-sm" role="status">
      <p class="font-bold">Check the details, then make the flyer.</p>
      <p class="text-muted-foreground">Whatever is here goes on the flyer word for word. The flyer panel shows exactly which words.</p>
    </div>
    <p v-if="error" class="mt-3 text-sm text-destructive" role="alert">{{ error }}</p>

    <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <!-- The event -->
      <div class="grid content-start gap-3">
        <div class="rounded-2xl border bg-card p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="flex items-center gap-1.5 text-sm font-bold"><FileText class="size-4 text-muted-foreground" aria-hidden="true" /> The event</p>
            <Button variant="ghost" size="sm" @click="toggle('event')"><template v-if="editing === 'event'"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
          </div>
          <div v-if="editing === 'event'" class="mt-3 grid gap-3 sm:grid-cols-2">
            <Field id="e-name" label="Name" class="sm:col-span-2"><Input v-model="ev.name" /></Field>
            <Field id="e-type" label="Type"><Select v-model="ev.type" :options="['Party', 'Workshop', 'Festival', 'Concert', 'Class']" /></Field>
            <Field id="e-repeats" label="Repeats"><Select v-model="ev.repeats" :options="['Once', 'Every Thursday', 'Every second Thursday', 'Monthly']" /></Field>
            <Field id="e-host" label="Run by" class="sm:col-span-2"><Input v-model="ev.host" /></Field>
            <Field id="e-desc" label="Description" optional class="sm:col-span-2" hint="On the event page, not on the flyer."><Textarea v-model="ev.description" :rows="3" /></Field>
          </div>
          <div v-else class="mt-1 text-sm">
            <p>{{ ev.type }} · {{ ev.repeats }} · run by {{ ev.host }}</p>
            <p class="mt-1 text-muted-foreground">{{ ev.description }}</p>
          </div>
        </div>

        <div class="rounded-2xl border bg-card p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="flex items-center gap-1.5 text-sm font-bold"><MapPin class="size-4 text-muted-foreground" aria-hidden="true" /> When and where</p>
            <Button variant="ghost" size="sm" @click="toggle('when')"><template v-if="editing === 'when'"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
          </div>
          <div v-if="editing === 'when'" class="mt-3 grid gap-3 sm:grid-cols-2">
            <Field id="d-date" label="Date"><Input v-model="ev.date" /></Field>
            <div class="grid grid-cols-2 gap-3">
              <Field id="d-start" label="Starts"><Input v-model="ev.start" /></Field>
              <Field id="d-end" label="Ends"><Input v-model="ev.end" /></Field>
            </div>
            <Field id="d-venue" label="Venue"><Input v-model="ev.venue" /></Field>
            <Field id="d-address" label="Address"><Input v-model="ev.address" /></Field>
          </div>
          <p v-else class="mt-1 text-sm">{{ ev.date }} · {{ ev.start }}–{{ ev.end }}<br><span class="text-muted-foreground">{{ ev.venue }} · {{ ev.address }}</span></p>
        </div>

        <div class="rounded-2xl border bg-card p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="flex items-center gap-1.5 text-sm font-bold"><ListOrdered class="size-4 text-muted-foreground" aria-hidden="true" /> Agenda</p>
            <Button variant="ghost" size="sm" @click="toggle('agenda')"><template v-if="editing === 'agenda'"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
          </div>
          <div v-if="editing === 'agenda'" class="mt-3 grid gap-2">
            <div v-for="(a, i) in ev.agenda" :key="i" class="flex gap-2">
              <Input v-model="a.time" class="w-20" :aria-label="`Time ${i + 1}`" />
              <Input v-model="a.what" class="flex-1" :aria-label="`What happens ${i + 1}`" />
              <Button variant="ghost" size="icon-sm" :aria-label="`Remove line ${i + 1}`" @click="ev.agenda.splice(i, 1)"><X /></Button>
            </div>
            <Button variant="ghost" size="sm" class="justify-self-start" @click="ev.agenda.push({ time: '', what: '' })"><Plus /> Add a line</Button>
          </div>
          <ul v-else class="mt-1 grid gap-0.5 text-sm">
            <li v-for="a in ev.agenda" :key="a.time + a.what"><span class="font-bold tabular-nums">{{ a.time }}</span> {{ a.what }}</li>
          </ul>
          <label class="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Checkbox v-model="ev.showAgenda" /> Put the agenda on the flyer</label>
        </div>

        <div class="rounded-2xl border bg-card p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="flex items-center gap-1.5 text-sm font-bold"><Ticket class="size-4 text-muted-foreground" aria-hidden="true" /> Entry and tickets</p>
            <Button variant="ghost" size="sm" @click="toggle('entry')"><template v-if="editing === 'entry'"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
          </div>
          <div v-if="editing === 'entry'" class="mt-3 grid gap-2">
            <div v-for="(_, i) in ev.entry" :key="i" class="flex gap-2">
              <Input v-model="ev.entry[i]" class="flex-1" :aria-label="`Price line ${i + 1}`" />
              <Button variant="ghost" size="icon-sm" :aria-label="`Remove price line ${i + 1}`" @click="ev.entry.splice(i, 1)"><X /></Button>
            </div>
            <Button variant="ghost" size="sm" class="justify-self-start" @click="ev.entry.push('')"><Plus /> Add a line</Button>
            <Field id="e-ticket" label="Ticket link" optional class="mt-2" hint="For Tickettailor, use the checkout link so people land on the ticket list.">
              <Input v-model="ev.ticketUrl" placeholder="https://www.tickettailor.com/checkout/…" />
            </Field>
          </div>
          <div v-else class="mt-1 text-sm">
            <p>{{ ev.entry.filter(Boolean).join(' · ') || 'No price set' }}</p>
            <p class="text-xs text-muted-foreground">{{ ev.ticketUrl ? 'Tickets: ' + ev.ticketUrl : 'Pay at the door · no ticket link' }}</p>
          </div>
        </div>

        <div class="rounded-2xl border bg-card p-4">
          <Field id="d-styles" label="The music">
            <DanceStylePicker v-model="ev.styles" />
          </Field>
        </div>

        <div class="rounded-2xl border bg-card p-4">
          <p class="flex items-center gap-1.5 text-sm font-bold"><Users class="size-4 text-muted-foreground" aria-hidden="true" /> Line-up</p>
          <p class="text-xs text-muted-foreground">Everyone is listed on the event page and named on the flyer. Pick the photo for the flyer, or “Name only”.</p>
          <SketchLineupPicker v-model="ev.lineup" :catalogue="SKETCH_ARTISTS" :img="img" class="mt-3" />
        </div>

        <div class="rounded-2xl border bg-card p-4">
          <p class="text-sm font-bold">Cover photo <span class="font-normal text-muted-foreground">(optional)</span></p>
          <p class="text-xs text-muted-foreground">The picture on the event page and in search. Your flyer can be the cover.</p>
          <div class="mt-2 flex items-center gap-3">
            <img v-if="coverInput || flyer.story" :src="coverInput || img(flyer.story!, 200)" alt="Cover" class="h-24 rounded-lg border">
            <label class="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-center text-[11px] text-muted-foreground has-[:focus-visible]:shadow-wd-focus">
              <ImagePlus class="size-4" aria-hidden="true" /> Upload
              <input type="file" accept="image/*" class="sr-only" @change="addCover">
            </label>
            <span v-if="flyer.story && !coverInput" class="text-xs text-muted-foreground">Using your flyer</span>
          </div>
        </div>
      </div>

      <!-- The flyer panel -->
      <aside class="lg:sticky lg:top-6 lg:self-start" aria-label="Flyer">
        <div class="rounded-2xl border bg-card p-4 shadow-wd-card" :class="fromHome ? 'border-2 border-primary/40' : ''">
          <div class="flex items-center justify-between">
            <p class="text-xs font-bold uppercase tracking-wider text-secondary">Flyer</p>
            <AdminStatus v-if="status === 'fresh'" tone="success">Up to date</AdminStatus>
            <AdminStatus v-else-if="status === 'stale'" tone="warning">Out of date</AdminStatus>
            <AdminStatus v-else tone="neutral">None yet</AdminStatus>
          </div>

          <!-- None yet -->
          <template v-if="status === 'none'">
            <div class="mx-auto mt-3 flex aspect-[9/16] w-32 items-center justify-center rounded-xl border-2 border-dashed border-input text-center text-xs text-muted-foreground">Instagram story<br>1080×1920</div>
            <Button variant="cta" class="mt-4 w-full" @click="toFlyer"><Sparkles /> Make the flyer</Button>
            <p class="mt-1.5 text-center text-xs text-muted-foreground">About a minute. Uses the details on this page.</p>
          </template>

          <!-- Made -->
          <template v-else>
            <img :src="img(flyer.story!, 400)" alt="Current flyer" class="mx-auto mt-3 w-40 rounded-xl border" :class="status === 'stale' ? 'opacity-60' : ''">
            <p class="mt-1.5 text-center text-xs text-muted-foreground">{{ flyer.look }} look</p>
            <div v-if="status === 'stale'" class="mt-3 rounded-xl bg-warning/10 p-3 text-xs">
              <p class="flex items-center gap-1.5 font-bold"><AlertTriangle class="size-3.5" aria-hidden="true" /> You changed the details since</p>
              <ul class="mt-2 grid gap-1.5">
                <li v-for="(c, i) in changes" :key="i" class="leading-snug">
                  <span v-if="c.was" class="block text-muted-foreground line-through">{{ c.was }}</span>
                  <span v-if="c.now" class="block font-bold">{{ c.now }}</span>
                </li>
              </ul>
            </div>
            <Button v-if="status === 'stale'" variant="cta" class="mt-3 w-full" @click="toFlyer"><Wand2 /> Refresh the flyer</Button>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline-pill" size="pill-sm"><Download /> Download</Button>
              <Button variant="ghost" size="sm" as-child><NuxtLink to="/sketches/first-flyer/event?step=result">Change it</NuxtLink></Button>
            </div>
          </template>

          <details class="mt-4 border-t pt-3" :open="status !== 'fresh'">
            <summary class="cursor-pointer text-xs font-bold">On the flyer</summary>
            <ul class="mt-2 grid gap-1 text-xs">
              <li v-for="t in flyerText" :key="t" class="leading-snug">{{ t }}</li>
            </ul>
            <p class="mt-2 text-xs text-muted-foreground">Pictured: {{ pictured.length ? pictured.join(', ') : 'nobody (names only)' }}</p>
            <p v-if="pictured.length > 2" class="mt-1 text-xs font-bold text-wd-red-800">{{ pictured.length }} faces is a lot for a story. Two read best.</p>
          </details>
        </div>
        <button type="button" class="mt-3 text-xs text-muted-foreground hover:underline" @click="reset(); editing = null">Reset the prototype</button>
      </aside>
    </div>
  </SketchBusinessShell>
</template>

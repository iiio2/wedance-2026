<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const day = ref('fri')

const schedule: Record<string, { time: string, title: string, room: string }[]> = {
  fri: [
    { time: '19:00', title: 'Welcome rueda', room: 'Main hall' },
    { time: '22:00', title: 'Opening party — DJ Alösha', room: 'Main hall' },
  ],
  sat: [
    { time: '11:00', title: 'Cuban salsa, intermediate — Lisandra', room: 'Studio 1' },
    { time: '13:00', title: 'Rumba guaguancó — Osmel', room: 'Studio 2' },
    { time: '23:00', title: 'Charanga Habanera live', room: 'Main hall' },
  ],
  sun: [
    { time: '12:00', title: 'Son montuno — Silvio', room: 'Studio 1' },
    { time: '17:00', title: 'Closing social', room: 'Terrace' },
  ],
}

const basicCode = `<Tabs default-value="about">
  <TabsList>
    <TabsTrigger value="about">About</TabsTrigger>
    <TabsTrigger value="classes">Classes</TabsTrigger>
    <TabsTrigger value="reviews">Reviews</TabsTrigger>
  </TabsList>
  <TabsContent value="about">…</TabsContent>
  <TabsContent value="classes">…</TabsContent>
  <TabsContent value="reviews">…</TabsContent>
</Tabs>`

const controlledCode = `<script setup lang="ts">
const day = ref('fri')
<\/script>

<template>
  <Tabs v-model="day">
    <TabsList class="w-full grid grid-cols-3">
      <TabsTrigger value="fri">Fri</TabsTrigger>
      <TabsTrigger value="sat">Sat</TabsTrigger>
      <TabsTrigger value="sun">Sun</TabsTrigger>
    </TabsList>
    <TabsContent v-for="(slots, d) in schedule" :key="d" :value="d">
      <!-- the day's sessions -->
    </TabsContent>
  </Tabs>
</template>`

const disabledCode = `<TabsTrigger value="videos" disabled>Videos</TabsTrigger>`

const propRows = [
  { name: 'modelValue / v-model', type: 'string | number', description: 'Tabs (root). The active tab’s value, controlled.' },
  { name: 'defaultValue', type: 'string | number', description: 'Tabs (root). Initial tab when uncontrolled.' },
  { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'Tabs (root). Sets arrow-key direction and aria-orientation. TabsList styles are horizontal — add flex-col yourself for vertical.' },
  { name: 'activationMode', type: "'automatic' | 'manual'", default: "'automatic'", description: 'Tabs (root). Automatic switches on arrow focus; manual waits for Enter/Space. Use manual if a panel is slow to render.' },
  { name: 'value', type: 'string | number', description: 'TabsTrigger, TabsContent. Required. Pairs a trigger with its panel.' },
  { name: 'disabled', type: 'boolean', default: 'false', description: 'TabsTrigger. Greys out (opacity-50) and skips it in keyboard order.' },
  { name: 'forceMount', type: 'boolean', description: 'TabsContent. Keep the panel in the DOM when hidden (e.g. to preserve a form’s state).' },
  { name: 'loop', type: 'boolean', default: 'true', description: 'TabsList. Arrow keys wrap from the last tab to the first.' },
  { name: 'class', type: 'HTMLAttributes["class"]', description: 'TabsList, TabsTrigger, TabsContent. Merged with cn().' },
]

const a11y = [
  'reka-ui renders the WAI-ARIA tabs pattern: <code>role="tablist"</code>, <code>role="tab"</code> with <code>aria-selected</code> and <code>aria-controls</code>, and <code>role="tabpanel"</code> labelled by its tab.',
  'Keyboard: <kbd>Tab</kbd> enters the list on the active tab, <kbd>←</kbd>/<kbd>→</kbd> move between tabs, <kbd>Home</kbd>/<kbd>End</kbd> jump to the ends. <kbd>Tab</kbd> again moves into the panel.',
  'Tab labels must be text, not icons alone. If a label truncates at 375px (TabsTrigger truncates long labels), shorten it — “Sat” not “Saturday 24 May”.',
  'Tabs hide content. Don’t use them for content people need to compare side by side, or for steps that must happen in order — use a stepper or the page itself.',
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Tabs"
    status="beta"
    lead="Switch between related views of the same thing — a teacher’s about, classes and reviews; a festival’s days — without leaving the page."
  >
    <DesignSection id="demo" title="Demo">
      <DesignExample :code="basicCode">
        <Tabs default-value="about" class="w-full max-w-lg">
          <TabsList>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>
          <TabsContent value="about">
            <p class="text-sm text-muted-foreground p-4">
              Lisandra grew up dancing casino in Havana and has taught Cuban salsa in Munich since 2015. Her classes are
              playful, musical and big on connection.
            </p>
          </TabsContent>
          <TabsContent value="classes">
            <ul class="text-sm text-muted-foreground p-4 space-y-1.5">
              <li><strong class="text-foreground">Mon 19:00</strong> — Cuban salsa, beginners</li>
              <li><strong class="text-foreground">Wed 20:30</strong> — Lady style, open level</li>
            </ul>
          </TabsContent>
          <TabsContent value="reviews">
            <p class="text-sm text-muted-foreground p-4">“Six weeks in and I danced my first full rueda.” — Barbara</p>
          </TabsContent>
        </Tabs>
      </DesignExample>
    </DesignSection>

    <DesignSection id="controlled" title="Controlled, full width" lead="Bind v-model when the active tab matters elsewhere (URL, analytics). Stretch the list with grid on phones so every target is wide.">
      <DesignExample :code="controlledCode">
        <Tabs v-model="day" class="w-full max-w-lg">
          <TabsList class="w-full grid grid-cols-3">
            <TabsTrigger value="fri">Fri</TabsTrigger>
            <TabsTrigger value="sat">Sat</TabsTrigger>
            <TabsTrigger value="sun">Sun</TabsTrigger>
          </TabsList>
          <TabsContent v-for="(slots, d) in schedule" :key="d" :value="d">
            <ul class="divide-y divide-border rounded-xl border border-border bg-card">
              <li v-for="s in slots" :key="s.time" class="flex gap-4 px-4 py-3 text-sm">
                <span class="font-mono font-bold text-secondary w-12 shrink-0">{{ s.time }}</span>
                <span class="min-w-0">
                  <span class="block font-bold">{{ s.title }}</span>
                  <span class="block text-muted-foreground">{{ s.room }}</span>
                </span>
              </li>
            </ul>
          </TabsContent>
        </Tabs>
        <p class="w-full text-xs text-muted-foreground">Active: <code class="font-mono">{{ day }}</code></p>
      </DesignExample>
    </DesignSection>

    <DesignSection id="states" title="States" lead="Active tabs lift onto the background with a soft shadow. Disabled tabs fade and are skipped by the keyboard.">
      <DesignExample :code="disabledCode">
        <Tabs default-value="photos">
          <TabsList>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="videos" disabled>Videos</TabsTrigger>
          </TabsList>
        </Tabs>
      </DesignExample>
    </DesignSection>

    <DesignSection id="props" title="Props" lead="Parts wrap reka-ui Tabs; their props pass straight through.">
      <DesignProps :rows="propRows" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont
        do-text="Two to five short, parallel labels for views of the same thing."
        dont-text="Use tabs as site navigation or crowd in so many that they scroll off a phone screen."
      >
        <template #do>
          <Tabs default-value="a">
            <TabsList>
              <TabsTrigger value="a">About</TabsTrigger>
              <TabsTrigger value="b">Classes</TabsTrigger>
              <TabsTrigger value="c">Reviews</TabsTrigger>
            </TabsList>
          </Tabs>
        </template>
        <template #dont>
          <Tabs default-value="a" class="max-w-full overflow-hidden">
            <TabsList class="max-w-full justify-start overflow-hidden">
              <TabsTrigger value="a">Home</TabsTrigger>
              <TabsTrigger value="b">Events</TabsTrigger>
              <TabsTrigger value="c">Festivals</TabsTrigger>
              <TabsTrigger value="d">Teachers</TabsTrigger>
              <TabsTrigger value="e">My account</TabsTrigger>
            </TabsList>
          </Tabs>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>

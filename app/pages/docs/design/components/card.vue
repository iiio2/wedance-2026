<script setup lang="ts">
import { CalendarDays, MapPin } from 'lucide-vue-next'

definePageMeta({ layout: 'docs' })

const basicCode = `<Card>
  <CardHeader>
    <CardTitle>Salsa Weekender Munich</CardTitle>
    <CardDescription>3 days · 14 workshops · 3 parties</CardDescription>
  </CardHeader>
  <CardContent>
    <p class="text-sm text-muted-foreground">
      Cuban salsa, rumba and son with teachers from Havana and Berlin.
    </p>
  </CardContent>
  <CardFooter class="justify-end gap-2">
    <Button variant="outline" size="sm">Details</Button>
    <Button size="sm">Add to plan</Button>
  </CardFooter>
</Card>`

const brandCode = `<Card class="rounded-2xl overflow-hidden">
  <img src="/alosha-charanga.jpg" alt="Singer with a microphone on a crowded stage" class="h-40 w-full object-cover" />
  <CardHeader class="p-5">
    <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">Concert · Sat 23 May</span>
    <CardTitle class="font-display font-bold text-2xl">Charanga Habanera</CardTitle>
    <CardDescription class="flex items-center gap-1.5">
      <MapPin class="w-4 h-4" aria-hidden="true" /> La Rumba, Munich
    </CardDescription>
  </CardHeader>
  <CardContent class="px-5 pb-5 flex flex-wrap gap-1.5">
    <Badge variant="outline">Timba</Badge>
    <Badge variant="outline">Live band</Badge>
  </CardContent>
</Card>`

const parts = [
  { name: 'Card', el: 'div', classes: 'rounded-lg border bg-card text-card-foreground shadow-sm', role: 'The surface. White on cream, hairline border.' },
  { name: 'CardHeader', el: 'div', classes: 'flex flex-col gap-y-1.5 p-6', role: 'Groups title and description.' },
  { name: 'CardTitle', el: 'h3', classes: 'text-2xl font-semibold leading-none tracking-tight', role: 'The card’s heading — an h3.' },
  { name: 'CardDescription', el: 'p', classes: 'text-sm text-muted-foreground', role: 'One line of supporting text.' },
  { name: 'CardContent', el: 'div', classes: 'p-6 pt-0', role: 'Body: text, tags, media, form fields.' },
  { name: 'CardFooter', el: 'div', classes: 'flex items-center p-6 pt-0', role: 'Actions, aligned with justify-*.' },
]

const propRows = [
  { name: 'class', type: 'HTMLAttributes["class"]', description: 'Every part accepts class, merged with cn(). This is the only prop — layout and look are set with classes.' },
  { name: 'default slot', type: 'slot', description: 'Every part renders its children. Compose the parts you need; all are optional.' },
]

const a11y = [
  '<code>CardTitle</code> renders an <code>&lt;h3&gt;</code>. Check the page outline: if cards sit directly under the page h1, override with a wrapper heading or keep the section h2 above them so levels don’t skip.',
  'When the whole card is a link, wrap it in one <code>&lt;NuxtLink&gt;</code> and keep a single focus stop. Don’t nest more buttons or links inside a linked card — split the actions into the footer instead.',
  'Images inside a card need real <code>alt</code> text (who or what is on stage), or <code>alt=""</code> if the title already says it all.',
  'Card is a plain container with no landmark role. A list of cards should sit in a <code>&lt;ul&gt;</code> / <code>&lt;li&gt;</code> so screen readers announce “list, 12 items”.',
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Card"
    status="beta"
    lead="A white surface that groups everything about one thing — an event, a festival, a teacher. Composed from six small parts."
  >
    <DesignSection id="demo" title="Demo">
      <DesignExample :code="basicCode" center>
        <Card class="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Salsa Weekender Munich</CardTitle>
            <CardDescription>3 days · 14 workshops · 3 parties</CardDescription>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">
              Cuban salsa, rumba and son with teachers from Havana and Berlin.
            </p>
          </CardContent>
          <CardFooter class="justify-end gap-2">
            <Button variant="outline" size="sm">Details</Button>
            <Button size="sm">Add to plan</Button>
          </CardFooter>
        </Card>
      </DesignExample>
    </DesignSection>

    <DesignSection id="anatomy" title="Anatomy" lead="Six parts, all optional. Use only what the content needs — a teacher tile may be just Card + CardContent.">
      <div tabindex="0" role="region" aria-label="Scrollable table" class="overflow-x-auto rounded-xl border border-border">
        <table class="w-full text-sm text-left">
          <thead class="bg-muted text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" class="px-4 py-2.5 font-bold">Part</th>
              <th scope="col" class="px-4 py-2.5 font-bold">Element</th>
              <th scope="col" class="px-4 py-2.5 font-bold">Base classes</th>
              <th scope="col" class="px-4 py-2.5 font-bold">Role</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in parts" :key="p.name" class="border-t border-border align-top">
              <td class="px-4 py-3 font-mono text-[13px] font-bold whitespace-nowrap">{{ p.name }}</td>
              <td class="px-4 py-3 font-mono text-[12px] text-secondary">{{ p.el }}</td>
              <td class="px-4 py-3 font-mono text-[12px] text-muted-foreground min-w-48">{{ p.classes }}</td>
              <td class="px-4 py-3 text-muted-foreground min-w-40">{{ p.role }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DesignSection>

    <DesignSection
      id="brand"
      title="WeDance event card"
      lead="The base card is shadcn-neutral. On product pages we round it to rounded-2xl, set the title in font-display and add the amber eyebrow. An event/festival card pattern is planned — until then, copy this."
    >
      <DesignExample :code="brandCode">
        <div class="grid sm:grid-cols-2 gap-4 w-full">
          <Card class="rounded-2xl overflow-hidden">
            <img src="/alosha-charanga.jpg" alt="Singer with a microphone on a crowded stage" class="h-40 w-full object-cover">
            <CardHeader class="p-5">
              <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">Concert · Sat 23 May</span>
              <CardTitle class="font-display font-bold text-2xl">Charanga Habanera</CardTitle>
              <CardDescription class="flex items-center gap-1.5">
                <MapPin class="w-4 h-4" aria-hidden="true" /> La Rumba, Munich
              </CardDescription>
            </CardHeader>
            <CardContent class="px-5 pb-5 flex flex-wrap gap-1.5">
              <Badge variant="outline">Timba</Badge>
              <Badge variant="outline">Live band</Badge>
            </CardContent>
          </Card>
          <Card class="rounded-2xl overflow-hidden">
            <img src="/alosha-dj.jpg" alt="DJ smiling behind the decks" class="h-40 w-full object-cover">
            <CardHeader class="p-5">
              <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">Social · Every Thursday</span>
              <CardTitle class="font-display font-bold text-2xl">Thursday Latin Social</CardTitle>
              <CardDescription class="flex items-center gap-1.5">
                <CalendarDays class="w-4 h-4" aria-hidden="true" /> 21:00 – 01:00 · Munich
              </CardDescription>
            </CardHeader>
            <CardContent class="px-5 pb-5 flex flex-wrap gap-1.5">
              <Badge variant="outline">Salsa</Badge>
              <Badge variant="outline">Bachata</Badge>
              <Badge variant="outline">Merengue</Badge>
            </CardContent>
          </Card>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="propRows" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont
        do-text="One card, one thing. A festival card is about one festival; its actions sit in the footer."
        dont-text="Cards inside cards. Nesting surfaces doubles borders and padding and muddies what belongs to what."
      >
        <template #do>
          <Card class="w-full max-w-56 rounded-2xl">
            <CardHeader class="p-4">
              <CardTitle class="font-display font-bold text-lg">Cuba Dance Days</CardTitle>
              <CardDescription>Berlin · June</CardDescription>
            </CardHeader>
            <CardFooter class="px-4 pb-4">
              <Button size="sm" class="w-full">Add to plan</Button>
            </CardFooter>
          </Card>
        </template>
        <template #dont>
          <Card class="w-full max-w-56 rounded-2xl p-3">
            <Card class="p-3">
              <Card class="p-3">
                <span class="text-sm font-bold">Cuba Dance Days</span>
              </Card>
            </Card>
          </Card>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>

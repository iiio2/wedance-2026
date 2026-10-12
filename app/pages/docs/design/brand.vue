<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const brandCode = `<Brand />               <!-- full logo, links to / -->
<Brand variant="mark" /> <!-- flame only: tight spaces, avatars, app icons -->`

const voice = [
  { trait: 'A warm host', body: 'We talk like the person at the door who knows everyone — welcoming, a little playful, never salesy. The product is “your host”, not a platform.' },
  { trait: 'Short', body: 'One idea per sentence. Fragments are fine. “Every dance. Every teacher. Every city.”' },
  { trait: 'Second person', body: '“Your next dance”, “Where you’re dancing.” Speak to one dancer, not to “users”.' },
  { trait: 'Honest', body: 'No fake numbers, no fake friends, no fake urgency. If something is empty, we say so — and say “yet”.' },
]

const examples = [
  { line: 'From your first night to your best year.', where: 'Homepage hero' },
  { line: 'Every face — real.', where: 'Homepage' },
  { line: 'See who’s going before you book.', where: 'Homepage, /festivals' },
  { line: 'Pick your next one. Plan the year.', where: '/festivals' },
  { line: 'No partner, no experience, no commitment. See what sticks.', where: 'City taster' },
  { line: 'List your event for free. Ticket it on us.', where: 'Organizer CTA' },
  { line: 'Going? → Going!', where: 'Every pick button' },
]

const wordRules = [
  { use: 'dancers, the scene, the locals', avoid: 'users, customers, members' },
  { use: 'Going? / Going!', avoid: 'Add to cart, RSVP, Subscribe' },
  { use: 'night, social, class, festival', avoid: 'event instance, listing, session' },
  { use: 'not listed here yet', avoid: 'no results found, no data' },
  { use: 'Alösha (with ö)', avoid: 'Alex, Alosha, Alyosha' },
]

const photoRules = [
  'Real people at real nights — dancers, teachers, hosts. Never stock photography, never AI-generated people, never avatar generators.',
  'Show the floor, not the pose: partner work, laughter, the band, sweat. Mid-movement beats posed portraits.',
  'Cities without our own photos use a Wikipedia landmark with CC credit — never a stand-in “people dancing” image.',
  'Credit photographers and licences on the image. Get consent before featuring someone large on a page.',
  'Warm light suits the palette; avoid cold blue edits and heavy filters. Don’t overlay brand colour on faces.',
  'Captions are the host speaking: “— Alösha · Charanga Habanera, München”, in Playfair italic.',
]
</script>

<template>
  <DesignPage
    eyebrow="Brand"
    title="Logo, voice & imagery"
    status="beta"
    lead="WeDance looks like an old travel poster and talks like a good host. The flame and wordmark are the same ones dancers already know from our t-shirts, Instagram and Telegram — keep them recognisable."
  >
    <DesignSection id="logo" title="Logo" lead="Two assets in /public, rendered by the Brand component. Don’t redraw or swap them without updating merch and social channels too.">
      <div class="grid sm:grid-cols-2 gap-4">
        <figure class="rounded-2xl border border-border bg-card overflow-hidden">
          <div class="flex items-center justify-center p-10 bg-white">
            <img src="/logo.svg" alt="WeDance" class="h-12 w-auto">
          </div>
          <figcaption class="p-4 text-sm border-t border-border">
            <strong class="text-foreground">Full logo</strong> — <code class="font-mono text-[12px]">/logo.svg</code>
            <p class="text-muted-foreground mt-1">Flame + wordmark. Default in the site header (<code>h-6 sm:h-7</code>), footers, print and anywhere there is width.</p>
          </figcaption>
        </figure>
        <figure class="rounded-2xl border border-border bg-card overflow-hidden">
          <div class="flex items-center justify-center gap-6 p-10 bg-white">
            <img src="/icon.svg" alt="WeDance" class="h-16 w-16">
            <img src="/icon.svg" alt="" class="h-8 w-8">
            <img src="/icon.svg" alt="" class="h-4 w-4">
          </div>
          <figcaption class="p-4 text-sm border-t border-border">
            <strong class="text-foreground">Mark</strong> — <code class="font-mono text-[12px]">/icon.svg</code>
            <p class="text-muted-foreground mt-1">The flame alone. Favicon, app icon, avatars, tight headers. Square.</p>
          </figcaption>
        </figure>
      </div>

      <DesignExample title="Component" :code="brandCode" class="mt-4">
        <div class="flex flex-wrap items-center gap-8">
          <Brand to="/docs/design/brand" />
          <Brand to="/docs/design/brand" variant="mark" />
        </div>
      </DesignExample>

      <div class="grid sm:grid-cols-3 gap-4 mt-4 text-sm">
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Clear space</h3>
          <div class="mt-3 flex justify-center">
            <div class="relative p-[18px] outline-1 outline-dashed outline-secondary/50 bg-white rounded">
              <img src="/icon.svg" alt="" class="h-9 w-9">
            </div>
          </div>
          <p class="text-muted-foreground mt-3">Keep empty space around the logo of at least half the flame’s height on every side. Nothing — text, edges, photos — enters that box.</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Minimum size</h3>
          <div class="mt-3 flex items-end justify-center gap-4">
            <img src="/logo.svg" alt="" class="h-6 w-auto">
            <img src="/icon.svg" alt="" class="h-4 w-4">
          </div>
          <p class="text-muted-foreground mt-3">Full logo at least <strong class="text-foreground">24px tall</strong> on screen (the header size) — below that the wordmark blurs; switch to the mark. Mark at least <strong class="text-foreground">16px</strong>.</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Backgrounds</h3>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <div class="flex items-center justify-center h-14 rounded-lg bg-white border border-border"><img src="/logo.svg" alt="" class="h-5 w-auto"></div>
            <div class="flex items-center justify-center h-14 rounded-lg bg-background border border-border"><img src="/logo.svg" alt="" class="h-5 w-auto"></div>
          </div>
          <p class="text-muted-foreground mt-3">White or cream. On photos or dark surfaces use the mark on a white/cream pill — there is no light-on-dark wordmark yet.</p>
        </div>
      </div>

      <h3 class="font-display font-bold text-xl mt-8 mb-3">Don’t</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <figure class="rounded-2xl border border-border bg-card overflow-hidden">
          <div class="flex items-center justify-center h-24 bg-white border-b-4 border-destructive"><img src="/logo.svg" alt="" class="h-6 w-auto scale-x-150 scale-y-75"></div>
          <figcaption class="p-3 text-muted-foreground">Stretch or squash it.</figcaption>
        </figure>
        <figure class="rounded-2xl border border-border bg-card overflow-hidden">
          <div class="flex items-center justify-center h-24 bg-white border-b-4 border-destructive"><img src="/logo.svg" alt="" class="h-6 w-auto hue-rotate-180"></div>
          <figcaption class="p-3 text-muted-foreground">Recolour the flame or wordmark.</figcaption>
        </figure>
        <figure class="rounded-2xl border border-border bg-card overflow-hidden">
          <div class="flex items-center justify-center h-24 bg-white border-b-4 border-destructive"><img src="/logo.svg" alt="" class="h-6 w-auto -rotate-12"></div>
          <figcaption class="p-3 text-muted-foreground">Rotate, outline or add effects.</figcaption>
        </figure>
        <figure class="rounded-2xl border border-border bg-card overflow-hidden">
          <div class="relative flex items-center justify-center h-24 overflow-hidden border-b-4 border-destructive">
            <img src="/alosha-dj.jpg" alt="" class="absolute inset-0 w-full h-full object-cover">
            <img src="/logo.svg" alt="" class="relative h-6 w-auto">
          </div>
          <figcaption class="p-3 text-muted-foreground">Place it straight on a busy photo.</figcaption>
        </figure>
      </div>
    </DesignSection>

    <DesignSection id="naming" title="Names" lead="How we write the names people see.">
      <div class="grid sm:grid-cols-2 gap-4 text-sm">
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">WeDance</h3>
          <p class="text-muted-foreground mt-1">One word, capital W and D. Not “We Dance”, “Wedance” or “WEDANCE” (except inside an all-caps label).</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Alösha — with ö</h3>
          <p class="text-muted-foreground mt-1">The founder’s public name — host captions, teacher credits, bylines, the founder letter — is always <strong class="text-foreground">Alösha</strong>, with the umlaut. Never “Alosha” and never “Alex” in public copy; “Alex” is for internal and legal contexts only.</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="voice" title="Tone of voice">
      <div class="grid sm:grid-cols-2 gap-4">
        <div v-for="v in voice" :key="v.trait" class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">{{ v.trait }}</h3>
          <p class="text-sm text-muted-foreground mt-1">{{ v.body }}</p>
        </div>
      </div>

      <h3 class="font-display font-bold text-xl mt-8 mb-3">From the site</h3>
      <ul class="rounded-2xl border border-border bg-card divide-y divide-border">
        <li v-for="e in examples" :key="e.line" class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 px-5 py-3">
          <span class="font-display text-lg text-foreground">{{ e.line }}</span>
          <span class="text-xs text-muted-foreground font-sans shrink-0">{{ e.where }}</span>
        </li>
      </ul>

      <h3 class="font-display font-bold text-xl mt-8 mb-3">Words</h3>
      <div tabindex="0" role="region" aria-label="Scrollable table" class="overflow-x-auto rounded-xl border border-border">
        <table class="w-full text-sm text-left">
          <thead class="bg-muted text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" class="px-4 py-2.5 font-bold">Say</th>
              <th scope="col" class="px-4 py-2.5 font-bold">Instead of</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="w in wordRules" :key="w.use" class="border-t border-border">
              <td class="px-4 py-3 font-bold text-foreground">{{ w.use }}</td>
              <td class="px-4 py-3 text-muted-foreground line-through decoration-destructive/50">{{ w.avoid }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-6">
        <DesignDoDont do-text="speak to one dancer, warmly, in a few words." dont-text="platform language and hype.">
          <template #do>
            <p class="font-display text-xl text-center">Your next dance is closer than you <span class="text-primary">think.</span></p>
          </template>
          <template #dont>
            <p class="font-sans text-sm text-center text-muted-foreground">Join 12,000+ users on Europe’s #1 dance event platform today!</p>
          </template>
        </DesignDoDont>
      </div>
    </DesignSection>

    <DesignSection id="photography" title="Photography">
      <div class="grid sm:grid-cols-[minmax(0,1fr)_14rem] gap-6 items-start">
        <ul class="space-y-2.5">
          <li v-for="r in photoRules" :key="r" class="text-sm text-muted-foreground flex gap-2">
            <span class="text-primary font-bold" aria-hidden="true">—</span><span>{{ r }}</span>
          </li>
        </ul>
        <figure class="relative rounded-2xl overflow-hidden border-4 border-background shadow-[8px_10px_0_-2px_var(--wd-red-600)]">
          <img src="/alosha-charanga.jpg" alt="Alösha on stage at the end of the Charanga Habanera Munich concert he hosted" class="w-full aspect-[4/5] object-cover object-[center_30%]">
          <figcaption class="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
            <div class="text-[9px] uppercase tracking-[0.3em] opacity-90 font-sans">Your host</div>
            <div class="font-display italic text-base">— Alösha · Charanga Habanera</div>
          </figcaption>
        </figure>
      </div>
    </DesignSection>

    <DesignSection id="foundations" title="Colour & type" lead="The rest of the brand lives in the foundations.">
      <div class="grid sm:grid-cols-2 gap-4">
        <NuxtLink to="/docs/design/foundations/colors" class="rounded-2xl border border-border bg-card p-5 hover:-translate-y-0.5 transition-transform">
          <div class="flex gap-1.5">
            <span class="size-7 rounded-full bg-wd-cream border border-border" />
            <span class="size-7 rounded-full bg-wd-brown-900" />
            <span class="size-7 rounded-full bg-wd-red-600" />
            <span class="size-7 rounded-full bg-wd-orange-500" />
            <span class="size-7 rounded-full bg-wd-amber-600" />
            <span class="size-7 rounded-full bg-wd-green-600" />
          </div>
          <h3 class="font-display font-bold text-lg mt-3">Colors →</h3>
          <p class="text-sm text-muted-foreground">Cream, warm browns, poster red-to-orange, and the tropical accents.</p>
        </NuxtLink>
        <NuxtLink to="/docs/design/foundations/typography" class="rounded-2xl border border-border bg-card p-5 hover:-translate-y-0.5 transition-transform">
          <div class="font-display text-3xl leading-none">Aa <em class="italic text-primary">Aa</em> <span class="font-sans text-2xl">Aa</span></div>
          <h3 class="font-display font-bold text-lg mt-3">Typography →</h3>
          <p class="text-sm text-muted-foreground">Playfair Display for the voice, system sans for the work.</p>
        </NuxtLink>
      </div>
    </DesignSection>
  </DesignPage>
</template>

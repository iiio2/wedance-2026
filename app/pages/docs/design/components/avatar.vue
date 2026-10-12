<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const teachers = [
  { name: 'Lisandra', src: '/people/lisandra.jpg', initials: 'L' },
  { name: 'Osmel', src: '/people/osmel.jpg', initials: 'O' },
  { name: 'Silvio', src: '/people/silvio.jpg', initials: 'S' },
  { name: 'Ivana', src: '/people/ivana.jpg', initials: 'I' },
]

const basicCode = `<Avatar class="text-secondary-foreground">
  <AvatarImage src="/people/lisandra.jpg" alt="Lisandra" />
  <AvatarFallback>L</AvatarFallback>
</Avatar>`

const fallbackCode = `<!-- text-secondary-foreground: cream initials on the amber fallback (see Accessibility) -->
<Avatar class="text-secondary-foreground">
  <AvatarImage :src="teacher.photo" :alt="teacher.name" />
  <AvatarFallback>AE</AvatarFallback>
</Avatar>`

const sizesCode = `<Avatar size="sm">…</Avatar>    <!-- 40px — lists, comments, attendee stacks -->
<Avatar size="base">…</Avatar>  <!-- 64px — teacher cards -->
<Avatar size="lg">…</Avatar>    <!-- 128px — profile header -->`

const shapeCode = `<!-- People are circles; venues and organisations are squares -->
<Avatar shape="square" class="text-secondary-foreground font-bold">
  <AvatarFallback>LR</AvatarFallback>
</Avatar>`

const stackCode = `<div class="flex -space-x-2">
  <Avatar v-for="t in going" :key="t.name" class="ring-2 ring-card text-secondary-foreground">
    <AvatarImage :src="t.src" :alt="t.name" />
    <AvatarFallback>{{ t.initials }}</AvatarFallback>
  </Avatar>
</div>`

const propRows = [
  { name: 'size', type: "'sm' | 'base' | 'lg'", default: "'sm'", description: 'Avatar. 40 / 64 / 128px. Fallback text scales with it (xs / 2xl / 5xl).' },
  { name: 'shape', type: "'circle' | 'square'", default: "'circle'", description: 'Avatar. Circle for people, square (rounded-md) for venues, schools and organisers.' },
  { name: 'class', type: 'HTMLAttributes["class"]', description: 'Avatar. Merged with cn() — use for rings in stacks or a custom background.' },
  { name: 'src', type: 'string', description: 'AvatarImage. Image URL. Shown only once it has loaded; until then (or on error) the fallback shows.' },
  { name: 'alt', type: 'string', description: 'AvatarImage. The person’s name, or "" when the name is printed right next to it.' },
  { name: 'delayMs', type: 'number', description: 'AvatarFallback. Wait before showing the fallback, to avoid an initials flash on fast connections.' },
]

const a11y = [
  'Give <code>AvatarImage</code> an <code>alt</code> with the person’s name. When the name is already printed next to the avatar, use <code>alt=""</code> so screen readers don’t read it twice.',
  'Fallback initials are read aloud as letters. If the avatar stands alone (an attendee stack), add an <code>aria-label</code> or visually hidden name on the wrapper — “Lisandra, Osmel and 12 others going”.',
  'Known issue: the default fallback is dark brown <code>text-foreground</code> on amber <code>bg-secondary</code> — about 2.5:1, below WCAG AA. Until the component default is fixed, add <code>class="text-secondary-foreground"</code> to <code>Avatar</code> wherever initials can show (cream on amber, ~5.4:1), as the examples on this page do.',
  'Avatars are not buttons. If tapping opens a profile, wrap the avatar <em>and</em> the name in one link.',
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Avatar"
    status="beta"
    lead="A face for a teacher, DJ or dancer — or a mark for a venue. Shows the photo when it loads, initials when it doesn’t."
  >
    <DesignSection id="demo" title="Demo">
      <DesignExample :code="basicCode" center>
        <div v-for="t in teachers" :key="t.name" class="flex items-center gap-3">
          <Avatar class="text-secondary-foreground">
            <AvatarImage :src="t.src" alt="" />
            <AvatarFallback>{{ t.initials }}</AvatarFallback>
          </Avatar>
          <span class="text-sm font-bold">{{ t.name }}</span>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="fallback" title="Fallback" lead="When there is no photo, or it fails to load, AvatarFallback shows. Use the first letter of the first and last name.">
      <DesignExample :code="fallbackCode" center>
        <Avatar class="text-secondary-foreground">
          <AvatarImage src="data:," alt="Alexei Emilia" />
          <AvatarFallback>AE</AvatarFallback>
        </Avatar>
        <Avatar class="text-secondary-foreground">
          <AvatarFallback>BK</AvatarFallback>
        </Avatar>
        <Avatar class="text-secondary-foreground">
          <AvatarFallback>WD</AvatarFallback>
        </Avatar>
        <span class="text-sm text-muted-foreground">Broken image → initials</span>
      </DesignExample>
    </DesignSection>

    <DesignSection id="sizes" title="Sizes" lead="Three sizes. sm is the default.">
      <DesignExample :code="sizesCode">
        <div class="flex flex-wrap items-end gap-6">
          <div class="text-center">
            <Avatar size="sm">
              <AvatarImage src="/people/osmel.jpg" alt="" />
              <AvatarFallback>O</AvatarFallback>
            </Avatar>
            <code class="block mt-2 font-mono text-[12px] text-muted-foreground">sm</code>
          </div>
          <div class="text-center">
            <Avatar size="base">
              <AvatarImage src="/people/osmel.jpg" alt="" />
              <AvatarFallback>O</AvatarFallback>
            </Avatar>
            <code class="block mt-2 font-mono text-[12px] text-muted-foreground">base</code>
          </div>
          <div class="text-center">
            <Avatar size="lg">
              <AvatarImage src="/people/osmel.jpg" alt="" />
              <AvatarFallback>O</AvatarFallback>
            </Avatar>
            <code class="block mt-2 font-mono text-[12px] text-muted-foreground">lg</code>
          </div>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="shape" title="Shape" lead="Circles for people. Squares for venues, schools and organisers, so the two never get confused in a list.">
      <DesignExample :code="shapeCode" center>
        <div class="flex items-center gap-3">
          <Avatar>
            <AvatarImage src="/people/silvio.jpg" alt="" />
            <AvatarFallback>S</AvatarFallback>
          </Avatar>
          <span class="text-sm"><strong>Silvio</strong> · teacher</span>
        </div>
        <div class="flex items-center gap-3">
          <Avatar shape="square" class="text-secondary-foreground font-bold">
            <AvatarFallback>LR</AvatarFallback>
          </Avatar>
          <span class="text-sm"><strong>La Rumba</strong> · venue</span>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="stack" title="Who’s going" lead="Overlap small avatars with a card-coloured ring to show attendees.">
      <DesignExample :code="stackCode">
        <div class="flex items-center gap-3" role="group" aria-label="Lisandra, Osmel, Silvio, Ivana and 12 others are going">
          <div class="flex -space-x-2" aria-hidden="true">
            <Avatar v-for="t in teachers" :key="t.name" class="ring-2 ring-card text-secondary-foreground">
              <AvatarImage :src="t.src" alt="" />
              <AvatarFallback>{{ t.initials }}</AvatarFallback>
            </Avatar>
            <Avatar class="ring-2 ring-card bg-muted">
              <AvatarFallback class="font-bold">+12</AvatarFallback>
            </Avatar>
          </div>
          <span class="text-sm text-muted-foreground" aria-hidden="true">16 going</span>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="propRows" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont
        do-text="Always pair an image with a fallback, so a slow or broken photo still shows who it is."
        dont-text="AvatarImage alone. If the photo fails you get an empty amber circle that says nothing."
      >
        <template #do>
          <Avatar size="base" class="text-secondary-foreground">
            <AvatarImage src="data:," alt="Ivan" />
            <AvatarFallback>I</AvatarFallback>
          </Avatar>
        </template>
        <template #dont>
          <Avatar size="base">
            <AvatarImage src="data:," alt="Ivan" />
          </Avatar>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>

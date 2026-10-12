<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const confirmOpen = ref(false)
const removed = ref(false)

function removeFromPlan() {
  removed.value = true
  confirmOpen.value = false
}

const basicCode = `<Dialog>
  <DialogTrigger as-child>
    <Button>Book a private lesson</Button>
  </DialogTrigger>
  <DialogContent class="max-w-[calc(100vw-2rem)] sm:max-w-md border-0 p-0 overflow-hidden rounded-2xl">
    <div class="h-1.5 bg-primary" />
    <div class="px-6 pb-6 pt-4">
      <DialogHeader class="text-left">
        <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">Teacher</span>
        <DialogTitle class="font-display font-bold text-2xl">Private lesson with Lisandra</DialogTitle>
        <DialogDescription>60 minutes, Cuban salsa, in central Munich.</DialogDescription>
      </DialogHeader>
      <DialogFooter class="mt-6 gap-2">
        <DialogClose as-child>
          <Button variant="outline">Not now</Button>
        </DialogClose>
        <Button>Send request</Button>
      </DialogFooter>
    </div>
  </DialogContent>
</Dialog>`

const controlledCode = `<script setup lang="ts">
const open = ref(false)
function removeFromPlan() {
  // …do the work, then close
  open.value = false
}
<\/script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="destructive">Remove from plan</Button>
    </DialogTrigger>
    <DialogContent class="max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-2xl">
      <DialogHeader>
        <DialogTitle>Remove Salsa Night?</DialogTitle>
        <DialogDescription>It disappears from your week. Friends you shared it with keep their copy.</DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2">
        <DialogClose as-child><Button variant="outline">Keep it</Button></DialogClose>
        <Button variant="destructive" @click="removeFromPlan">Remove</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>`

const longCode = `<Dialog>
  <DialogTrigger as-child>
    <Button variant="outline">Festival line-up</Button>
  </DialogTrigger>
  <!-- Scrolls the whole overlay — use for content taller than the viewport -->
  <DialogScrollContent class="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl">
    <DialogHeader>
      <DialogTitle>Line-up</DialogTitle>
    </DialogHeader>
    …
  </DialogScrollContent>
</Dialog>`

const lineup = [
  'Lisandra — Cuban salsa', 'Osmel — Rumba', 'Silvio — Son', 'Ivana — Lady style', 'Ivan — Timba',
  'Barbara — Afro-Cuban', 'Emilia — Bachata', 'Alexei — Rueda de Casino', 'Alösha — DJ set', 'Charanga Habanera — Live',
  'Workshop block A', 'Workshop block B', 'Pool party', 'Closing social',
]

const propRows = [
  { name: 'open', type: 'boolean', description: 'Dialog (root). Controlled open state — use with v-model:open. Forwarded to reka-ui DialogRoot.' },
  { name: 'defaultOpen', type: 'boolean', default: 'false', description: 'Dialog (root). Initial state when uncontrolled.' },
  { name: 'modal', type: 'boolean', default: 'true', description: 'Dialog (root). Traps focus and blocks the page behind. Leave on.' },
  { name: '@update:open', type: '(open: boolean) => void', description: 'Dialog (root). Fires on open and close, including Esc and overlay click.' },
  { name: 'as-child', type: 'boolean', default: 'false', description: 'DialogTrigger / DialogClose. Render your own Button instead of a bare <button>.' },
  { name: 'class', type: 'HTMLAttributes["class"]', description: 'DialogContent, DialogScrollContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription. Merged with cn().' },
  { name: '…reka attrs', type: 'DialogContentProps', description: 'DialogContent forwards attrs to reka-ui DialogContent, e.g. @escape-key-down, @interact-outside, @open-auto-focus.' },
]

const a11y = [
  'Every dialog needs a <code>DialogTitle</code>. reka-ui wires it to <code>aria-labelledby</code>; without it screen readers announce an unnamed dialog. Add <code>DialogDescription</code> for <code>aria-describedby</code> — or pass <code>:aria-describedby="undefined"</code> to <code>DialogContent</code> if there is genuinely nothing to describe.',
  'Focus moves into the dialog on open and returns to the trigger on close. Focus is trapped while open, and <kbd>Esc</kbd> closes it. Don’t override these.',
  'The built-in close (×) has an sr-only “Close” label. Still give a visible text button (“Not now”, “Keep it”) — the × is small on phones.',
  'Use <code>DialogTrigger as-child</code> with a real <code>&lt;Button&gt;</code>, so the trigger is a native button with <code>aria-expanded</code> and <code>aria-haspopup="dialog"</code>.',
  'Destructive confirmations: put the safe option first in the DOM and make it the default focus target, so a stray Enter doesn’t delete anything.',
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Dialog"
    status="beta"
    lead="A modal for one focused task — book a lesson, confirm a removal, sign up. It blocks the page, so use it only when the task can’t wait."
  >
    <DesignSection id="demo" title="Demo" lead="The standard WeDance modal: cream surface, red accent bar, amber eyebrow, Playfair title. DialogContent is full-bleed below 640px by default — cap it with max-w-[calc(100vw-2rem)] so it keeps a 16px gutter on phones.">
      <DesignExample :code="basicCode" center>
        <Dialog>
          <DialogTrigger as-child>
            <Button>Book a private lesson</Button>
          </DialogTrigger>
          <DialogContent class="max-w-[calc(100vw-2rem)] sm:max-w-md border-0 p-0 overflow-hidden rounded-2xl">
            <div class="h-1.5 bg-primary" />
            <div class="px-6 pb-6 pt-4">
              <DialogHeader class="text-left">
                <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">Teacher</span>
                <DialogTitle class="font-display font-bold text-2xl">Private lesson with Lisandra</DialogTitle>
                <DialogDescription>60 minutes, Cuban salsa, in central Munich.</DialogDescription>
              </DialogHeader>
              <DialogFooter class="mt-6 gap-2">
                <DialogClose as-child>
                  <Button variant="outline">Not now</Button>
                </DialogClose>
                <Button>Send request</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </DesignExample>
    </DesignSection>

    <DesignSection id="controlled" title="Controlled confirmation" lead="Bind v-model:open when your code needs to close the dialog after an action.">
      <DesignExample :code="controlledCode" center>
        <Dialog v-model:open="confirmOpen">
          <DialogTrigger as-child>
            <Button variant="destructive" :disabled="removed">Remove from plan</Button>
          </DialogTrigger>
          <DialogContent class="max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle>Remove Salsa Night?</DialogTitle>
              <DialogDescription>It disappears from your week. Friends you shared it with keep their copy.</DialogDescription>
            </DialogHeader>
            <DialogFooter class="gap-2">
              <DialogClose as-child>
                <Button variant="outline">Keep it</Button>
              </DialogClose>
              <Button variant="destructive" @click="removeFromPlan">Remove</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <span class="text-sm text-muted-foreground" aria-live="polite">
          {{ removed ? 'Removed (demo only — nothing was saved).' : 'Salsa Night is in your plan.' }}
          <button v-if="removed" type="button" class="font-bold text-primary hover:underline ml-1" @click="removed = false">Reset</button>
        </span>
      </DesignExample>
    </DesignSection>

    <DesignSection id="scroll" title="Long content" lead="DialogScrollContent scrolls the overlay instead of the panel — for line-ups, terms or anything taller than a phone screen.">
      <DesignExample :code="longCode" center>
        <Dialog>
          <DialogTrigger as-child>
            <Button variant="outline">Festival line-up</Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">Salsa Weekender Munich</span>
              <DialogTitle class="font-display font-bold text-2xl">Line-up</DialogTitle>
              <DialogDescription>Three days, fourteen sessions.</DialogDescription>
            </DialogHeader>
            <ul class="divide-y divide-border">
              <li v-for="l in lineup" :key="l" class="py-3 text-sm">{{ l }}</li>
            </ul>
          </DialogScrollContent>
        </Dialog>
      </DesignExample>
    </DesignSection>

    <DesignSection id="props" title="Props" lead="Dialog is a set of parts over reka-ui. The props that matter, by part:">
      <DesignProps :rows="propRows" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont
        do-text="Name the action in the buttons: “Remove” / “Keep it”. The dancer knows what happens without re-reading the title."
        dont-text="“OK” / “Cancel”. In a removal dialog, “Cancel” is ambiguous — cancel the removal, or cancel the event?"
      >
        <template #do>
          <Button variant="outline" size="sm">Keep it</Button>
          <Button variant="destructive" size="sm">Remove</Button>
        </template>
        <template #dont>
          <Button variant="outline" size="sm">Cancel</Button>
          <Button size="sm">OK</Button>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>

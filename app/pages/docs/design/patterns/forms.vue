<script setup lang="ts">
import * as v from 'valibot'
import { email, isoDate, optionalText, requiredText } from '#shared/validation'

definePageMeta({ layout: 'docs' })

// Demo schema — lives on this page only. Real forms put theirs in shared/validation/forms.ts.
const LessonSchema = v.object({
  name: requiredText('Name is required.'),
  email: email(),
  style: v.pipe(v.string(), v.nonEmpty('Choose a dance style.')),
  date: isoDate('Pick a date for the lesson.'),
  message: optionalText(500, 'Keep it under 500 characters.'),
  terms: v.literal(true, 'Accept the booking terms to continue.'),
})

const form = reactive({ name: '', email: '', style: '', date: '', message: '', terms: false })
const { errors, validate, reset, fieldAttrs } = useFormValidation(LessonSchema, form)
const sent = ref(false)

function submit() {
  sent.value = false
  const result = validate()
  if (!result.success) return
  // Docs demo: nothing is sent anywhere.
  sent.value = true
}

function clear() {
  Object.assign(form, { name: '', email: '', style: '', date: '', message: '', terms: false })
  reset()
  sent.value = false
}

const codeExample = `<script setup lang="ts">
const form = reactive({ name: '', email: '', style: '', date: '', message: '', terms: false })
const { errors, validate, fieldAttrs } = useFormValidation(LessonSchema, form)

function submit() {
  const result = validate()          // shows every error, focuses the first
  if (!result.success) return
  book(result.data)                  // trimmed, typed data
}
<\/script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <Field id="lesson-name" label="Your name" :error="errors.name">
      <Input v-model="form.name" autocomplete="name" v-bind="fieldAttrs('name', 'lesson-name-error')" />
    </Field>
    <Field id="lesson-email" label="Email" hint="The teacher replies here." :error="errors.email">
      <Input v-model="form.email" type="email" autocomplete="email" v-bind="fieldAttrs('email', 'lesson-email-error')" />
    </Field>
    <div class="grid gap-5 sm:grid-cols-2">
      <Field id="lesson-style" label="Style" :error="errors.style">
        <Select v-model="form.style" :options="styles" placeholder="Pick a style" v-bind="fieldAttrs('style', 'lesson-style-error')" />
      </Field>
      <Field id="lesson-date" label="Preferred date" :error="errors.date">
        <Input v-model="form.date" type="date" v-bind="fieldAttrs('date', 'lesson-date-error')" />
      </Field>
    </div>
    <Field id="lesson-message" label="What would you like to work on?" optional :error="errors.message">
      <Textarea v-model="form.message" :rows="3" v-bind="fieldAttrs('message', 'lesson-message-error')" />
    </Field>
    <Field id="lesson-terms" :error="errors.terms">
      <Checkbox v-model="form.terms" v-bind="fieldAttrs('terms', 'lesson-terms-error')">I accept the booking terms</Checkbox>
    </Field>
    <Button type="submit" size="lg" class="w-full sm:w-auto">Request lesson</Button>
  </form>
</template>`

const copy = [
  { bad: 'Invalid input', good: 'Enter a valid email address.' },
  { bad: 'This field is required', good: 'Name is required.' },
  { bad: 'Error: date', good: 'Pick a date for the lesson.' },
  { bad: 'URL format incorrect!', good: 'Enter a full link starting with https://' },
]
</script>

<template>
  <DesignPage
    eyebrow="Patterns"
    title="Forms & validation"
    status="beta"
    lead="How WeDance forms are laid out, when they show errors and how those errors are worded. Built from Field, Input, Select, Textarea, Checkbox and useFormValidation."
  >
    <DesignSection id="example" title="Example: book a private lesson" lead="Submit it empty to see validation. Nothing is sent — this demo only validates in the browser.">
      <div class="space-y-6">
        <div class="max-w-lg rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h3 class="font-display font-bold text-2xl">Book a private lesson</h3>
          <p class="text-sm text-muted-foreground mt-1 mb-6">With Alösha · 60 min · Munich</p>
          <form class="space-y-5" novalidate data-test="lesson-form" @submit.prevent="submit">
            <Field id="lesson-name" label="Your name" :error="errors.name">
              <Input v-model="form.name" autocomplete="name" v-bind="fieldAttrs('name', 'lesson-name-error')" />
            </Field>
            <Field id="lesson-email" label="Email" hint="The teacher replies here." :error="errors.email">
              <Input v-model="form.email" type="email" autocomplete="email" placeholder="you@example.com" v-bind="fieldAttrs('email', 'lesson-email-error')" />
            </Field>
            <div class="grid gap-5 sm:grid-cols-2">
              <Field id="lesson-style" label="Style" :error="errors.style">
                <Select v-model="form.style" :options="['Salsa', 'Bachata', 'Kizomba', 'Rueda de Casino']" placeholder="Pick a style" v-bind="fieldAttrs('style', 'lesson-style-error')" />
              </Field>
              <Field id="lesson-date" label="Preferred date" :error="errors.date">
                <Input v-model="form.date" type="date" v-bind="fieldAttrs('date', 'lesson-date-error')" />
              </Field>
            </div>
            <Field id="lesson-message" label="What would you like to work on?" optional :hint="`${form.message.length}/500`" :error="errors.message">
              <Textarea v-model="form.message" :rows="3" placeholder="Turn patterns, musicality, styling…" v-bind="fieldAttrs('message', 'lesson-message-error')" />
            </Field>
            <Field id="lesson-terms" :error="errors.terms">
              <Checkbox v-model="form.terms" v-bind="fieldAttrs('terms', 'lesson-terms-error')">I accept the booking terms</Checkbox>
            </Field>
            <div class="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" size="lg" class="w-full sm:w-auto rounded-full">Request lesson</Button>
              <Button type="button" variant="ghost" size="lg" class="w-full sm:w-auto rounded-full" @click="clear">Clear</Button>
            </div>
            <p v-if="sent" role="status" class="rounded-xl bg-success/10 px-4 py-3 text-sm text-wd-green-700 font-bold">
              Looks good — in a real form this is where it would be sent.
            </p>
          </form>
        </div>
        <DesignCode :code="codeExample" class="min-w-0" />
      </div>
    </DesignSection>

    <DesignSection id="layout" title="Layout">
      <ul class="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
        <li class="rounded-xl border border-border bg-card p-4"><strong class="text-foreground block mb-1">One column</strong>People read forms top to bottom. Pair fields side by side only when they belong together and are short (date + time, first + last name) — and stack them below 640px.</li>
        <li class="rounded-xl border border-border bg-card p-4"><strong class="text-foreground block mb-1">Label above the field</strong>Never beside it, never as placeholder. Works at every width and with long translations.</li>
        <li class="rounded-xl border border-border bg-card p-4"><strong class="text-foreground block mb-1">20px between fields</strong><code class="font-mono text-xs">space-y-5</code> on the form. Group long forms into sections with an h3, not with extra boxes.</li>
        <li class="rounded-xl border border-border bg-card p-4"><strong class="text-foreground block mb-1">One primary button</strong>At the end, left-aligned with the fields, full width on phones. Its text says what happens: "Request lesson", not "Submit".</li>
      </ul>
    </DesignSection>

    <DesignSection id="required" title="Required and optional" lead="Most of our fields are required, so we mark the exceptions.">
      <DesignDoDont do-text="Mark optional fields with “(optional)”. Ask only for what you need — every optional field is a candidate for deletion." dont-text="Scatter red asterisks on every field. They add noise and nobody remembers the legend.">
        <template #do>
          <div class="w-full max-w-60 space-y-3">
            <Field label="Name"><Input /></Field>
            <Field label="Website" optional><Input /></Field>
          </div>
        </template>
        <template #dont>
          <div class="w-full max-w-60 space-y-3">
            <Field label="Name *"><Input /></Field>
            <Field label="Website"><Input /></Field>
          </div>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="timing" title="Validation timing" lead="Exactly what useFormValidation does — don't reinvent it per page.">
      <ol class="space-y-3">
        <li v-for="(step, i) in [
          ['While typing, before the first submit', 'No errors. Don’t shout at people who haven’t finished.'],
          ['On submit with problems', 'Every invalid field shows its message at once, and focus moves to the first one.'],
          ['While fixing', 'Each message disappears live as soon as its field is valid — no need to submit again to see progress.'],
          ['After a successful submit or reset()', 'Errors are hidden again, so clearing the form doesn’t light it up red.'],
        ]" :key="i" class="flex gap-4 rounded-xl border border-border bg-card p-4">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{{ i + 1 }}</span>
          <div class="text-sm"><strong class="text-foreground">{{ step[0] }}</strong><p class="text-muted-foreground mt-0.5">{{ step[1] }}</p></div>
        </li>
      </ol>
      <p class="text-sm text-muted-foreground mt-4">Always put <code class="font-mono text-xs">novalidate</code> on the form so browser bubbles don't compete with our messages. Server errors that belong to a field go into that field's error; anything else goes in one message above the button.</p>
    </DesignSection>

    <DesignSection id="copy" title="Error message copy" lead="Say what to do, in plain words, in one short sentence ending with a full stop. Messages live in shared/validation so the same mistake reads the same everywhere.">
      <div tabindex="0" role="region" aria-label="Scrollable table" class="overflow-x-auto rounded-xl border border-border">
        <table class="w-full text-sm text-left">
          <thead class="bg-muted text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th scope="col" class="px-4 py-2.5 font-bold">Instead of</th><th scope="col" class="px-4 py-2.5 font-bold">Write</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in copy" :key="c.good" class="border-t border-border">
              <td class="px-4 py-3 text-muted-foreground line-through decoration-destructive/60">{{ c.bad }}</td>
              <td class="px-4 py-3 text-foreground font-bold">{{ c.good }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul class="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
        <li>Missing value: “<em>Field</em> is required.” or a verb: “Choose a dance style.”</li>
        <li>Wrong format: show the right one — “Enter a full link starting with https://”.</li>
        <li>No blame, no jargon, no “oops”, no exclamation marks, no error codes.</li>
      </ul>
    </DesignSection>

    <DesignSection id="a11y" title="Accessibility">
      <DesignA11y
        :notes="[
          'Every control sits in a <code>Field</code> — that gives it a label, and links hint and error through <code>aria-describedby</code>.',
          'Errors are text next to the field. Colour is the second signal, never the only one.',
          'On a failed submit focus jumps to the first invalid field, so keyboard and screen-reader users land on the problem.',
          'Tab order follows the visual order — never reorder fields with CSS.',
          'Use <code>autocomplete</code> and the right <code>type</code> for personal data.',
        ]"
      />
    </DesignSection>
  </DesignPage>
</template>

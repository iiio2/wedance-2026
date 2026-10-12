<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const email = ref('')
const touched = ref(false)
const emailError = computed(() => (touched.value && !/^\S+@\S+\.\S+$/.test(email.value) ? 'Enter a valid email address.' : undefined))

const codeBasic = `<Field label="Email" hint="We send your ticket here." :error="emailError">
  <Input v-model="email" type="email" autocomplete="email" />
</Field>`

const codeValidation = `<script setup lang="ts">
const { errors, validate, fieldAttrs } = useFormValidation(BookingSchema, form)
<\/script>

<Field id="book-email" label="Email" :error="errors.email">
  <!-- fieldAttrs registers the id so a failed submit focuses this field -->
  <Input v-model="form.email" type="email" v-bind="fieldAttrs('email', 'book-email-error')" />
</Field>`

const codeSlot = `<Field label="Colour" v-slot="{ id, describedBy, invalid }">
  <input :id="id" type="color" :aria-describedby="describedBy" :aria-invalid="invalid || undefined">
</Field>`

const codeLabel = `<Label for="promo">Promo code</Label>
<Input id="promo" />`

const fieldProps = [
  { name: 'label', type: 'string', description: 'Visible label above the control.' },
  { name: 'id', type: 'string', default: 'auto', description: 'Control id. Error id = `${id}-error`, hint id = `${id}-hint`. Pass one when using useFormValidation.' },
  { name: 'hint', type: 'string', description: 'Help text below the control, always visible, linked via aria-describedby.' },
  { name: 'error', type: 'string', description: 'Error message. Truthy = the control gets aria-invalid and the red border.' },
  { name: 'optional', type: 'boolean', default: 'false', description: 'Adds a quiet "(optional)" to the label.' },
  { name: 'required', type: 'boolean', default: 'false', description: 'Sets aria-required on the control. No visual mark — we mark optional fields instead.' },
  { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the control inside.' },
  { name: 'hideLabel', type: 'boolean', default: 'false', description: 'Keeps the label for screen readers only. Rare — e.g. a search field next to a "Search" button.' },
  { name: 'slot props', type: '{ id, describedBy, invalid }', description: 'For custom controls that are not Input/Select/Textarea/Checkbox.' },
]
const labelProps = [
  { name: 'for', type: 'string', description: 'id of the control.' },
  { name: 'optional', type: 'boolean', default: 'false', description: 'Appends "(optional)".' },
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Field & Label"
    status="beta"
    lead="Field wraps one control with its label, hint and error and wires them together: for/id, aria-describedby, aria-invalid. Use it for every form control."
  >
    <DesignSection id="example" title="Example" lead="Type something invalid and leave the field.">
      <DesignExample :code="codeBasic">
        <div class="w-full max-w-sm">
          <Field id="demo-email" label="Email" hint="We send your ticket here." :error="emailError">
            <Input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" @blur="touched = true" />
          </Field>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="anatomy" title="Anatomy">
      <div class="grid gap-6 md:grid-cols-[1fr_16rem] items-start">
        <div class="rounded-2xl border border-border bg-card p-6">
          <Field id="demo-anatomy" label="Instagram" optional hint="So the teacher can tag you." error="Use your handle, e.g. @ana.dances">
            <Input model-value="ana dances" />
          </Field>
        </div>
        <ol class="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
          <li><strong class="text-foreground">Label</strong> — text-sm bold, above. "(optional)" when not required.</li>
          <li><strong class="text-foreground">Control</strong> — Input, Select, Textarea or Checkbox.</li>
          <li><strong class="text-foreground">Hint</strong> — text-xs muted. Stays visible while the error shows.</li>
          <li><strong class="text-foreground">Error</strong> — FieldError, text-xs bold red, at <code class="font-mono text-xs">${id}-error</code>.</li>
        </ol>
      </div>
    </DesignSection>

    <DesignSection id="validation" title="With useFormValidation" lead="Pass the same id to Field and to fieldAttrs. The control merges both aria-describedby values without duplicates.">
      <DesignCode :code="codeValidation" />
    </DesignSection>

    <DesignSection id="custom" title="Custom controls" lead="Anything else can read the wiring from the slot.">
      <DesignExample :code="codeSlot">
        <Field v-slot="{ id, describedBy, invalid }" label="Accent colour" hint="Used on your festival page.">
          <input :id="id" type="color" class="h-11 w-20 rounded-xl border border-input bg-card p-1" :aria-describedby="describedBy" :aria-invalid="invalid || undefined">
        </Field>
      </DesignExample>
    </DesignSection>

    <DesignSection id="label" title="Label on its own" lead="Field uses Label internally. Use Label directly only for layouts Field can't express (e.g. a label beside a checkbox without the slot).">
      <DesignExample :code="codeLabel">
        <div class="flex w-full max-w-sm flex-col gap-1.5">
          <Label for="demo-promo" optional>Promo code</Label>
          <Input id="demo-promo" placeholder="SALSA10" />
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <h3 class="font-display font-bold text-lg mb-3">Field</h3>
      <DesignProps :rows="fieldProps" />
      <h3 class="font-display font-bold text-lg mt-8 mb-3">Label</h3>
      <DesignProps :rows="labelProps" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont do-text="Keep the hint visible when an error appears — it often explains how to fix it." dont-text="Put the error in a toast or at the top only. It has to sit next to the field it is about.">
        <template #do>
          <Field label="Phone" hint="With country code, e.g. +49…" error="Add the country code." class="w-full max-w-60"><Input model-value="0151 234" /></Field>
        </template>
        <template #dont>
          <div class="w-full max-w-60 space-y-2">
            <p class="rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground">Something went wrong</p>
            <Input model-value="0151 234" aria-label="Phone" />
          </div>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="a11y" title="Accessibility">
      <DesignA11y
        :notes="[
          'The label is a real <code>label for</code> — clicking it focuses the control.',
          '<code>aria-describedby</code> lists the error first, then the hint, so the problem is read out before the help.',
          'The error is plain text next to the field; the red border is a second signal, never the only one.',
          'useFormValidation focuses the first invalid field on submit via the error id.',
        ]"
      />
    </DesignSection>
  </DesignPage>
</template>

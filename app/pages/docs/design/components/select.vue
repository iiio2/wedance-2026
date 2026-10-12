<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const style = ref('')
const level = ref('improver')
const styles = ['Salsa', 'Bachata', 'Kizomba', 'Zouk', 'Rueda de Casino']
const levels = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Improver', value: 'improver' },
  { label: 'Advanced', value: 'advanced' },
  { label: 'Teacher (invite only)', value: 'teacher', disabled: true },
]

const codeBasic = `<Field label="Dance style">
  <Select v-model="style" :options="['Salsa', 'Bachata', 'Kizomba']" placeholder="Pick a style" />
</Field>`

const codeObjects = `<Select
  v-model="level"
  :options="[
    { label: 'Beginner', value: 'beginner' },
    { label: 'Improver', value: 'improver' },
    { label: 'Teacher (invite only)', value: 'teacher', disabled: true },
  ]"
/>`

const codeSlot = `<Select v-model="city" placeholder="Choose a city">
  <optgroup label="Germany">
    <option value="munich">Munich</option>
    <option value="berlin">Berlin</option>
  </optgroup>
</Select>`

const props = [
  { name: 'v-model', type: 'string | number', default: "''", description: 'The selected value. "" means nothing picked (shows the placeholder).' },
  { name: 'options', type: '(string | { label, value, disabled? })[]', description: 'Shortcut for flat lists. For groups, put <option>/<optgroup> in the default slot instead.' },
  { name: 'placeholder', type: 'string', description: 'Prompt shown while empty. Rendered as a disabled first option, so it cannot be picked again.' },
  { name: 'size', type: "'default' | 'sm'", default: "'default'", description: 'Same heights as Input.' },
  { name: 'invalid', type: 'boolean', default: 'false', description: 'Red border + aria-invalid without a Field.' },
  { name: '…attrs', type: 'HTML attrs', description: 'name, disabled, required, id, aria-* go to the <select> (not the wrapper).' },
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Select"
    status="beta"
    lead="Pick one option from a list. A styled native select: on phones it opens the system picker, which is faster and more accessible than any custom dropdown."
  >
    <DesignSection id="example" title="Example">
      <DesignExample :code="codeBasic">
        <div class="w-full max-w-sm">
          <Field label="Dance style">
            <Select v-model="style" :options="styles" placeholder="Pick a style" data-test="demo-style" />
          </Field>
          <p class="text-xs text-muted-foreground mt-3">Value: <code class="font-mono">{{ style || '—' }}</code></p>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="states" title="States">
      <DesignExample>
        <div class="grid w-full gap-5 sm:grid-cols-2">
          <Field label="Placeholder"><Select :options="styles" placeholder="Pick a style" /></Field>
          <Field label="Filled"><Select v-model="level" :options="levels" /></Field>
          <Field label="Disabled" disabled><Select :options="styles" model-value="Salsa" /></Field>
          <Field label="Invalid" error="Choose your level."><Select :options="levels" placeholder="Pick a level" /></Field>
          <Field label="Small" class="sm:col-span-2"><Select size="sm" :options="styles" model-value="Bachata" /></Field>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="options" title="Options" lead="Strings for simple lists, objects when label and value differ or an option is disabled, the slot for groups.">
      <div class="space-y-4">
        <DesignExample :code="codeObjects">
          <div class="w-full max-w-sm"><Field label="Level"><Select v-model="level" :options="levels" /></Field></div>
        </DesignExample>
        <DesignExample :code="codeSlot">
          <div class="w-full max-w-sm">
            <Field label="City">
              <Select placeholder="Choose a city">
                <optgroup label="Germany"><option value="munich">Munich</option><option value="berlin">Berlin</option></optgroup>
                <optgroup label="Spain"><option value="madrid">Madrid</option></optgroup>
              </Select>
            </Field>
          </div>
        </DesignExample>
      </div>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="props" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont do-text="Use Select for 5–15 options. Fewer: show them all as radio pills. Many more (cities, artists): a searchable field." dont-text="Hide a yes/no choice in a dropdown — a Checkbox or two pills is one tap instead of two.">
        <template #do>
          <Field label="Style" class="w-full max-w-56"><Select :options="styles" model-value="Salsa" /></Field>
        </template>
        <template #dont>
          <Field label="Newsletter" class="w-full max-w-56"><Select :options="['Yes', 'No']" model-value="Yes" /></Field>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="a11y" title="Accessibility">
      <DesignA11y
        :notes="[
          'Native select element: full keyboard support (arrows, type-ahead) and screen-reader semantics with no extra code.',
          'The chevron is decorative (<code>aria-hidden</code>) and ignores clicks, so the whole field opens the picker.',
          'Placeholder is a disabled option, not a label — keep the Field label.',
        ]"
      />
    </DesignSection>
  </DesignPage>
</template>

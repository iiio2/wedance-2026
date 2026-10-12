<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const bio = ref('')
const max = 280

const codeBasic = `<Field label="About you" optional :hint="\`\${bio.length}/280\`">
  <Textarea v-model="bio" maxlength="280" placeholder="What you dance, where you learned…" />
</Field>`

const codeStates = `<Textarea placeholder="Default" />
<Textarea disabled model-value="Can't edit this" />
<Textarea invalid />
<Textarea :rows="2" :resize="false" />`

const props = [
  { name: 'v-model', type: 'string', description: 'The text.' },
  { name: 'rows', type: 'number', default: '4', description: 'Initial height in lines. Minimum height is 96px regardless.' },
  { name: 'resize', type: 'boolean', default: 'true', description: 'Vertical drag handle. Turn off for short fixed boxes (e.g. a one-line note in a card).' },
  { name: 'invalid', type: 'boolean', default: 'false', description: 'Red border + aria-invalid without a Field.' },
  { name: 'class', type: 'string', description: 'Extra classes, merged with tailwind-merge.' },
  { name: '…attrs', type: 'HTML attrs', description: 'placeholder, maxlength, disabled, required, name, id … go to the <textarea>.' },
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Textarea"
    status="beta"
    lead="Multi-line text: bios, messages to organisers, booking notes. Same surface as Input, so mixed forms line up."
  >
    <DesignSection id="example" title="Example">
      <DesignExample :code="codeBasic">
        <div class="w-full max-w-md">
          <Field label="About you" optional :hint="`${bio.length}/${max}`">
            <Textarea v-model="bio" :maxlength="max" placeholder="What you dance, where you learned…" data-test="demo-bio" />
          </Field>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="states" title="States">
      <DesignExample :code="codeStates">
        <div class="grid w-full gap-5 sm:grid-cols-2">
          <Field label="Default"><Textarea placeholder="Write a message…" :rows="3" /></Field>
          <Field label="Filled"><Textarea model-value="Hi! I'd love a private lesson before the festival — Friday evening works best." :rows="3" /></Field>
          <Field label="Disabled" disabled><Textarea model-value="Can't edit this" :rows="3" /></Field>
          <Field label="Invalid" error="Tell the teacher what you'd like to work on."><Textarea :rows="3" /></Field>
          <Field label="Short, fixed" hint="rows=2, resize off" class="sm:col-span-2"><Textarea :rows="2" :resize="false" placeholder="Note for the door" /></Field>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="props" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont do-text="Show a live counter in the hint when there is a limit." dont-text="Use a textarea for a one-line answer — it invites essays where you wanted a name.">
        <template #do>
          <Field label="Message" hint="42/280" class="w-full max-w-64"><Textarea :rows="2" model-value="See you at the Friday social!" /></Field>
        </template>
        <template #dont>
          <Field label="City" class="w-full max-w-64"><Textarea :rows="3" /></Field>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="a11y" title="Accessibility">
      <DesignA11y
        :notes="[
          'Label it with <code>Field</code> like any input.',
          'Put limits in the hint (it is read out via <code>aria-describedby</code>), not only in <code>maxlength</code>, which silently stops typing.',
          'Keep <code>resize</code> on for long text — people with large fonts need the room.',
        ]"
      />
    </DesignSection>
  </DesignPage>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const newsletter = ref(false)
const terms = ref(false)
const styles = reactive<Record<string, boolean>>({ Salsa: true, Bachata: false, Kizomba: false })

const codeBasic = `<Checkbox v-model="newsletter">
  Email me new events in my city
</Checkbox>`

const codeBare = `<Checkbox id="remember" v-model="remember" />
<Label for="remember">Remember me</Label>`

const codeField = `<Field :error="errors.terms">
  <Checkbox v-model="form.terms">I accept the booking terms</Checkbox>
</Field>`

const props = [
  { name: 'v-model', type: 'boolean', default: 'false', description: 'Checked state.' },
  { name: 'default slot', type: 'label text', description: 'When present, the checkbox renders inside its own <label> row (min 44px tall) — the whole row toggles it.' },
  { name: 'invalid', type: 'boolean', default: 'false', description: 'Red outline + aria-invalid without a Field.' },
  { name: 'class', type: 'string', description: 'Classes for the row (with slot) or the box (without).' },
  { name: '…attrs', type: 'HTML attrs', description: 'name, value, disabled, required, id go to the <input>.' },
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Checkbox"
    status="beta"
    lead="Turn one option on or off, or pick several from a short list. A native checkbox tinted brand red, so it is accessible and looks right on every OS."
  >
    <DesignSection id="example" title="Example">
      <DesignExample :code="codeBasic">
        <div class="w-full max-w-sm">
          <Checkbox v-model="newsletter" data-test="demo-newsletter">Email me new events in my city</Checkbox>
          <p class="text-xs text-muted-foreground mt-2">Value: <code class="font-mono" data-test="demo-newsletter-value">{{ newsletter }}</code></p>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="states" title="States">
      <DesignExample>
        <div class="grid w-full gap-1 sm:grid-cols-2">
          <Checkbox>Unchecked</Checkbox>
          <Checkbox :model-value="true">Checked</Checkbox>
          <Checkbox disabled>Disabled</Checkbox>
          <Checkbox disabled :model-value="true">Disabled, checked</Checkbox>
          <Field error="Accept the terms to continue." class="sm:col-span-2">
            <Checkbox v-model="terms">I accept the booking terms (invalid)</Checkbox>
          </Field>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="group" title="Group" lead="Several checkboxes answer one question: wrap them in a fieldset with a legend.">
      <DesignExample>
        <fieldset class="w-full max-w-sm">
          <legend class="text-sm font-bold text-foreground mb-1">Styles you dance</legend>
          <Checkbox v-for="(on, s) in styles" :key="s" v-model="styles[s]" class="flex">{{ s }}</Checkbox>
        </fieldset>
      </DesignExample>
    </DesignSection>

    <DesignSection id="usage" title="Without a slot · in a Field">
      <div class="space-y-4">
        <DesignExample :code="codeBare">
          <div class="flex items-center gap-2.5">
            <Checkbox id="demo-remember" />
            <Label for="demo-remember" class="font-normal">Remember me</Label>
          </div>
        </DesignExample>
        <DesignExample :code="codeField">
          <Field error="Accept the terms to continue." class="w-full max-w-sm">
            <Checkbox>I accept the booking terms</Checkbox>
          </Field>
        </DesignExample>
      </div>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="props" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont do-text="Phrase the label as the 'on' state, so checked means yes." dont-text="Use negative labels — 'Don't email me' makes people think twice.">
        <template #do><Checkbox>Email me new events</Checkbox></template>
        <template #dont><Checkbox>Don't email me events</Checkbox></template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="a11y" title="Accessibility">
      <DesignA11y
        :notes="[
          'Native <code>input type=checkbox</code>: Space toggles, screen readers announce checked state.',
          'With the slot, the label wraps the box, so tapping the text toggles it and the row is at least 44px tall.',
          'Groups need a <code>fieldset</code> + <code>legend</code> so the question is read with each option.',
          'Keyboard focus shows the amber ring token around the box.',
        ]"
      />
    </DesignSection>
  </DesignPage>
</template>

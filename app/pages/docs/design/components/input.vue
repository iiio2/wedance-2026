<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const name = ref('')
const city = ref('Munich')

const focusLook = 'border-primary/60 shadow-[0_0_0_3px_color-mix(in_srgb,var(--wd-red-600)_15%,transparent)]'

const codeBasic = `<Field label="Your name">
  <Input v-model="name" placeholder="e.g. Ana Pérez" autocomplete="name" />
</Field>`

const codeStates = `<Input placeholder="Default" />
<Input model-value="Munich" />
<Input disabled model-value="Can't edit this" />
<Input invalid model-value="ana@" />`

const codeSizes = `<Input placeholder="Default — h-11, rounded-xl" />
<Input size="sm" placeholder="Small — h-9, rounded-lg" />`

const codeTypes = `<Input type="email" autocomplete="email" inputmode="email" />
<Input type="url" placeholder="yoursite.com" />
<Input type="date" />
<Input type="number" min="1" />`

const props = [
  { name: 'v-model', type: 'string | number', description: 'The value. Number inputs still emit a string — parse it where you use it.' },
  { name: 'type', type: 'string', default: "'text'", description: 'Any native input type: text, email, url, tel, number, date, time, password, search.' },
  { name: 'size', type: "'default' | 'sm'", default: "'default'", description: 'default = h-11 (forms people fill in). sm = h-9 (filters, admin tables, toolbars).' },
  { name: 'invalid', type: 'boolean', default: 'false', description: 'Red border + aria-invalid without a Field. Inside a Field, pass error to the Field instead.' },
  { name: 'class', type: 'string', description: 'Extra classes, merged with tailwind-merge.' },
  { name: '…attrs', type: 'HTML attrs', description: 'Everything else (placeholder, autocomplete, disabled, required, name, id, aria-*) goes to the <input>.' },
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Input"
    status="beta"
    lead="Single-line text field. White surface, soft brown border, rounded-xl and a red focus halo — the look the profile, onboarding and booking forms already use."
  >
    <DesignSection id="example" title="Example" lead="Always inside a Field so it has a visible label.">
      <DesignExample :code="codeBasic">
        <div class="w-full max-w-sm">
          <Field label="Your name" hint="Shown on your public profile.">
            <Input v-model="name" placeholder="e.g. Ana Pérez" autocomplete="name" data-test="demo-name" />
          </Field>
          <p class="text-xs text-muted-foreground mt-3">Value: <code class="font-mono" data-test="demo-name-value">{{ name || '—' }}</code></p>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="states" title="States" lead="Focus is the only state with a halo. Invalid keeps the red border while focused, with a red halo.">
      <DesignExample :code="codeStates">
        <div class="grid w-full gap-5 sm:grid-cols-2">
          <Field label="Default"><Input placeholder="e.g. Munich" /></Field>
          <Field label="Focus"><Input placeholder="e.g. Munich" :class="focusLook" /></Field>
          <Field label="Filled"><Input v-model="city" /></Field>
          <Field label="Disabled" disabled><Input model-value="Can't edit this" /></Field>
          <Field label="Invalid" error="Enter a valid email address." class="sm:col-span-2"><Input model-value="ana@" type="email" /></Field>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="sizes" title="Sizes" lead="Two heights cover the product: 44px for forms (and touch), 36px for dense UI.">
      <DesignExample :code="codeSizes">
        <div class="grid w-full gap-4 sm:grid-cols-2">
          <Input placeholder="Default — h-11, rounded-xl" aria-label="Default size example" />
          <Input size="sm" placeholder="Small — h-9, rounded-lg" aria-label="Small size example" />
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="types" title="Input types" lead="Use the right type and autocomplete — phones show the matching keyboard and browsers can autofill.">
      <DesignExample :code="codeTypes">
        <div class="grid w-full gap-4 sm:grid-cols-2">
          <Field label="Email"><Input type="email" autocomplete="email" placeholder="you@example.com" /></Field>
          <Field label="Website" optional><Input type="url" placeholder="yoursite.com" /></Field>
          <Field label="Date"><Input type="date" /></Field>
          <Field label="Guests"><Input type="number" min="1" model-value="2" /></Field>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="props" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <div class="space-y-4">
        <DesignDoDont do-text="Label above, placeholder shows an example of the format." dont-text="Use the placeholder as the label — it disappears as soon as someone types.">
          <template #do>
            <Field label="Instagram" class="w-full max-w-60"><Input placeholder="@yourhandle" /></Field>
          </template>
          <template #dont>
            <Input placeholder="Instagram" aria-label="Instagram" class="max-w-60" />
          </template>
        </DesignDoDont>
        <DesignDoDont do-text="Size the field to the expected answer on wide screens." dont-text="Set inline border or background colours — the component owns them, and the invalid state can't override inline styles cleanly.">
          <template #do>
            <Field label="Postcode" class="w-28"><Input inputmode="numeric" placeholder="80331" /></Field>
          </template>
          <template #dont>
            <input class="h-11 w-full max-w-60 rounded-xl px-3.5 text-sm border border-wd-amber-500 bg-wd-amber-100" aria-label="Bad example" placeholder="Custom colours">
          </template>
        </DesignDoDont>
      </div>
    </DesignSection>

    <DesignSection id="a11y" title="Accessibility">
      <DesignA11y
        :notes="[
          'Every input needs a visible label. Wrap it in <code>Field</code>, which sets <code>for</code>/<code>id</code> for you.',
          'Inside a Field the input gets <code>aria-describedby</code> (error, then hint) and <code>aria-invalid</code> automatically.',
          'Default height is 44px — the minimum comfortable touch target.',
          'Focus adds a 3px halo around the field, so it reads as a shape change, not only a colour change.',
          'Set <code>autocomplete</code> on personal-data fields (name, email, tel) so browsers and password managers can fill them.',
        ]"
      />
    </DesignSection>
  </DesignPage>
</template>

<script setup lang="ts">
import type { CityOption } from '#shared/utils/citySearch'

definePageMeta({ layout: 'design' })

const city = ref('')
const picked = ref<CityOption | null>(null)
const strictCity = ref('Berlin')
const filled = ref('Munich')

// A fixed list for the states demos, so the page is deterministic (no DB).
const sample: CityOption[] = [
  { name: 'Munich', slug: 'munich', country: 'Germany', altNames: ['München'], communities: 120 },
  { name: 'Berlin', slug: 'berlin', country: 'Germany', altNames: [], communities: 90 },
  { name: 'Hamburg', slug: 'hamburg', country: 'Germany', altNames: [], communities: 40 },
  { name: 'Vienna', slug: 'vienna', country: 'Austria', altNames: ['Wien'], communities: 35 },
  { name: 'Prague', slug: 'prague', country: 'Czechia', altNames: ['Praha'], communities: 20 },
  { name: 'São Paulo', slug: 'sao-paulo', country: 'Brazil', altNames: [], communities: 8 },
]

const codeBasic = `<Field label="Your city" :error="errors.city">
  <CityCombobox
    v-model="form.city"
    placeholder="Munich, Berlin…"
    v-bind="fieldAttrs('city', 'onb-city-error')"
  />
</Field>`

const codeSelect = `<!-- Navigate on pick; typing still filters the page -->
<CityCombobox
  v-model="searchQuery"
  :free-text-note="false"
  @select="city => navigateTo(\`/cities/\${city.slug}\`)"
/>`

const codeStrict = `<!-- Only a picked suggestion counts; free text reverts on blur -->
<CityCombobox v-model="city" :allow-custom="false" />`

const props = [
  { name: 'v-model', type: 'string', default: "''", description: 'The city name — the same plain string dancers.city / profiles.city store. Typing updates it live unless allow-custom is false.' },
  { name: '@select', type: '(city: CityOption) => void', description: 'Fires when a suggestion is picked. CityOption = { name, slug, country, altNames, communities } — use slug to navigate or fill a slug field.' },
  { name: 'allow-custom', type: 'boolean', default: 'true', description: 'Keep free text as the value. false = only a picked suggestion counts; anything else reverts on blur.' },
  { name: 'free-text-note', type: 'boolean', default: 'true', description: "Show “we'll save it as you typed it” on no match. Turn off where typing filters instead of saves (the /cities search)." },
  { name: 'show-popular', type: 'boolean', default: 'true', description: 'On focus with an empty field, list the biggest WeDance communities.' },
  { name: 'limit', type: 'number', default: '8', description: 'Max suggestions in the list.' },
  { name: 'debounce', type: 'number', default: '120', description: 'ms between the last keystroke and re-filtering.' },
  { name: 'options', type: 'CityOption[]', description: 'Your own list instead of /api/city-options (fetched once per session on first focus).' },
  { name: 'placeholder', type: 'string', default: "'Search a city'", description: 'Hint inside the empty field. Keep the Field label.' },
  { name: 'size', type: "'default' | 'sm'", default: "'default'", description: 'Same heights as Input.' },
  { name: 'invalid', type: 'boolean', default: 'false', description: 'Red border + aria-invalid without a Field.' },
  { name: '…attrs', type: 'HTML attrs', description: 'name, required, disabled, id, aria-* go to the <input>.' },
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="City combobox"
    status="beta"
    lead="Type a few letters, pick your city. Suggestions come from WeDance's own city list (with alternative spellings like München → Munich) — no maps API, no key. Any city can still be typed, so nobody is blocked because we don't list their town yet."
  >
    <DesignSection id="example" title="Example">
      <DesignExample :code="codeBasic">
        <div class="w-full max-w-sm">
          <Field label="Your city" hint="Try “mün”, “sao” or “ber”.">
            <CityCombobox v-model="city" placeholder="Munich, Berlin…" data-test="demo-city" @select="c => (picked = c)" />
          </Field>
          <p class="text-xs text-muted-foreground mt-3">
            Value: <code class="font-mono" data-test="demo-city-value">{{ city || '—' }}</code>
            <template v-if="picked"> · picked slug: <code class="font-mono">{{ picked.slug }}</code></template>
          </p>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="states" title="States">
      <DesignExample>
        <div class="grid w-full gap-5 sm:grid-cols-2">
          <Field label="Empty"><CityCombobox :options="sample" placeholder="Search a city" /></Field>
          <Field label="Filled"><CityCombobox v-model="filled" :options="sample" /></Field>
          <Field label="Disabled" disabled><CityCombobox :options="sample" model-value="Vienna" /></Field>
          <Field label="Invalid" error="Tell us your city so we can fill your plan."><CityCombobox :options="sample" /></Field>
          <Field label="Small" class="sm:col-span-2"><CityCombobox size="sm" :options="sample" model-value="Prague" /></Field>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="behaviour" title="Behaviour" lead="Free text by default; react to a pick with @select; lock to the list with allow-custom=false.">
      <div class="space-y-4">
        <DesignExample :code="codeSelect">
          <ul class="text-sm text-muted-foreground font-sans space-y-1.5 list-disc pl-5">
            <li>Focus an empty field → the biggest communities (“Popular on WeDance”).</li>
            <li>Typing filters locally — accents and case don't matter, alternative names count, the matched letters are bold.</li>
            <li>No match → “No city found — we'll save it as you typed it”. The value is kept.</li>
          </ul>
        </DesignExample>
        <DesignExample :code="codeStrict">
          <div class="w-full max-w-sm">
            <Field label="Home city (from list only)">
              <CityCombobox v-model="strictCity" :options="sample" :allow-custom="false" />
            </Field>
            <p class="text-xs text-muted-foreground mt-3">Value: <code class="font-mono">{{ strictCity || '—' }}</code></p>
          </div>
        </DesignExample>
      </div>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="props" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont do-text="Use it wherever someone types a city — profile, onboarding, ride origin, enquiry forms. Keep free text on: a dancer in a town we don't list must still be able to answer." dont-text="Use a Select with hundreds of cities. Scrolling an alphabetical list on a phone is slow and the right city is rarely near the top.">
        <template #do>
          <Field label="City" class="w-full max-w-56"><CityCombobox :options="sample" model-value="Munich" /></Field>
        </template>
        <template #dont>
          <Field label="City" class="w-full max-w-56"><Select :options="sample.map(c => c.name)" model-value="Munich" /></Field>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="a11y" title="Accessibility">
      <DesignA11y
        :notes="[
          'ARIA 1.2 editable combobox: <code>role=combobox</code> on the input, <code>aria-autocomplete=list</code>, <code>aria-expanded</code>, <code>aria-controls</code> → the listbox, <code>aria-activedescendant</code> → the highlighted option. Focus never leaves the text box.',
          'Keys: ↓/↑ move through suggestions (and open the list), Alt+↓ opens, Enter picks the highlighted city, Esc closes — a second Esc clears the field. Enter with nothing highlighted submits the form as usual.',
          'A polite live region announces how many cities are suggested, “loading” and the no-match message.',
          'Inside a Field it picks up id, label, aria-describedby and aria-invalid like Input. Options are 40px+ tall for touch.',
        ]"
      />
    </DesignSection>
  </DesignPage>
</template>

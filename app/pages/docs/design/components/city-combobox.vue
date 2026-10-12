<script setup lang="ts">
import type { CityOption } from '#shared/utils/citySearch'

definePageMeta({ layout: 'docs' })

const city = ref('')
const picked = ref<CityOption | null>(null)
const filled = ref('Munich')
const searchText = ref('')

// A fixed list for the states demos, so the page is deterministic (no DB).
const sample: CityOption[] = [
  { name: 'Munich', slug: 'munich', country: 'Germany', altNames: ['München', 'Мюнхен'], communities: 120, source: 'city' },
  { name: 'Berlin', slug: 'berlin', country: 'Germany', altNames: [], communities: 90, source: 'city' },
  { name: 'Hamburg', slug: 'hamburg', country: 'Germany', altNames: [], communities: 40, source: 'city' },
  { name: 'Vienna', slug: 'vienna', country: 'Austria', altNames: ['Wien'], communities: 35, source: 'city' },
  { name: 'Prague', slug: 'prague', country: 'Czechia', altNames: ['Praha'], communities: 20, source: 'city' },
  { name: 'São Paulo', slug: 'sao-paulo', country: 'Brazil', altNames: [], communities: 8, source: 'city' },
]

const codeBasic = `<Field label="Your city" :error="errors.city">
  <CityCombobox
    v-model="form.city"
    placeholder="Munich, Berlin…"
    v-bind="fieldAttrs('city', 'onb-city-error')"
  />
</Field>`

const codeSelect = `<!-- Store the id/slug, not just the name -->
<CityCombobox
  v-model="form.city"
  @select="city => { form.cityId = city.id; form.citySlug = city.slug }"
/>`

const codeSearch = `<!-- Directory filter only (/cities): the typed text is the value.
     Never on a field that is saved. -->
<CityCombobox
  v-model="searchQuery"
  free-text
  :show-popular="false"
  @select="city => navigateTo(\`/cities/\${city.slug}\`)"
/>`

const props = [
  { name: 'v-model', type: 'string', default: "''", description: 'The canonical English city name (“Munich”) — only ever set by picking a city, never by typing. Text that was not picked reverts on blur; clearing the field clears the value.' },
  { name: '@select', type: '(city: CityOption) => void', description: 'Fires with the canonical city once it is picked (Google picks are resolved and saved first): { id, slug, name, localName, country, countryCode, region, lat, lng, placeId, altNames }. Store id or slug from here.' },
  { name: 'free-text', type: 'boolean', default: 'false', description: 'Search-box mode — the typed text is the value and Google is never asked. Only for filters (the /cities directory search), never for a saved field.' },
  { name: 'show-popular', type: 'boolean', default: 'true', description: 'On focus with an empty field, list the biggest WeDance communities.' },
  { name: 'limit', type: 'number', default: '8', description: 'Max suggestions in the list.' },
  { name: 'debounce', type: 'number', default: '300', description: 'ms between the last keystroke and asking the server (→ Google). Clamped to ≥ 250. Known cities filter instantly.' },
  { name: 'options', type: 'CityOption[]', description: 'Your own list instead of /api/city-options. Turns off the Google search (docs, tests, scoped lists).' },
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
    lead="Type a few letters in any language, pick your city. Known cities come from WeDance's own cities table and filter instantly; a city we don't have yet is found through Google Places and added the moment it's picked. The saved value is always the canonical city — München, Мюнхен and munich all save as Munich."
  >
    <DesignSection id="example" title="Example">
      <DesignExample :code="codeBasic">
        <div class="w-full max-w-sm">
          <Field label="Your city" hint="Try “Мюнх”, “mün”, “sao” — or a town we don't list yet.">
            <CityCombobox v-model="city" placeholder="Munich, Berlin…" data-test="demo-city" @select="(c: CityOption) => (picked = c)" />
          </Field>
          <p class="text-xs text-muted-foreground mt-3">
            Value: <code class="font-mono" data-test="demo-city-value">{{ city || '—' }}</code>
            <template v-if="picked"> · slug: <code class="font-mono" data-test="demo-city-slug">{{ picked.slug }}</code><template v-if="picked.country"> · {{ picked.country }}</template></template>
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

    <DesignSection id="behaviour" title="Behaviour" lead="No free text: the value is always a canonical city. Known cities first, Google Places only for the rest.">
      <div class="space-y-4">
        <DesignExample :code="codeSelect">
          <ul class="text-sm text-muted-foreground font-sans space-y-1.5 list-disc pl-5">
            <li>Focus an empty field → the biggest communities (“Popular on WeDance”).</li>
            <li>Typing filters the known cities instantly — accents and case don't matter, other spellings count (Мюнхен, Munique), the matched letters are bold.</li>
            <li>Fewer than 3 known matches and 2+ letters → after a 300 ms pause the server asks Google Places (cities only, English names). New cities show a <strong>+</strong> and the region; “powered by Google” appears under them.</li>
            <li>Picking a Google city adds it to WeDance's cities (English + local name, coordinates, the spelling you typed) and then sets the value — the next person finds it instantly.</li>
            <li>Typed text that wasn't picked reverts on blur. No match → “No city found. Check the spelling or try the English name.”</li>
          </ul>
        </DesignExample>
        <DesignExample :code="codeSearch">
          <div class="w-full max-w-sm">
            <Field label="Search cities (filter mode)">
              <CityCombobox v-model="searchText" :options="sample" free-text :show-popular="false" />
            </Field>
            <p class="text-xs text-muted-foreground mt-3">Value: <code class="font-mono">{{ searchText || '—' }}</code></p>
          </div>
        </DesignExample>
      </div>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="props" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont do-text="Use it wherever someone gives a city — profile, onboarding, ride origin, enquiry forms. Store the id or slug from @select where you can; a town we don't list yet is one Google pick away." dont-text="Use a plain text Input for a city, or free-text on a saved field. “München”, “Munich ” and “munich” become three cities nobody can group, count or link.">
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
          'A polite live region announces how many cities are suggested, “searching”, “adding the city” and the no-match / error message. A city being added carries <code>aria-busy</code>.',
          'Inside a Field it picks up id, label, aria-describedby and aria-invalid like Input. Options are 40px+ tall for touch.',
        ]"
      />
    </DesignSection>
  </DesignPage>
</template>

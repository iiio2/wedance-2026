<script setup lang="ts">
import { ALL_DANCE_STYLES, DANCE_FAMILIES, DANCE_STYLES } from '#shared/dance-styles'

definePageMeta({ layout: 'docs' })

const pickableFamilies = DANCE_FAMILIES.filter(f => DANCE_STYLES.some(s => s.family === f.id)).length

const mine = ref<string[]>(['Salsa', 'Urban Kiz'])
const goal = ref<string[]>([])
const festival = ref<string[]>(['Timba'])
const legacy = ref<string[]>(['Bachata', 'Afro-Cuban', 'Pole fusion'])
const invalidValue = ref<string[]>([])

const codeBasic = `<Field label="Which dances?" optional>
  <DanceStylePicker v-model="form.danceStyles" />
</Field>`

const codeSingle = `<Field label="Dance style" optional>
  <DanceStylePicker v-model="goalStyles" single :searchable="false" />
</Field>`

const codeOptions = `<!-- only what this festival teaches, no search for a short list -->
<DanceStylePicker v-model="picked" :options="festival.styles" />`

const codeChips = `<DanceStyleChips :styles="artist.styles" :max="3" />`

const codeData = `import { findDanceStyle, sortDanceStyles, canonicalDanceStyle } from '#shared/dance-styles'

findDanceStyle('urban kizz')   // → { id: 'urban-kiz', name: 'Urban Kiz', family: 'kizomba', … }
canonicalDanceStyle('LA style')  // → 'Salsa'
sortDanceStyles(['Zouk', 'Salsa']) // → ['Salsa', 'Zouk'] (popularity order)`

const pickerProps = [
  { name: 'v-model', type: 'string[]', default: '[]', description: 'Canonical style names — the values 2026 stores (`Salsa`, `Urban Kiz`). Unknown legacy values are kept and shown as removable chips.' },
  { name: 'options', type: 'string[]', default: 'all', description: 'Restrict the choice to these names or aliases (e.g. a festival’s styles).' },
  { name: 'single', type: 'boolean', default: 'false', description: 'At most one; choosing another replaces it. v-model stays an array.' },
  { name: 'searchable', type: 'boolean', default: 'true', description: 'Show the search box (hidden anyway when the list is no longer than popularCount).' },
  { name: 'expanded', type: 'boolean', default: 'false', description: 'Open every family from the start instead of “popular first”.' },
  { name: 'popularCount', type: 'number', default: '8', description: 'How many of the most popular styles lead before “All styles”.' },
  { name: 'label', type: 'string', default: '"Dance styles"', description: 'Accessible name of the chip group. The Field label names the search box.' },
  { name: 'placeholder', type: 'string', description: 'Search box placeholder.' },
  { name: 'disabled · invalid', type: 'boolean', default: 'false', description: 'Also read from a surrounding Field.' },
]
const chipProps = [
  { name: 'styles', type: 'string[]', description: 'Stored style values; sorted by popularity, aliases shown by canonical name.' },
  { name: 'max', type: 'number', default: '0', description: 'Show this many then “+N”. 0 = all.' },
  { name: 'size', type: "'sm' | 'md'", default: "'sm'", description: 'Chip size.' },
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Dance style picker"
    status="beta"
    :lead="`Pick dances from the WeDance taxonomy — ${DANCE_STYLES.length} styles in ${pickableFamilies} families. Popular styles first, the rest one tap away grouped by family, and a search that knows aliases like “LA style”, “On2” or “Kompa”.`"
  >
    <DesignSection id="example" title="Example">
      <DesignExample :code="codeBasic">
        <div class="w-full max-w-xl" data-test="demo-basic">
          <Field label="Which dances?" optional hint="Pick all you dance — you can change this later.">
            <DanceStylePicker v-model="mine" />
          </Field>
          <p class="text-xs text-muted-foreground mt-3">Value: <code class="font-mono" data-test="demo-basic-value">{{ JSON.stringify(mine) }}</code></p>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="states" title="States">
      <div class="space-y-4">
        <DesignExample>
          <div class="grid w-full gap-6 lg:grid-cols-2">
            <Field label="Expanded (all families open)">
              <DanceStylePicker v-model="festival" expanded :searchable="false" :options="['Salsa', 'Casino', 'Rueda', 'Timba', 'Son', 'Rumba', 'Afro', 'Reggaeton']" />
            </Field>
            <Field label="Legacy values kept" hint="“Afro-Cuban” is an alias of Afro; “Pole fusion” is unknown, so it shows as a removable chip.">
              <DanceStylePicker v-model="legacy" :searchable="false" />
            </Field>
            <Field label="Invalid" error="Pick at least one dance.">
              <DanceStylePicker v-model="invalidValue" :searchable="false" />
            </Field>
            <Field label="Disabled" disabled>
              <DanceStylePicker :model-value="['Bachata']" :searchable="false" disabled />
            </Field>
          </div>
        </DesignExample>
      </div>
    </DesignSection>

    <DesignSection id="variants" title="Single choice · restricted options">
      <div class="space-y-4">
        <DesignExample :code="codeSingle">
          <Field label="Dance style" optional class="w-full max-w-xl">
            <DanceStylePicker v-model="goal" single :searchable="false" />
          </Field>
        </DesignExample>
        <DesignExample :code="codeOptions">
          <Field label="Festival styles" class="w-full max-w-xl">
            <DanceStylePicker v-model="festival" :options="['Salsa', 'Timba', 'Son', 'Rumba', 'Afro']" />
          </Field>
        </DesignExample>
      </div>
    </DesignSection>

    <DesignSection id="chips" title="Read-only chips" lead="DanceStyleChips shows stored styles on cards and profiles, tinted by family.">
      <DesignExample :code="codeChips">
        <div class="space-y-2">
          <DanceStyleChips :styles="['Zouk', 'Salsa', 'urban kizz', 'Lindy Hop', 'Tango']" />
          <DanceStyleChips :styles="['Casino', 'Rueda', 'Timba', 'Son', 'Rumba', 'Afro']" :max="3" size="md" />
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="taxonomy" title="Taxonomy" lead="One source of truth in shared/dance-styles.ts, used by the picker, filters and the v3 sync.">
      <div class="space-y-4">
        <DesignCode :code="codeData" />
        <div tabindex="0" role="region" aria-label="All dance styles by family" class="overflow-x-auto rounded-xl border border-border">
          <table class="w-full text-sm text-left">
            <thead class="bg-muted text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2.5 font-bold">Family</th>
                <th scope="col" class="px-4 py-2.5 font-bold">Styles (popularity order)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in DANCE_FAMILIES" :key="f.id" class="border-t border-border align-top">
                <th scope="row" class="px-4 py-2.5 font-bold whitespace-nowrap">
                  <span class="inline-block size-2 rounded-full mr-1.5" :style="{ background: f.accent }" aria-hidden="true" />{{ f.name }}
                </th>
                <td class="px-4 py-2.5 text-muted-foreground">
                  {{ ALL_DANCE_STYLES.filter(s => s.family === f.id).map(s => s.display).join(' · ') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <div class="space-y-4">
        <h3 class="text-sm font-bold">DanceStylePicker</h3>
        <DesignProps :rows="pickerProps" />
        <h3 class="text-sm font-bold">DanceStyleChips</h3>
        <DesignProps :rows="chipProps" />
      </div>
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont
        do-text="Use the picker wherever someone chooses styles, so values match the taxonomy and filters find them."
        dont-text="Hard-code a short style list in a page — it drifts (Afro-Cuban vs Afro, Cha-Cha vs Cha-Cha-Cha) and filters miss it."
      >
        <template #do>
          <DanceStylePicker :model-value="['Salsa']" :searchable="false" :popular-count="4" />
        </template>
        <template #dont>
          <div class="flex flex-wrap gap-1.5">
            <ToggleChip v-for="s in ['Salsa', 'Afro-Cuban', 'Cha-Cha']" :key="s" :pressed="s === 'Salsa'" class="px-3 py-1.5 text-xs uppercase tracking-wider">{{ s }}</ToggleChip>
          </div>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="a11y" title="Accessibility">
      <DesignA11y
        :notes="[
          'Every style is a real <code>button</code> with <code>aria-pressed</code> (ToggleChip): Tab to it, Space/Enter toggles it.',
          'The Field label names the search box; the chip group has its own accessible name (<code>label</code> prop) and the Field hint/error via <code>aria-describedby</code>.',
          'In the search box, Enter toggles the best match and clears the query; Escape clears the query.',
          'Result counts and the selection count are announced through a polite live region.',
          'Families are <code>section</code>s labelled by their heading, so screen-reader users can jump between them.',
          'Selected chips add a check icon, so state never relies on colour alone.',
        ]"
      />
    </DesignSection>
  </DesignPage>
</template>

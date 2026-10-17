<script setup lang="ts">
/**
 * One text of a profile's website in the language being edited (RAZ-412).
 * The value is the whole { en, de, … } map; only `lang` is edited here. A text
 * not translated yet shows the main language's words as its placeholder.
 */
import type { L10n } from '#shared/types/profileSite'

const props = defineProps<{ label: string; lang: string; main: string; multiline?: boolean; rows?: number; hint?: string }>()
const model = defineModel<L10n | undefined>()

const value = computed({
  get: () => model.value?.[props.lang] ?? '',
  set: (v: string) => {
    const next = { ...(model.value ?? {}) }
    if (v) next[props.lang] = v
    else delete next[props.lang]
    model.value = Object.keys(next).length ? next : undefined
  },
})
const fallback = computed(() => props.lang === props.main ? '' : model.value?.[props.main] ?? '')
const missing = computed(() => !!fallback.value && !value.value)
</script>

<template>
  <div class="grid gap-1">
  <Field :label="label" :hint="hint">
    <template #default>
      <Textarea v-if="multiline" v-model="value" :rows="rows ?? 4" :placeholder="fallback" :class="missing ? 'border-dashed border-wd-amber-500' : ''" />
      <Input v-else v-model="value" :placeholder="fallback" :class="missing ? 'border-dashed border-wd-amber-500' : ''" />
    </template>
  </Field>
  <p v-if="missing" class="text-[11px] font-bold text-wd-amber-800">Not in {{ lang.toUpperCase() }} yet: visitors see the {{ main.toUpperCase() }} text.</p>
  </div>
</template>

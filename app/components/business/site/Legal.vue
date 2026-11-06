<script setup lang="ts">
/**
 * Who runs the website (hosted websites v1): the details its Impressum and
 * privacy page show. A German business site must have an Impressum, so these
 * are required before such a site is published (step 6).
 */
import { Wand2 } from 'lucide-vue-next'
import type { SiteLegal } from '#shared/types/profileSite'

const props = defineProps<{ hints: { name: string; address: string; email: string; phone: string } }>()
const legal = defineModel<SiteLegal | undefined>()

function set(key: keyof SiteLegal, v: unknown) {
  const next: SiteLegal = { ...(legal.value ?? {}), [key]: String(v ?? '') }
  for (const k of Object.keys(next) as (keyof SiteLegal)[]) if (!next[k]?.trim()) delete next[k]
  legal.value = Object.keys(next).length ? next : undefined
}
const canFill = computed(() => (['name', 'address', 'email', 'phone'] as const).some(k => props.hints[k] && !legal.value?.[k]))
function fill() {
  const next: SiteLegal = { ...(legal.value ?? {}) }
  for (const k of ['name', 'address', 'email', 'phone'] as const) if (!next[k] && props.hints[k]) next[k] = props.hints[k]
  legal.value = next
}
</script>

<template>
  <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Legal details</h2>
        <p class="mt-1 max-w-xl text-sm text-muted-foreground">Who runs the site, for its Impressum and privacy page. In Germany every business website needs an Impressum; these details appear there exactly as you write them.</p>
      </div>
      <Button v-if="canFill" type="button" variant="outline" size="sm" @click="fill"><Wand2 /> Fill in from my page</Button>
    </div>
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label="Name" hint="The person or business responsible, e.g. “Salsa School GmbH” or your full name.">
        <Input :model-value="legal?.name ?? ''" @update:model-value="set('name', $event)" />
      </Field>
      <Field label="Email">
        <Input :model-value="legal?.email ?? ''" type="email" @update:model-value="set('email', $event)" />
      </Field>
      <Field label="Address" hint="Street and number, postcode and city. A PO box isn't enough." class="sm:col-span-2">
        <Textarea :model-value="legal?.address ?? ''" :rows="2" @update:model-value="set('address', $event)" />
      </Field>
      <Field label="Phone" optional>
        <Input :model-value="legal?.phone ?? ''" type="tel" @update:model-value="set('phone', $event)" />
      </Field>
      <Field label="VAT id" hint="USt-IdNr., if you have one." optional>
        <Input :model-value="legal?.vatId ?? ''" placeholder="DE123456789" @update:model-value="set('vatId', $event)" />
      </Field>
      <Field label="Register" hint="If the business is registered, e.g. “Amtsgericht München, HRB 12345”." optional>
        <Input :model-value="legal?.register ?? ''" @update:model-value="set('register', $event)" />
      </Field>
      <Field label="Responsible for the content" hint="Name and address, if not the same as above." optional>
        <Input :model-value="legal?.responsible ?? ''" @update:model-value="set('responsible', $event)" />
      </Field>
    </div>
  </section>
</template>

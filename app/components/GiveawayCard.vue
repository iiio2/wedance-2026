<script setup lang="ts">
/**
 * A single active giveaway (native ad product). Shows the sponsor, prize, and a
 * free-entry email form calling `giveaway.enter`. Free-entry only — no purchase,
 * no payment. Links to the sponsor's promoted event (ctaUrl) and a T&C stub.
 */
import { Gift, ExternalLink, CheckCircle2 } from 'lucide-vue-next'
import { GiveawayEntrySchema } from '#shared/validation'
import { WD } from '~/lib/brand'

interface Giveaway {
  id: string
  sponsorName: string
  title: string
  description: string
  prizeDescription: string
  ctaUrl: string
  imageUrl: string | null
  termsUrl: string | null
  startsAt: string | Date
  endsAt: string | Date
}

const props = defineProps<{
  giveaway: Giveaway
  accent?: string
}>()

const { $trpc } = useNuxtApp()
const accent = computed(() => props.accent ?? WD.green600)

const email = ref('')
const entering = ref(false)
const entered = ref(false)
const already = ref(false)
const error = ref<string | null>(null)
const { errors, validate, fieldAttrs } = useFormValidation(GiveawayEntrySchema, () => ({ email: email.value }))

async function enter() {
  error.value = null
  const result = validate()
  if (!result.success) return
  entering.value = true
  try {
    const res = await $trpc.giveaway.enter.mutate({
      giveawayId: props.giveaway.id,
      ...result.data,
    })
    entered.value = true
    already.value = res.alreadyEntered
    if (!res.alreadyEntered) useTrack().track('giveaway_entered', { giveaway_id: props.giveaway.id })
  } catch (e: any) {
    error.value = e?.message ?? 'Could not enter. Try again.'
  } finally {
    entering.value = false
  }
}

const endsLabel = computed(() => {
  const d = new Date(props.giveaway.endsAt)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border bg-white"
    :style="{ borderColor: accent + '55', boxShadow: '0 1px 0 ' + accent + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
  >
    <div class="h-1.5" :style="{ background: accent }" />
    <div class="p-5">
      <div class="flex items-start gap-4">
        <img
          v-if="giveaway.imageUrl"
          :src="giveaway.imageUrl"
          :alt="giveaway.sponsorName"
          class="h-14 w-14 shrink-0 rounded-xl object-cover shadow-sm"
        >
        <div
          v-else
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          :style="{ background: accent }"
        >
          <Gift class="h-6 w-6" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-eyebrow uppercase tracking-[0.3em] font-bold" :style="{ color: accent }">
            Giveaway · {{ giveaway.sponsorName }}
          </div>
          <h3 class="mt-1 text-lg font-bold leading-tight text-foreground font-display">
            {{ giveaway.title }}
          </h3>
          <p class="mt-1 text-sm text-muted-foreground font-sans">
            {{ giveaway.description }}
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-sans">
            <span class="inline-flex items-center gap-1 font-bold" :style="{ color: accent }">
              <Gift class="h-3 w-3" /> {{ giveaway.prizeDescription }}
            </span>
            <span>Ends {{ endsLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Entry -->
      <div class="mt-4">
        <div v-if="entered" class="flex items-center gap-2 rounded-lg p-3" :style="{ background: accent + '14' }">
          <CheckCircle2 class="h-5 w-5 shrink-0" :style="{ color: accent }" />
          <p class="text-sm font-medium text-foreground font-sans">
            {{ already ? "You're already entered — good luck!" : "You're in! We'll email the winner." }}
          </p>
        </div>

        <form v-else class="flex flex-col gap-2 sm:flex-row sm:items-start" novalidate @submit.prevent="enter">
          <Field :id="`giveaway-${giveaway.id}-email`" label="Your email" hide-label :error="errors.email" class="min-w-0 flex-1 gap-1">
            <Input
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="Your email"
              class="rounded-full px-4"
              v-bind="fieldAttrs('email', `giveaway-${giveaway.id}-email-error`)"
            />
          </Field>
          <Button type="submit" variant="pill" :accent="accent" class="h-11 shrink-0 px-5" :loading="entering">
            {{ entering ? 'Entering…' : 'Enter free' }}
          </Button>
        </form>
        <p v-if="error" role="alert" class="mt-1 text-xs text-primary font-sans">
          {{ error }}
        </p>

        <div class="mt-2 flex items-center justify-between text-meta text-secondary font-sans">
          <a :href="giveaway.ctaUrl" class="inline-flex items-center gap-1 hover:underline">
            <ExternalLink class="h-3 w-3" /> About {{ giveaway.sponsorName }}
          </a>
          <a v-if="giveaway.termsUrl" :href="giveaway.termsUrl" class="hover:underline">
            Terms &amp; conditions
          </a>
        </div>
        <p class="mt-1 text-eyebrow text-secondary font-sans">
          Free entry. No purchase necessary.
        </p>
      </div>
    </div>
  </div>
</template>

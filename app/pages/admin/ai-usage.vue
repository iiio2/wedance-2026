<script setup lang="ts">
/**
 * /admin/ai-usage — every AI call (ai_usage): what it was for, what it cost
 * (from Google's price list, shared/utils/aiPricing.ts), how long it took and
 * what failed. Totals, per purpose (click one to filter), per day, and the
 * latest calls with their event and who asked.
 */
import { Cpu, AlertTriangle, Check, X } from 'lucide-vue-next'
import { PRICES_CHECKED } from '#shared/utils/aiPricing'

definePageMeta({ layout: 'admin' })
useHead({ title: 'AI usage | Admin | WeDance' })

const { $trpc } = useNuxtApp()
type Data = Awaited<ReturnType<typeof $trpc.admin.aiUsage.query>>
const data = ref<Data | null>(null)
const error = ref<string | null>(null)
const days = ref(30)
const purpose = ref<string | null>(null)
async function load() {
  try {
    data.value = await $trpc.admin.aiUsage.query({ days: days.value, purpose: purpose.value ?? undefined })
    error.value = null
  } catch (e: any) { error.value = e?.message || 'Couldn’t load the usage log.' }
}
watch([days, purpose], load)
onMounted(load)

// Cents and below show four decimals ($0.0037): most single calls cost less than a cent.
const usd = (n: number | null | undefined, digits?: number) => {
  if (n == null) return '—'
  const d = digits ?? (n !== 0 && Math.abs(n) < 1 ? 4 : 2)
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
}
const secs = (ms: number | null | undefined) => ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
const num = (n: number) => n.toLocaleString('en-GB')
const when = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const maxDay = computed(() => Math.max(0.0001, ...(data.value?.byDay ?? []).map(d => d.cost)))
const rangeCost = computed(() => (data.value?.byPurpose ?? []).reduce((n, p) => n + p.cost, 0))
const rangeCalls = computed(() => (data.value?.byPurpose ?? []).reduce((n, p) => n + p.calls, 0))
</script>

<template>
  <div>
    <AdminPageHeader title="AI usage" :description="`Every AI call: what it was for, what it cost and how long it took. Prices from Google’s list, checked ${PRICES_CHECKED}.`" />
    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-else-if="!data" kind="loading" />
    <template v-else>
      <!-- Totals -->
      <section class="mt-6 grid gap-3 sm:grid-cols-4">
        <div v-for="t in [{ label: 'Today', v: data.totals.today }, { label: 'Last 7 days', v: data.totals.week }, { label: 'Last 30 days', v: data.totals.month }]" :key="t.label" class="rounded-2xl border bg-card p-4">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary">{{ t.label }}</p>
          <p class="mt-1 font-display text-2xl font-bold tabular-nums">{{ usd(t.v) }}</p>
        </div>
        <div class="rounded-2xl border bg-card p-4">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary">Calls, 30 days</p>
          <p class="mt-1 font-display text-2xl font-bold tabular-nums">{{ num(data.totals.calls30) }}</p>
          <p v-if="data.totals.unpriced30" class="text-xs text-wd-amber-600">{{ data.totals.unpriced30 }} with no price (model not in the list)</p>
        </div>
      </section>

      <!-- Range -->
      <div class="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <span class="text-muted-foreground">Showing</span>
        <Button v-for="d in [1, 7, 30, 90]" :key="d" type="button" size="sm" :variant="days === d ? 'soft' : 'outline'" :aria-pressed="days === d" @click="days = d">{{ d === 1 ? 'Today' : `${d} days` }}</Button>
        <span v-if="purpose" class="ml-2 inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 font-bold">{{ purpose }} <button type="button" aria-label="Show every purpose" @click="purpose = null"><X class="size-3.5" /></button></span>
        <span class="ml-auto text-muted-foreground">{{ num(rangeCalls) }} {{ rangeCalls === 1 ? 'call' : 'calls' }} · {{ usd(rangeCost) }}</span>
      </div>

      <!-- Per purpose -->
      <section class="mt-3 overflow-x-auto rounded-2xl border bg-card">
        <table class="w-full min-w-[46rem] text-sm">
          <thead class="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr class="border-b"><th class="p-3">What</th><th class="p-3 text-right">Calls</th><th class="p-3 text-right">Refused</th><th class="p-3 text-right">Errors</th><th class="p-3 text-right">Avg</th><th class="p-3 text-right">Slowest 5%</th><th class="p-3 text-right">Tokens in / text / image</th><th class="p-3 text-right">Cost</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in data.byPurpose" :key="p.purpose" class="cursor-pointer border-b last:border-0 hover:bg-muted/50" @click="purpose = purpose === p.purpose ? null : p.purpose">
              <td class="p-3 font-bold">{{ p.purpose }}</td>
              <td class="p-3 text-right tabular-nums">{{ num(p.calls) }}</td>
              <td class="p-3 text-right tabular-nums" :class="p.refused ? 'text-wd-amber-600 font-bold' : 'text-muted-foreground'">{{ p.refused }}<span v-if="p.refused" class="font-normal"> ({{ Math.round(p.refused / p.calls * 100) }}%)</span></td>
              <td class="p-3 text-right tabular-nums" :class="p.errors ? 'text-destructive font-bold' : 'text-muted-foreground'">{{ p.errors }}</td>
              <td class="p-3 text-right tabular-nums">{{ secs(p.avg_ms) }}</td>
              <td class="p-3 text-right tabular-nums">{{ secs(p.p95_ms) }}</td>
              <td class="p-3 text-right tabular-nums text-muted-foreground">{{ num(p.input_tokens) }} / {{ num(p.text_tokens) }} / {{ num(p.image_tokens) }}</td>
              <td class="p-3 text-right font-bold tabular-nums">{{ usd(p.cost) }}</td>
            </tr>
            <tr v-if="!data.byPurpose.length"><td colspan="8" class="p-4 text-center text-muted-foreground">No AI calls in this range.</td></tr>
          </tbody>
        </table>
      </section>

      <!-- Per day -->
      <section v-if="data.byDay.length > 1" class="mt-6 rounded-2xl border bg-card p-4">
        <p class="text-sm font-bold">Cost per day</p>
        <div class="mt-3 flex h-32 items-end gap-1" role="img" :aria-label="`Cost per day over ${data.days} days`">
          <div v-for="d in data.byDay" :key="d.day" class="group relative flex-1">
            <div class="w-full rounded-t bg-primary/70" :style="{ height: `${Math.max(2, d.cost / maxDay * 120)}px` }" />
            <span class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] text-background group-hover:block">{{ d.day }} · {{ usd(d.cost) }} · {{ d.calls }} calls{{ d.failed ? ` · ${d.failed} failed` : '' }}</span>
          </div>
        </div>
        <div class="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>{{ data.byDay[0]?.day }}</span><span>{{ data.byDay[data.byDay.length - 1]?.day }}</span></div>
      </section>

      <!-- Latest calls -->
      <section class="mt-6 overflow-x-auto rounded-2xl border bg-card">
        <p class="p-3 text-sm font-bold">Latest calls</p>
        <table class="w-full min-w-[44rem] text-sm">
          <thead class="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr class="border-y"><th class="p-3">When</th><th class="p-3">What</th><th class="p-3">Event · who</th><th class="p-3">Result</th><th class="p-3 text-right">Time</th><th class="p-3 text-right">Tokens</th><th class="p-3 text-right">Cost</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in data.recent" :key="r.id" class="border-b align-top last:border-0">
              <td class="whitespace-nowrap p-3 tabular-nums text-muted-foreground">{{ when(r.createdAt) }}</td>
              <td class="max-w-[14rem] p-3"><span class="font-bold">{{ r.purpose }}</span><span class="block truncate text-xs text-muted-foreground" :title="`${r.source ?? ''} · ${r.modelVersion || r.model}`">{{ r.source || '—' }} · {{ r.modelVersion || r.model }}</span></td>
              <td class="p-3">
                <NuxtLink v-if="r.eventId" :to="`/business/events/${r.eventId}`" class="font-bold hover:underline">{{ r.eventName || 'An event' }}</NuxtLink><span v-else class="text-muted-foreground">—</span>
                <span v-if="r.dancerName" class="block text-xs text-muted-foreground">{{ r.dancerName }}</span>
              </td>
              <td class="p-3">
                <span v-if="r.status === 'ok'" class="inline-flex items-center gap-1 text-wd-green-700"><Check class="size-3.5" aria-hidden="true" /> ok</span>
                <span v-else-if="r.status === 'refused'" class="inline-flex items-center gap-1 font-bold text-wd-amber-600"><AlertTriangle class="size-3.5" aria-hidden="true" /> refused</span>
                <span v-else class="inline-flex items-center gap-1 font-bold text-destructive"><X class="size-3.5" aria-hidden="true" /> error</span>
                <span v-if="r.error" class="block max-w-[16rem] truncate text-xs text-muted-foreground" :title="r.error">{{ r.error }}</span>
              </td>
              <td class="p-3 text-right tabular-nums">{{ secs(r.durationMs) }}</td>
              <td class="p-3 text-right tabular-nums text-muted-foreground">{{ num(r.inputTokens) }} → {{ num(r.textTokens) }}<template v-if="r.imageTokens"> + {{ num(r.imageTokens) }} img</template></td>
              <td class="p-3 text-right font-bold tabular-nums">{{ usd(r.cost) }}</td>
            </tr>
            <tr v-if="!data.recent.length"><td colspan="7" class="p-4 text-center text-muted-foreground"><Cpu class="mx-auto mb-1 size-5" aria-hidden="true" />No AI calls yet in this range.</td></tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

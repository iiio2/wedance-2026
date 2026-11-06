<script setup lang="ts">
/**
 * /settings/connections — assistants (Claude, ChatGPT…) the dancer connected
 * to WeDance over MCP: what each may do, for which pages, when it was last
 * used, and Revoke (ends every token of that connection at once).
 */
import { ArrowLeft, Plug, Check } from 'lucide-vue-next'

definePageMeta({ layout: false })
useHead({ title: 'WeDance — Connected apps' })

const { $trpc } = useNuxtApp()
const { isSignedIn, isLoading } = useAuth()

type Row = Awaited<ReturnType<typeof $trpc.oauth.connections.query>>[number]
const rows = ref<Row[] | null>(null)
const error = ref('')
const revoking = ref<string | null>(null)
const revoked = ref<string | null>(null)

async function load() {
  error.value = ''
  try { rows.value = await $trpc.oauth.connections.query() } catch (e: any) { error.value = e?.message || 'Couldn’t load your connected apps.' }
}

watch([isLoading, isSignedIn], ([loading, signedIn]) => {
  if (loading) return
  if (!signedIn) navigateTo('/')
  else load()
}, { immediate: true })

async function revoke(row: Row) {
  if (!confirm(`Disconnect ${row.app.name}? It loses access right away; to use it again you connect it again.`)) return
  revoking.value = row.id
  try {
    await $trpc.oauth.revokeConnection.mutate({ id: row.id })
    revoked.value = row.app.name
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t disconnect it. Try again.'
  } finally {
    revoking.value = null
  }
}

const fmt = (d: Date | string | null) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not used yet'
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main class="max-w-lg mx-auto px-4 pt-12 pb-16 font-sans">
      <NuxtLink to="/settings" class="inline-flex items-center gap-1.5 text-xs font-bold text-wd-red-800">
        <ArrowLeft class="w-3.5 h-3.5" aria-hidden="true" /> Settings
      </NuxtLink>
      <h1 class="mt-3 text-4xl text-foreground font-display">Connected apps</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Assistants like Claude or ChatGPT you let use your WeDance account.
        <NuxtLink to="/docs/connect-ai" class="font-bold text-wd-red-800">How to connect one</NuxtLink>
      </p>

      <p v-if="revoked" role="status" class="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-wd-green-600">
        <Check class="w-4 h-4" aria-hidden="true" /> {{ revoked }} is disconnected.
      </p>
      <p v-if="error" role="alert" class="mt-6 text-sm font-bold text-primary">{{ error }}</p>

      <p v-if="rows === null && !error" class="mt-8 text-sm text-muted-foreground" aria-busy="true">Loading…</p>

      <div v-else-if="rows && !rows.length" class="mt-8 rounded-xl border border-dashed border-border p-6 text-center">
        <Plug class="mx-auto w-8 h-8 text-muted-foreground" aria-hidden="true" />
        <p class="mt-2 text-sm font-bold text-foreground">No apps connected</p>
        <p class="mt-1 text-xs text-muted-foreground">Add WeDance to Claude or ChatGPT and it shows up here.</p>
      </div>

      <ul v-else-if="rows" class="mt-8 space-y-4">
        <li v-for="row in rows" :key="row.id" class="rounded-xl border border-border bg-card p-4 shadow-wd-card">
          <div class="flex items-start gap-3">
            <img v-if="row.app.logo" :src="row.app.logo" alt="" class="w-10 h-10 rounded-lg object-cover" referrerpolicy="no-referrer">
            <div v-else class="flex w-10 h-10 items-center justify-center rounded-lg bg-muted"><Plug class="w-5 h-5 text-secondary" aria-hidden="true" /></div>
            <div class="flex-1 min-w-0">
              <h2 class="text-base font-bold text-foreground font-sans">{{ row.app.name }}</h2>
              <p class="text-meta text-muted-foreground">
                <span v-if="row.app.domain">{{ row.app.domain }} · </span>Connected {{ fmt(row.createdAt) }} · Last used {{ fmt(row.lastUsedAt) }}
              </p>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">May</div>
            <ul class="mt-1 space-y-0.5 text-sm text-foreground">
              <li v-for="s in row.scopes" :key="s.id">{{ s.title }}</li>
            </ul>
          </div>
          <div v-if="row.allProfiles || row.profiles.length" class="mt-3">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">For</div>
            <p class="mt-1 text-sm text-foreground">{{ row.allProfiles ? 'All my pages, including ones I add later' : row.profiles.map((p: any) => p.name).join(', ') }}</p>
          </div>
          <Button
            variant="destructive"
            size="pill-sm"
            class="mt-4"
            :loading="revoking === row.id"
            :disabled="!!revoking"
            @click="revoke(row)"
          >Revoke</Button>
        </li>
      </ul>
    </main>

    <SiteFooter />
  </div>
</template>

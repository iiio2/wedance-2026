<script setup lang="ts">
import type { Architecture } from '../../../../scripts/architecture/generate'

/**
 * Admin-only half of the API catalog. Nothing admin-level is in the public
 * bundle: the data is fetched at runtime from /api/architecture/admin, which
 * checks is_admin with the same session as the tRPC adminProcedure.
 */
definePageMeta({ layout: 'architecture' })

type AdminCatalog = Architecture['admin']
const state = ref<'loading' | 'ok' | 'denied' | 'error'>('loading')
const catalog = ref<AdminCatalog | null>(null)
const showSignIn = ref(false)

async function load() {
  state.value = 'loading'
  // Read the session cookie fresh each time (it changes after signing in here).
  const raw = document.cookie.match(/(?:^|;\s*)wedance-session=([^;]*)/)?.[1]
  const token = raw ? decodeURIComponent(raw).replace(/^"|"$/g, '') : null
  // No session → not an admin; skip the request (and its 401).
  if (!token) { state.value = 'denied'; return }
  try {
    catalog.value = await $fetch<AdminCatalog>('/api/architecture/admin', {
      headers: { authorization: `Bearer ${token}` },
    })
    state.value = 'ok'
  }
  catch (err: any) {
    state.value = [401, 403].includes(err?.statusCode ?? err?.response?.status) ? 'denied' : 'error'
  }
}
onMounted(load)
watch(showSignIn, open => { if (!open) load() })
</script>

<template>
  <DesignPage
    eyebrow="Admin only"
    site="WeDance Architecture"
    title="Admin API catalog"
    lead="Admin-level tRPC procedures. Served at runtime to admins only; never part of the public build."
  >
    <p v-if="state === 'loading'" class="text-muted-foreground">Checking access…</p>
    <div v-else-if="state === 'denied'" class="rounded-2xl border border-border bg-card p-6">
      <p class="font-bold">Admins only.</p>
      <p class="text-sm text-muted-foreground mt-1">Sign in with an admin account to see this catalog.</p>
      <button type="button" class="mt-3 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground" @click="showSignIn = true">Sign in</button>
      <SignUpModal v-model:open="showSignIn" action="signin" />
    </div>
    <p v-else-if="state === 'error'" class="text-destructive">Could not load the admin catalog.</p>
    <template v-else-if="catalog">
      <DesignSection id="procedures" :title="`Procedures (${catalog.procedures.length})`">
        <div class="space-y-3">
          <ArchProcedure v-for="p in catalog.procedures" :key="p.path" :proc="p" />
        </div>
      </DesignSection>
      <DesignSection id="unmapped" title="Not referenced by any story">
        <p v-if="!catalog.unmappedProcedures.length" class="text-sm text-muted-foreground">Every admin procedure is referenced by a story.</p>
        <ul v-else class="flex flex-wrap gap-1.5">
          <li v-for="p in catalog.unmappedProcedures" :key="p" class="rounded-md border border-border px-1.5 py-0.5 font-mono text-[12px]">{{ p }}</li>
        </ul>
      </DesignSection>
    </template>
  </DesignPage>
</template>

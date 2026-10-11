<script setup lang="ts">
import type { PropType } from 'vue'
/**
 * Loading / error / empty block shared by admin list pages, so every page
 * says "Loading…", shows an error and an empty queue the same way.
 *
 *   <AdminState v-if="loading" kind="loading" message="Loading queue…" />
 *   <AdminState v-else-if="!items.length" kind="empty" message="No giveaways yet." hint="Create one with “New”." />
 */
import { Loader2 } from 'lucide-vue-next'

// Runtime props on purpose — see ui/button/Button.vue.
defineProps({
  kind: { type: String as PropType<'loading' | 'error' | 'empty'>, required: true },
  message: { type: String, default: undefined },
  hint: { type: String, default: undefined },
})
</script>

<template>
  <div v-if="kind === 'loading'" role="status" class="flex items-center justify-center gap-2 py-16 text-sm text-secondary">
    <Loader2 class="size-5 animate-spin" aria-hidden="true" /> {{ message || 'Loading…' }}
  </div>
  <div
    v-else-if="kind === 'error'"
    role="alert"
    class="mt-6 rounded-xl border border-destructive/30 bg-wd-red-50 p-4 text-sm text-wd-red-900"
  >
    {{ message }}
    <div v-if="$slots.default" class="mt-3"><slot /></div>
  </div>
  <div v-else class="mt-8 rounded-2xl border-2 border-dashed border-input bg-card/60 p-10 text-center">
    <p class="text-sm font-bold text-foreground">{{ message }}</p>
    <p v-if="hint" class="mt-1 text-xs text-muted-foreground">{{ hint }}</p>
    <slot />
  </div>
</template>

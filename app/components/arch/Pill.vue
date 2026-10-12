<script setup lang="ts">
/** Small label for auth levels, kinds and story statuses on /docs/architecture. */
const props = defineProps<{ tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }>()
const styles = {
  neutral: 'bg-muted text-muted-foreground border-border',
  good: 'bg-success/12 text-wd-green-700 border-success/30',
  warn: 'bg-warning/15 text-wd-amber-800 border-warning/40',
  bad: 'bg-destructive/10 text-wd-red-800 border-destructive/30',
  info: 'bg-accent text-foreground border-border',
} as const
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-sans"
    :class="styles[props.tone ?? 'neutral']"
  ><slot /></span>
</template>

<script setup lang="ts">
import { WD } from '~/lib/brand'

/**
 * Renders a Mermaid diagram client-side. Mermaid is loaded on demand from a
 * pinned CDN build (no npm dependency, nothing added to other pages' bundles).
 * The source stays in the DOM as a <details> fallback for no-JS / failures.
 */
const props = defineProps<{ code: string, label: string }>()

const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs'
let loader: Promise<any> | null = null
function loadMermaid() {
  loader ??= import(/* @vite-ignore */ MERMAID_URL).then((m) => {
    const mermaid = m.default
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: 'var(--wd-font-sans)',
      themeVariables: {
        primaryColor: WD.cream,
        primaryBorderColor: WD.brown700,
        primaryTextColor: WD.brown950,
        lineColor: WD.brown600,
        secondaryColor: WD.sand100,
        tertiaryColor: WD.amber100,
      },
      er: { useMaxWidth: false },
      flowchart: { useMaxWidth: true },
    })
    return mermaid
  })
  return loader
}

const svg = ref('')
const error = ref('')
let seq = 0

async function render() {
  try {
    const mermaid = await loadMermaid()
    const id = `arch-mmd-${Math.random().toString(36).slice(2)}-${seq++}`
    const out = await mermaid.render(id, props.code)
    svg.value = out.svg
    error.value = ''
  }
  catch (err) {
    error.value = (err as Error).message || 'Diagram failed to render'
  }
}

onMounted(render)
watch(() => props.code, render)
</script>

<template>
  <figure class="rounded-2xl border border-border bg-card p-4">
    <div
      v-if="svg"
      role="img"
      :aria-label="label"
      class="overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-none"
      v-html="svg"
    />
    <p v-else-if="!error" class="text-sm text-muted-foreground py-8 text-center">Rendering diagram…</p>
    <p v-if="error" class="text-sm text-destructive">Diagram could not be rendered: {{ error }}</p>
    <details class="mt-3 text-sm">
      <summary class="cursor-pointer text-muted-foreground hover:text-foreground">Diagram source</summary>
      <pre class="mt-2 overflow-x-auto rounded-xl bg-muted p-3 text-[12px] font-mono">{{ code }}</pre>
    </details>
  </figure>
</template>

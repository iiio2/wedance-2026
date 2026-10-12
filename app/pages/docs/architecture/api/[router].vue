<script setup lang="ts">
import { sourceUrl } from '~/lib/architecture-nav'

definePageMeta({ layout: 'docs' })

const route = useRoute()
const { api } = useArchitecture()
const router = computed(() => api.routers.find(r => r.name === route.params.router))
if (!router.value) throw createError({ statusCode: 404, statusMessage: 'Unknown router', fatal: true })
const procs = computed(() => api.procedures.filter(p => p.router === router.value!.name))
</script>

<template>
  <DesignPage
    v-if="router"
    eyebrow="tRPC router"
    site="WeDance Architecture"
    :title="router.name"
    :lead="router.summary ?? undefined"
  >
    <DesignSection id="procedures" :title="`Procedures (${procs.length})`">
      <div class="space-y-3">
        <ArchProcedure v-for="p in procs" :key="p.path" :proc="p" />
      </div>
    </DesignSection>
    <p class="text-sm text-muted-foreground">
      Source: <a :href="sourceUrl(router.file)" class="font-bold text-primary hover:underline">{{ router.file }}</a>
    </p>
  </DesignPage>
</template>

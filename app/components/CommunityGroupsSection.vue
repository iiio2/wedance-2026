<script setup lang="ts">
/**
 * Community groups (WhatsApp / Telegram / …) for a city — the cold-start
 * directory shown when WeDance has no events there yet. Client-side fetch.
 */
import { MessageCircle, ArrowUpRight, BadgeCheck, Flag } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'

const props = defineProps<{ citySlug: string; cityName?: string }>()
const { $trpc } = useNuxtApp()

const groups = ref<any[]>([])
const loading = ref(true)
const reportingId = ref<string | null>(null)

async function load() {
  loading.value = true
  try { groups.value = await $trpc.communityGroup.listByCity.query({ citySlug: props.citySlug }) }
  catch { groups.value = [] } finally { loading.value = false }
}

async function reportGroup(groupId: string) {
  const confirmed = window.confirm(
    'Are you sure you want to report this group? ' +
    'If it receives multiple reports, it will be hidden from this listing.'
  )
  if (!confirmed) return

  reportingId.value = groupId
  try {
    const result = await $trpc.communityGroup.report.mutate({ groupId })
    // Remove from display if hidden
    if (result.hidden) {
      groups.value = groups.value.filter(g => g.id !== groupId)
    }
  } catch (error) {
    console.error('Failed to report group:', error)
  } finally {
    reportingId.value = null
  }
}

onMounted(load)

const platformLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', telegram: 'Telegram', facebook: 'Facebook', other: 'Group',
}
</script>

<template>
  <!-- Hidden only while loading; an empty city gets an empty state, not silence. -->
  <section v-if="!loading" class="border-t border-border bg-background/50">
    <div class="max-w-4xl mx-auto px-4 py-12 font-sans">
      <div class="flex items-center gap-2">
        <MessageCircle class="w-5 h-5 text-success" aria-hidden="true" />
        <h2 class="text-2xl font-display text-foreground">Local groups</h2>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">
        Community chats where the{{ cityName ? ` ${cityName}` : '' }} scene organises — WhatsApp, Telegram &amp; more. Join the locals.
      </p>

      <ul v-if="groups.length" class="mt-4 grid gap-2 sm:grid-cols-2">
        <li v-for="g in groups" :key="g.id" class="relative">
          <div class="group relative">
            <a :href="g.inviteUrl" target="_blank" rel="noopener"
               data-outbound-kind="community_group" data-object-type="community_group" :data-object-id="g.id" :data-city="citySlug"
               class="flex items-center justify-between gap-3 rounded-xl border p-3 bg-white transition-all hover:-translate-y-0.5 border-wd-green-600/20">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-sm truncate text-foreground">{{ g.name }}</span>
                  <BadgeCheck v-if="g.verified" class="w-3.5 h-3.5 shrink-0 text-success" aria-label="Verified" />
                </div>
                <div class="text-meta mt-0.5 text-secondary">
                  {{ platformLabel[g.platform] || 'Group' }}<span v-if="g.styles?.length"> · {{ g.styles.join(', ') }}</span>
                </div>
              </div>
              <ArrowUpRight class="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-success" aria-hidden="true" />
            </a>
            <Button
              type="button"
              variant="ghost"
              :disabled="reportingId === g.id"
              class="absolute top-2 right-2 h-auto w-auto p-1.5 rounded-lg transition-all opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 bg-primary/10 hover:bg-primary/15 [&_svg]:size-3.5"
              title="Report broken invite link or inactive group"
              :aria-label="`Report ${g.name} (broken link or inactive)`"
              @click.prevent="reportGroup(g.id)"
            >
              <Flag aria-hidden="true" :class="reportingId === g.id ? 'text-wd-gray-500' : 'text-primary'" />
            </Button>
          </div>
        </li>
      </ul>

      <!-- Empty state: what's missing, why ("yet"), one next action. -->
      <div v-else class="mt-4 text-center py-10 px-6 rounded-2xl border-2 border-dashed border-input bg-white/50">
        <MessageCircle class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
        <p class="text-sm text-muted-foreground">
          No local groups listed{{ cityName ? ` for ${cityName}` : '' }} yet. Locals usually know the chats where the scene meets.
        </p>
        <Button as-child variant="link" class="mt-1 h-auto p-0 text-xs font-bold underline">
          <NuxtLink :to="`/cities/${citySlug}#ask-locals`">Ask the locals</NuxtLink>
        </Button>
      </div>
    </div>
  </section>
</template>

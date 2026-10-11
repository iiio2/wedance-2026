<script setup lang="ts">
import { UtensilsCrossed, MessageCircle, Eye, RefreshCw, ChevronDown } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'

const route = useRoute()
const slug = route.params.slug as string
const { $trpc } = useNuxtApp()

definePageMeta({ layout: 'admin' })
useHead({ title: `Admin: ${slug} | WeDance` })

// Auth uses the signed-in admin session (gated by the `admin` layout). The old hardcoded
// `$setAuthToken('admin@wedance.vip')` was broken — that token has no `sessions`
// row, so every adminProcedure call returned FORBIDDEN.

// State
const selectedDinnerId = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

type AdminDinner = {
  id: string
  day: string
  date: string | null
  timeSlot: string
  restaurant: string | null
  restaurantAddress: string | null
  revealDate: string | null
  maxSize: number
  signupCount: number
}

type DinnerSignup = {
  signupId: string
  dancerId: string
  name: string
  email: string
  photo: string | null
}

type DinnerGroup = {
  id: string
  chatLink: string | null
  members: { id: string; name: string; photo: string | null; email: string }[]
}

const dinners = ref<AdminDinner[]>([])
const signups = ref<Record<string, DinnerSignup[]>>({})
const groups = ref<Record<string, DinnerGroup[]>>({})

async function loadDinners() {
  loading.value = true
  error.value = null
  try {
    const result = await $trpc.admin.listDinners.query({ festivalSlug: slug })
    dinners.value = result
  } catch (e: any) {
    error.value = e.message || 'Failed to load dinners'
  } finally {
    loading.value = false
  }
}

async function loadSignups(dinnerId: string) {
  try {
    const result = await $trpc.admin.dinnerSignups.query({ dinnerId })
    signups.value[dinnerId] = result
  } catch (e: any) {
    console.error('Failed to load signups:', e)
  }
}

async function loadGroups(dinnerId: string) {
  try {
    const result = await $trpc.admin.dinnerGroups.query({ dinnerId })
    groups.value[dinnerId] = result
  } catch (e: any) {
    console.error('Failed to load groups:', e)
  }
}

async function selectDinner(id: string) {
  if (selectedDinnerId.value === id) {
    selectedDinnerId.value = null
    return
  }
  selectedDinnerId.value = id
  await Promise.all([loadSignups(id), loadGroups(id)])
}

async function assignGroups(dinnerId: string) {
  try {
    await $trpc.admin.assignGroups.mutate({ dinnerId, groupSize: 5 })
    await loadGroups(dinnerId)
  } catch (e: any) {
    console.error('Failed to assign groups:', e)
  }
}

async function setChatLink(groupId: string, dinnerId: string) {
  const link = prompt('Enter WhatsApp group link:')
  if (!link) return
  try {
    await $trpc.admin.setGroupChatLink.mutate({ groupId, chatLink: link })
    await loadGroups(dinnerId)
  } catch (e: any) {
    console.error('Failed to set chat link:', e)
  }
}

async function revealRestaurant(dinnerId: string) {
  try {
    await $trpc.admin.revealRestaurant.mutate({ dinnerId })
    await loadDinners()
  } catch (e: any) {
    console.error('Failed to reveal restaurant:', e)
  }
}

onMounted(() => {
  loadDinners()
})
</script>

<template>
  <div class="space-y-6">
      <AdminPageHeader title="Festival admin" :eyebrow="slug" :back="{ to: '/admin/festivals', label: 'All festivals' }">
        <Button as-child variant="outline" size="sm">
          <NuxtLink :to="{ path: '/organizers/insights', query: { festival: slug } }">
            <Eye /> Style &amp; level mix
          </NuxtLink>
        </Button>
      </AdminPageHeader>

      <AdminState v-if="loading" kind="loading" />

      <AdminState v-else-if="error" kind="error" :message="error">
        <Button size="sm" variant="outline" @click="loadDinners">Retry</Button>
      </AdminState>

      <AdminState v-else-if="!dinners.length" kind="empty" message="No dinners found for this festival." />

      <!-- Dinners section -->
      <div v-else class="space-y-4">
        <div class="flex items-center gap-2">
          <UtensilsCrossed class="w-5 h-5 text-muted-foreground" />
          <h2 class="text-base font-semibold">Group Dinners</h2>
        </div>

        <div v-for="dinner in dinners" :key="dinner.id" class="rounded-2xl border bg-card overflow-hidden">
          <!-- Dinner header -->
          <Button
            variant="ghost"
            class="h-auto w-full justify-between gap-3 rounded-none px-4 py-3 text-left font-normal whitespace-normal hover:bg-muted/50 hover:text-foreground"
            :aria-expanded="selectedDinnerId === dinner.id"
            @click="selectDinner(dinner.id)"
          >
            <div class="flex items-center gap-3">
              <UtensilsCrossed class="size-4 text-wd-orange-500" aria-hidden="true" />
              <div class="text-left">
                <span class="text-sm font-medium">{{ dinner.day }} dinner</span>
                <span class="text-xs text-muted-foreground ml-2">{{ dinner.date }} · {{ dinner.timeSlot }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <AdminStatus tone="neutral">
                {{ dinner.signupCount }}/{{ dinner.maxSize }} signed up
              </AdminStatus>
              <AdminStatus v-if="dinner.revealDate" tone="success">
                Revealed
              </AdminStatus>
              <ChevronDown class="size-4 text-muted-foreground transition-transform" :class="selectedDinnerId === dinner.id ? 'rotate-180' : ''" aria-hidden="true" />
            </div>
          </Button>

          <!-- Dinner details (expanded) -->
          <div v-if="selectedDinnerId === dinner.id" class="border-t px-4 py-4 space-y-4">
            <!-- Restaurant info -->
            <div v-if="dinner.restaurant" class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">{{ dinner.restaurant }}</p>
                <p v-if="dinner.restaurantAddress" class="text-xs text-muted-foreground">{{ dinner.restaurantAddress }}</p>
              </div>
              <Button
                v-if="!dinner.revealDate"
                size="sm"
                variant="outline"
                class="text-xs gap-1"
                @click="revealRestaurant(dinner.id)"
              >
                <Eye class="w-3 h-3" /> Reveal to dancers
              </Button>
              <span v-else class="text-xs text-wd-green-700 font-medium">Revealed on {{ dinner.revealDate }}</span>
            </div>

            <!-- Signups -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Signups ({{ (signups[dinner.id] || []).length }})
                </p>
                <Button
                  size="sm"
                  class="text-xs h-7 gap-1"
                  :disabled="!(signups[dinner.id] || []).length"
                  @click="assignGroups(dinner.id)"
                >
                  <RefreshCw class="w-3 h-3" />
                  {{ (groups[dinner.id] || []).length ? 'Reassign' : 'Assign' }} groups
                </Button>
              </div>

              <div class="flex flex-wrap gap-2">
                <div
                  v-for="signup in signups[dinner.id] || []"
                  :key="signup.dancerId"
                  class="flex items-center gap-1.5 bg-muted rounded-full px-2 py-1"
                >
                  <span class="text-xs">{{ signup.name }}</span>
                </div>
              </div>
            </div>

            <!-- Groups -->
            <div v-if="(groups[dinner.id] || []).length" class="space-y-3">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Groups ({{ groups[dinner.id].length }})
              </p>

              <div
                v-for="(group, gi) in groups[dinner.id]"
                :key="group.id"
                class="border rounded-lg p-3 space-y-2"
              >
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium">Group {{ gi + 1 }}</p>
                  <AdminStatus tone="neutral">{{ group.members.length }} people</AdminStatus>
                </div>

                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="member in group.members"
                    :key="member.id"
                    class="flex items-center gap-1.5"
                  >
                    <div>
                      <span class="text-xs font-medium">{{ member.name }}</span>
                      <span class="text-eyebrow text-muted-foreground ml-1">{{ member.email }}</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <MessageCircle class="w-3.5 h-3.5 text-muted-foreground" />
                  <span v-if="group.chatLink" class="text-xs text-primary break-all">{{ group.chatLink }}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    class="text-xs h-6 px-2"
                    @click="setChatLink(group.id, dinner.id)"
                  >
                    {{ group.chatLink ? 'Update' : 'Set' }} WhatsApp link
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import type { Workshop, FestivalFriend, PartnerMatch, PlanEntry, DanceRole } from '~/types/festival'
import { Users, Heart, Share2, UserPlus, ChevronDown, ChevronRight, Check, Plus, MessageCircle, Handshake } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

const props = defineProps<{
  workshops: Workshop[]
  planIds: Set<string>
  plan: Map<string, PlanEntry>
  isSignedIn: boolean
  friends: FestivalFriend[]
  partnerMatches: PartnerMatch[]
}>()

const emit = defineEmits<{
  'sign-in': []
  'invite-friends': []
  'add-workshop': [id: string]
  'request-partner': [matchId: string, workshopId: string]
}>()

// Track which friend's plan is expanded
const expandedFriendId = ref<string | null>(null)

function toggleFriend(id: string) {
  expandedFriendId.value = expandedFriendId.value === id ? null : id
}

function friendWorkshops(friend: FestivalFriend) {
  return props.workshops
    .filter((w) => friend.workshopIds.includes(w.id))
    .sort((a, b) => {
      const dayOrder = ['Thursday', 'Friday', 'Saturday', 'Sunday']
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
      if (dayDiff !== 0) return dayDiff
      return a.time.localeCompare(b.time)
    })
}

function overlapCount(friend: FestivalFriend): number {
  return friend.workshopIds.filter((id) => props.planIds.has(id)).length
}

function isOverlap(workshopId: string): boolean {
  return props.planIds.has(workshopId)
}

// Partner matching
const sentRequests = ref(new Set<string>()) // "matchId:workshopId"

// Workshops where user is "looking for partner"
const lookingWorkshops = computed(() => {
  const result: { workshop: Workshop; role: DanceRole }[] = []
  for (const [id, entry] of props.plan) {
    if (entry.partnerStatus === 'looking' && entry.role) {
      const w = props.workshops.find((ws) => ws.id === id)
      if (w) result.push({ workshop: w, role: entry.role })
    }
  }
  return result.sort((a, b) => {
    const dayOrder = ['Thursday', 'Friday', 'Saturday', 'Sunday']
    const dayDiff = dayOrder.indexOf(a.workshop.day) - dayOrder.indexOf(b.workshop.day)
    if (dayDiff !== 0) return dayDiff
    return a.workshop.time.localeCompare(b.workshop.time)
  })
})

// Matches grouped by workshop (complementary role + same workshop)
function matchesForWorkshop(workshopId: string, userRole: DanceRole): PartnerMatch[] {
  const complementary = userRole === 'lead' ? 'follow' : 'lead'
  return props.partnerMatches.filter(
    (m) => m.role === complementary && m.workshopIds.includes(workshopId),
  )
}

function requestKey(matchId: string, workshopId: string) {
  return `${matchId}:${workshopId}`
}

function sendRequest(matchId: string, workshopId: string) {
  sentRequests.value = new Set([...sentRequests.value, requestKey(matchId, workshopId)])
  emit('request-partner', matchId, workshopId)
}

function isRequested(matchId: string, workshopId: string) {
  return sentRequests.value.has(requestKey(matchId, workshopId))
}

// Expanded workshop in partner matching
const expandedMatchWorkshopId = ref<string | null>(null)

function toggleMatchWorkshop(id: string) {
  expandedMatchWorkshopId.value = expandedMatchWorkshopId.value === id ? null : id
}
</script>

<template>
  <div class="space-y-6">
    <!-- Friends' Plans -->
    <div>
      <h3 class="text-base font-semibold mb-3">Friends' Plans</h3>

      <!-- Signed out -->
      <div v-if="!isSignedIn" class="rounded-lg border border-dashed p-6 text-center space-y-2">
        <Users class="w-8 h-8 text-muted-foreground mx-auto" />
        <p class="text-sm text-muted-foreground">See what your friends are attending and plan together.</p>
        <Button size="sm" variant="outline" @click="emit('sign-in')">Sign in to connect</Button>
      </div>

      <!-- Signed in with friends -->
      <div v-else-if="friends.length > 0" class="space-y-2">
        <div
          v-for="friend in friends"
          :key="friend.id"
          class="rounded-lg border"
        >
          <!-- Friend header -->
          <button
            class="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
            @click="toggleFriend(friend.id)"
          >
            <img
              :src="friend.photo"
              :alt="friend.name"
              class="w-8 h-8 rounded-full object-cover"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ friend.name }}</span>
                <Badge variant="secondary" class="text-eyebrow px-1.5 py-0">
                  {{ friend.role === 'lead' ? 'Lead' : 'Follow' }}
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ friend.workshopIds.length }} workshops
                <span v-if="overlapCount(friend) > 0" class="text-primary font-medium">
                  · {{ overlapCount(friend) }} in common
                </span>
              </p>
            </div>
            <component
              :is="expandedFriendId === friend.id ? ChevronDown : ChevronRight"
              class="w-4 h-4 text-muted-foreground shrink-0"
            />
          </button>

          <!-- Friend's workshops (expanded) -->
          <div v-if="expandedFriendId === friend.id" class="border-t px-3 pb-3">
            <div class="space-y-0">
              <div
                v-for="w in friendWorkshops(friend)"
                :key="w.id"
                class="flex items-center gap-2 py-2 border-b last:border-0"
                :class="isOverlap(w.id) ? 'bg-primary/5 -mx-3 px-3' : ''"
              >
                <Check v-if="isOverlap(w.id)" class="w-3.5 h-3.5 text-primary shrink-0" />
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-medium leading-tight">{{ w.title }}</p>
                  <p class="text-eyebrow text-muted-foreground">{{ w.day }} {{ w.time }}<span v-if="w.room"> · {{ w.room }}</span></p>
                </div>
                <Badge v-if="isOverlap(w.id)" variant="outline" class="text-eyebrow px-1.5 py-0 text-primary border-primary/30 shrink-0">
                  You too
                </Badge>
                <Button
                  v-else
                  size="sm"
                  variant="ghost"
                  class="shrink-0 text-eyebrow h-6 px-2 text-muted-foreground hover:text-primary"
                  @click="emit('add-workshop', w.id)"
                >
                  <Plus class="w-3 h-3 mr-0.5" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Invite more -->
        <button
          class="w-full rounded-lg border border-dashed p-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors group"
          @click="emit('invite-friends')"
        >
          <UserPlus class="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
          <div>
            <p class="text-xs font-medium text-muted-foreground group-hover:text-foreground">Invite friends</p>
            <p class="text-xs text-muted-foreground">Share a link so your dance crew can plan together</p>
          </div>
        </button>
      </div>

      <!-- Signed in, no friends yet -->
      <div v-else class="rounded-lg border border-dashed p-6 text-center space-y-3">
        <Users class="w-8 h-8 text-muted-foreground mx-auto" />
        <p class="text-sm text-muted-foreground">No friends at this festival yet.</p>
        <Button size="sm" variant="outline" @click="emit('invite-friends')">
          <Share2 class="w-3.5 h-3.5 mr-1.5" />
          Invite your dance crew
        </Button>
      </div>
    </div>

    <!-- Find a Partner -->
    <div>
      <h3 class="text-base font-semibold mb-3">Find a Partner</h3>

      <!-- Not signed in -->
      <div v-if="!isSignedIn" class="rounded-lg border border-dashed p-6 text-center space-y-2">
        <Heart class="w-8 h-8 text-muted-foreground mx-auto" />
        <p class="text-sm text-muted-foreground">Find dance partners attending this festival. Match by style, level, and role.</p>
        <Button size="sm" variant="outline" @click="emit('sign-in')">Sign in to match</Button>
      </div>

      <!-- Signed in but no workshops marked as "looking" -->
      <div v-else-if="lookingWorkshops.length === 0" class="rounded-lg border border-dashed p-6 text-center space-y-2">
        <Heart class="w-8 h-8 text-muted-foreground mx-auto" />
        <p class="text-sm text-muted-foreground">Add workshops to your plan and choose "No, I'm looking" to find partners.</p>
        <p class="text-xs text-muted-foreground">We'll match you with dancers who have a complementary role.</p>
      </div>

      <!-- Signed in with workshops needing partners -->
      <div v-else class="space-y-2">
        <p class="text-xs text-muted-foreground mb-2">Dancers looking for a partner at your workshops:</p>

        <div
          v-for="{ workshop, role } in lookingWorkshops"
          :key="workshop.id"
          class="rounded-lg border"
        >
          <!-- Workshop header -->
          <button
            class="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
            @click="toggleMatchWorkshop(workshop.id)"
          >
            <div class="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
              <Heart class="w-4 h-4 text-pink-500" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium leading-tight">{{ workshop.title }}</p>
              <p class="text-xs text-muted-foreground">
                {{ workshop.day }} {{ workshop.time }}
                <span class="text-muted-foreground"> · You're {{ role === 'lead' ? 'Lead' : 'Follow' }}, looking for {{ role === 'lead' ? 'Follow' : 'Lead' }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <Badge v-if="matchesForWorkshop(workshop.id, role).length > 0" variant="secondary" class="text-eyebrow px-1.5 py-0">
                {{ matchesForWorkshop(workshop.id, role).length }} available
              </Badge>
              <component
                :is="expandedMatchWorkshopId === workshop.id ? ChevronDown : ChevronRight"
                class="w-4 h-4 text-muted-foreground"
              />
            </div>
          </button>

          <!-- Potential matches (expanded) -->
          <div v-if="expandedMatchWorkshopId === workshop.id" class="border-t">
            <div v-if="matchesForWorkshop(workshop.id, role).length === 0" class="p-4 text-center">
              <p class="text-xs text-muted-foreground">No matches yet. We'll notify you when someone signs up.</p>
            </div>
            <div v-else class="divide-y">
              <div
                v-for="match in matchesForWorkshop(workshop.id, role)"
                :key="match.id"
                class="flex items-center gap-3 p-3"
              >
                <img
                  :src="match.photo"
                  :alt="match.name"
                  class="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium">{{ match.name }}</span>
                    <Badge variant="secondary" class="text-eyebrow px-1.5 py-0">
                      {{ match.role === 'lead' ? 'Lead' : 'Follow' }}
                    </Badge>
                    <Badge variant="outline" class="text-eyebrow px-1.5 py-0">
                      {{ match.level }}
                    </Badge>
                  </div>
                  <p class="text-xs text-muted-foreground line-clamp-1">{{ match.bio }}</p>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <Badge
                      v-for="style in match.styles"
                      :key="style"
                      variant="outline"
                      class="text-eyebrow px-1 py-0"
                    >
                      {{ style }}
                    </Badge>
                  </div>
                </div>
                <Button
                  v-if="isRequested(match.id, workshop.id)"
                  size="sm"
                  variant="outline"
                  class="shrink-0 text-xs"
                  disabled
                >
                  <Check class="w-3 h-3 mr-1" />
                  Sent
                </Button>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  class="shrink-0 text-xs"
                  @click="sendRequest(match.id, workshop.id)"
                >
                  <MessageCircle class="w-3 h-3 mr-1" />
                  Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

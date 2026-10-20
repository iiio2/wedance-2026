<script setup lang="ts">
import type { TicketOption, Workshop } from '~/types/festival'
import { Ticket, ExternalLink, Sparkles, Bell, ArrowRightLeft, Users, BellRing } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

const props = defineProps<{
  tickets: TicketOption[]
  workshops: Workshop[]
  planIds: Set<string>
  ticketUrl?: string
  isSignedIn?: boolean
  organizerName?: string
}>()

const emit = defineEmits<{
  joinWaitlist: [ticketName: string]
  offerTicket: []
  signIn: []
  subscribe: []
}>()

const plannedDays = computed(() => {
  const days = new Set<string>()
  for (const w of props.workshops) {
    if (props.planIds.has(w.id)) {
      days.add(w.day)
    }
  }
  return days
})

const hasPartyInPlan = computed(() => {
  return props.workshops.some((w) => props.planIds.has(w.id) && w.type === 'party')
})

interface Recommendation {
  tickets: TicketOption[]
  total: number
  savings?: number
  label: string
  allSoldOut: boolean
}

// Count planned workshops (excluding parties)
const plannedWorkshopCount = computed(() => {
  return props.workshops.filter((w) => props.planIds.has(w.id) && w.type !== 'party').length
})

// Find cheapest combination of day passes to cover all planned days
function findCheapestDayCoverage(dayPasses: TicketOption[], targetDays: Set<string>): TicketOption[] {
  const sorted = [...dayPasses].sort((a, b) => a.price - b.price)

  // First: check if any single ticket covers all target days
  for (const t of sorted) {
    if ([...targetDays].every((d) => t.days.includes(d))) {
      return [t]
    }
  }

  // Greedy: pick cheapest tickets that cover uncovered days
  const uncovered = new Set(targetDays)
  const selected: TicketOption[] = []
  for (const t of sorted) {
    if (t.days.some((d) => uncovered.has(d))) {
      selected.push(t)
      t.days.forEach((d) => uncovered.delete(d))
      if (uncovered.size === 0) break
    }
  }
  return selected
}

const recommendation = computed<Recommendation | null>(() => {
  const days = plannedDays.value
  if (days.size === 0) return null

  const workshopCount = plannedWorkshopCount.value
  const wantsParty = hasPartyInPlan.value

  // Build candidate ticket combos and pick cheapest that covers the plan
  interface Candidate { tickets: TicketOption[]; total: number; label: string; allSoldOut: boolean }
  const candidates: Candidate[] = []

  // Check each ticket: does it fully cover the plan on its own?
  for (const ticket of props.tickets) {
    const coversWorkshops = ticket.workshopCount === undefined || ticket.workshopCount >= workshopCount
    const coversDays = ticket.days.length === 0 || [...days].every((d) => ticket.days.includes(d))
    const coversParty = !wantsParty || ticket.includesParty

    if (coversWorkshops && coversDays && (workshopCount > 0 || (workshopCount === 0 && wantsParty))) {
      if (coversParty) {
        // Single ticket covers everything
        candidates.push({
          tickets: [ticket],
          total: ticket.price,
          label: `You need a ${ticket.name}`,
          allSoldOut: !!ticket.soldOut,
        })
      } else {
        // Ticket covers workshops but not party — find a party add-on
        const partyTicket = props.tickets.find((t) => t.includesParty && (t.workshopCount === undefined || t.workshopCount === 0))
        if (partyTicket) {
          candidates.push({
            tickets: [ticket, partyTicket],
            total: ticket.price + partyTicket.price,
            label: `${ticket.name} + ${partyTicket.name}`,
            allSoldOut: !!ticket.soldOut && !!partyTicket.soldOut,
          })
        } else {
          // No separate party ticket, just recommend the workshop ticket
          candidates.push({
            tickets: [ticket],
            total: ticket.price,
            label: `You need a ${ticket.name}`,
            allSoldOut: !!ticket.soldOut,
          })
        }
      }
    }
  }

  // Also check: day pass combos (tickets without workshopCount that cover specific days)
  const dayPasses = props.tickets.filter((t) => t.days.length > 0 && !t.includesParty && t.workshopCount === undefined)
  if (dayPasses.length > 0) {
    const combo = findCheapestDayCoverage(dayPasses, days)
    if (combo.length > 0) {
      const partyTicket = wantsParty
        ? props.tickets.find((t) => t.includesParty && (t.workshopCount === undefined || t.workshopCount === 0))
        : null
      const tickets = partyTicket ? [...combo, partyTicket] : combo
      candidates.push({
        tickets,
        total: tickets.reduce((sum, t) => sum + t.price, 0),
        label: `${tickets.length} passes for your plan`,
        allSoldOut: tickets.every((t) => t.soldOut),
      })
    }
  }

  // Party only
  if (workshopCount === 0 && wantsParty) {
    const partyTicket = props.tickets.find((t) => t.includesParty)
    if (partyTicket) {
      candidates.push({
        tickets: [partyTicket],
        total: partyTicket.price,
        label: 'Party Pass covers your plan',
        allSoldOut: !!partyTicket.soldOut,
      })
    }
  }

  if (candidates.length === 0) return null

  // Pick cheapest
  candidates.sort((a, b) => a.total - b.total)
  const best = candidates[0]
  const secondBest = candidates.length > 1 ? candidates[1] : null

  return {
    tickets: best.tickets,
    total: best.total,
    savings: secondBest && secondBest.total > best.total ? secondBest.total - best.total : undefined,
    label: best.label,
    allSoldOut: best.allSoldOut,
  }
})

// Count how many tickets are sold out across all options
const soldOutCount = computed(() => props.tickets.filter((t) => t.soldOut).length)
</script>

<template>
  <div v-if="recommendation" class="space-y-3">
    <!-- Ticket recommendation card -->
    <div class="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 p-4">
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles class="w-4 h-4 text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">{{ recommendation.label }}</p>

          <div class="mt-2 space-y-1.5">
            <div
              v-for="ticket in recommendation.tickets"
              :key="ticket.name"
              class="flex items-center justify-between"
            >
              <div class="flex items-center gap-2">
                <Ticket class="w-3.5 h-3.5 text-muted-foreground" />
                <span class="text-sm">{{ ticket.name }}</span>
                <Badge v-if="ticket.soldOut" variant="outline" class="text-[10px] px-1.5 py-0 text-destructive border-destructive/30">
                  Sold out
                </Badge>
              </div>
              <span class="text-sm font-semibold">€{{ ticket.price }}</span>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between">
            <div>
              <span class="text-lg font-bold">€{{ recommendation.total }}</span>
              <span v-if="recommendation.savings && recommendation.savings > 0" class="text-xs text-green-600 ml-2">
                Save €{{ recommendation.savings }}
              </span>
            </div>

            <!-- Sold out: show waitlist button -->
            <Button
              v-if="recommendation.allSoldOut"
              size="sm"
              variant="outline"
              class="border-orange-300 text-orange-700 hover:bg-orange-50"
              @click="emit('joinWaitlist', recommendation.tickets[0].name)"
            >
              <Bell class="w-3.5 h-3.5 mr-1.5" />
              Join Waitlist
            </Button>

            <!-- Available: show get tickets -->
            <Button
              v-else-if="ticketUrl"
              size="sm"
              as="a"
              :href="ticketUrl"
              target="_blank"
              data-outbound-kind="ticket"
            >
              Get Tickets
              <ExternalLink class="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>

          <!-- Waitlist hint when sold out -->
          <p v-if="recommendation.allSoldOut" class="mt-2 text-xs text-muted-foreground">
            We'll notify you when a ticket becomes available from another dancer.
          </p>
        </div>
      </div>
    </div>

    <!-- Friend promo code hint (not signed in) -->
    <button
      v-if="!isSignedIn"
      type="button"
      class="w-full rounded-lg border border-dashed p-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors group"
      @click="emit('signIn')"
    >
      <Users class="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
      <div>
        <p class="text-xs font-medium text-muted-foreground group-hover:text-foreground">Friends may have promo codes</p>
        <p class="text-xs text-muted-foreground">Sign in to check if a friend's discount applies to your ticket</p>
      </div>
    </button>

    <!-- Can't make it? Resale offer -->
    <button
      type="button"
      class="w-full rounded-lg border border-dashed p-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors group"
      @click="emit('offerTicket')"
    >
      <ArrowRightLeft class="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
      <div>
        <p class="text-xs font-medium text-muted-foreground group-hover:text-foreground">Can't make it?</p>
        <p class="text-xs text-muted-foreground">Offer your ticket to dancers on the waitlist</p>
      </div>
    </button>

    <!-- Subscribe to organizer -->
    <button
      type="button"
      class="w-full rounded-lg border border-dashed p-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors group"
      @click="emit('subscribe')"
    >
      <BellRing class="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
      <div>
        <p class="text-xs font-medium text-muted-foreground group-hover:text-foreground">Follow {{ organizerName || 'this organizer' }}</p>
        <p class="text-xs text-muted-foreground">Get early bird tickets, promo codes, and special offers for next edition</p>
      </div>
    </button>
  </div>

  <!-- Empty state: no workshops selected yet -->
  <div v-else-if="tickets.length > 0 && planIds.size === 0" class="rounded-lg border border-dashed p-4 text-center">
    <Ticket class="w-5 h-5 text-muted-foreground mx-auto mb-2" />
    <p class="text-sm text-muted-foreground">Add workshops to your plan and we'll recommend the best ticket for you</p>
  </div>
</template>

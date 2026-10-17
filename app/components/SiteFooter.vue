<script setup lang="ts">
/**
 * SiteFooter — the shared V3 footer on every page. One place to change
 * footer links, tagline, or legal.
 */
// Hydration-safe (raw isSignedIn is false on the server, true on the client's first pass).
const { appearsSignedIn } = useAccountNav('dance')

const columns = [
  {
    title: 'Dance',
    links: [
      { to: '/festivals', label: 'Festivals' },
      { to: '/cities', label: 'Cities' },
      { to: '/artists', label: 'Artists' },
      { to: '/my-year', label: 'My Year' },
    ],
  },
  {
    title: 'Get booked',
    links: [
      { to: '/gigs', label: 'Gigs' },
      { to: '/for-events', label: 'Private events' },
    ],
  },
  {
    title: 'Work with us',
    links: [
      { to: '/for-organizers', label: 'For organizers' },
      { to: '/for-venues', label: 'For venues' },
      { to: '/for-sponsors', label: 'For sponsors' },
      { to: '/press', label: 'Press' },
      { to: '/whats-new', label: 'What’s new' },
    ],
  },
]

const year = 2026
</script>

<template>
  <footer class="border-t mt-8 border-border bg-wd-cream/60">
    <!-- pb-24 clears the floating "Talk to us" button (ReportProblem, bottom-left on every
         page) so the last footer row is never hidden under it; the phone tab bar is
         already reserved by html.has-tabbar body padding (tailwind.css). -->
    <div class="max-w-6xl mx-auto px-4 pt-12 pb-24">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
        <!-- Brand + tagline -->
        <div class="lg:col-span-2">
          <Brand />
          <p class="mt-3 text-sm max-w-xs leading-relaxed text-muted-foreground font-sans">
            Every dance, every teacher, every city — and who's going before you book.
          </p>
        </div>

        <!-- Link columns -->
        <div v-for="col in columns" :key="col.title">
          <div class="text-[10px] uppercase tracking-[0.3em] font-bold mb-3 text-secondary">{{ col.title }}</div>
          <ul class="space-y-2">
            <li v-for="l in col.links" :key="l.to">
              <NuxtLink
                :to="l.to"
                class="text-sm italic hover:underline text-muted-foreground font-display"
              >{{ l.label }}</NuxtLink>
            </li>
            <li v-if="col.title === 'Get booked'">
              <NuxtLink
                v-if="appearsSignedIn"
                to="/my-plan"
                class="text-sm italic hover:underline text-muted-foreground font-display"
              >My plan</NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <!-- Legal (Germany/EU: Imprint + Privacy Policy mandatory; Terms for ticket sales) -->
      <div class="mt-10 pt-6 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2">
        <NuxtLink to="/imprint" class="text-xs hover:underline text-muted-foreground font-sans">Imprint</NuxtLink>
        <NuxtLink to="/privacy-policy" class="text-xs hover:underline text-muted-foreground font-sans">Privacy Policy</NuxtLink>
        <NuxtLink to="/terms" class="text-xs hover:underline text-muted-foreground font-sans">Terms</NuxtLink>
        <NuxtLink to="/booking-terms" class="text-xs hover:underline text-muted-foreground font-sans">Booking Terms</NuxtLink>
        <NuxtLink to="/whats-new" class="text-xs hover:underline text-muted-foreground font-sans">What’s new</NuxtLink>
      </div>

      <!-- Bottom bar -->
      <div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="text-xs text-secondary font-sans">
          © {{ year }} WeDance ·
          Made by
          <a href="https://razbakov.com" target="_blank" rel="noopener" class="hover:underline text-primary">Alösha</a>
        </div>
        <div class="text-sm font-hand text-secondary" style="font-size:18px;">
          Made for dancers, by dancers.
        </div>
      </div>
    </div>
  </footer>
</template>

/**
 * Pages captured after every production deploy (see capture.ts and
 * .github/workflows/release-snapshots.yml). Add a route here to start
 * archiving it; `festival` resolves to the first upcoming festival at capture time.
 */
export const SNAPSHOT_ROUTES: { path: string, name: string }[] = [
  { path: '/', name: 'home' },
  { path: '/festivals', name: 'festivals' },
  { path: 'festival', name: 'festival-detail' },
  { path: '/cities', name: 'cities' },
  { path: '/cities/munich', name: 'city-munich' },
  { path: '/artists', name: 'artists' },
  { path: '/organizers', name: 'organizers' },
  { path: '/gigs', name: 'gigs' },
  { path: '/find-your-dance', name: 'find-your-dance' },
  { path: '/for-events', name: 'for-events' },
  { path: '/for-organizers', name: 'for-organizers' },
  { path: '/design', name: 'design-system' },
]

export const SNAPSHOT_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

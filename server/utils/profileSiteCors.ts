import { defineEventHandler, handleCors } from 'h3'

/**
 * A profile's own website (wedance-site-kit) reads its page and events from
 * the browser, so these GETs are cross-origin. CORS goes on in middleware,
 * before the handler runs, so errors carry it too: a site whose profile has no
 * website gets a 404 it can read, not a CORS failure. Also answers the
 * preflight. The sign-up POST (contacts.ts) handles its own CORS.
 */
export const PROFILE_SITE_PATH = /^\/api\/profiles\/[^/]+\/(site|events)(\?|$)/

export const profileSiteCors = defineEventHandler((event) => {
  if (!PROFILE_SITE_PATH.test(event.path)) return
  if (handleCors(event, { origin: '*', methods: ['GET', 'OPTIONS'] })) return null
})

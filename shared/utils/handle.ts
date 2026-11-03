/**
 * The rule for a handle someone chooses (/@<handle> pages; dancers' /u/<handle>
 * share the namespace). Instagram-compatible, so a page can keep the handle
 * people already know: lowercase letters, numbers, dots, underscores — plus
 * the dashes WeDance handles have always had. 3–40 characters, no dot at
 * either end, no "..", not a site word (RESERVED_HANDLES), and not ending like
 * a file a static host could serve instead of the page ("@flyer.png").
 *
 * Used by business.create / renameHandle (zod) and the create form (valibot).
 * Generated and imported handles may be older shapes: lookups never use this.
 */

export const HANDLE_MIN = 3
export const HANDLE_MAX = 40

/** Handles nobody gets: site sections, page names and roles (a page at /@admin would mislead). */
export const RESERVED_HANDLES = ['admin', 'administrator', 'api', 'app', 'artist', 'artists', 'auth', 'booking-terms', 'business', 'charanga', 'cities', 'city', 'confirm', 'dancer', 'dancers', 'docs', 'elections', 'event', 'events', 'festival', 'festivals', 'find-your-dance', 'for-events', 'for-organizers', 'for-sponsors', 'for-venues', 'gigs', 'help', 'imprint', 'login', 'logout', 'me', 'moderator', 'my-plan', 'my-year', 'null', 'onboarding', 'organizer', 'organizers', 'press', 'privacy-policy', 'profile', 'profiles', 'root', 'settings', 'signin', 'signup', 'sketches', 'staff', 'support', 'system', 'team', 'terms', 'u', 'undefined', 'user', 'venue', 'venues', 'wedance', 'www']

// Extensions a CDN, static host or dev server may treat as a file.
const FILE_EXT = /\.(html?|xml|json|txt|md|csv|js|mjs|cjs|ts|map|css|wasm|ico|png|jpe?g|gif|webp|avif|svg|bmp|tiff?|heic|mp3|mp4|m4a|wav|ogg|webm|mov|pdf|zip|gz|webmanifest|woff2?|ttf|otf|eot|php|asp|aspx|env|ya?ml)$/

const CHARS = /^[a-z0-9._-]+$/

/** Why `handle` can't be chosen (a message for the form), or null when it can. Expects lowercase. */
export function handleError(handle: string): string | null {
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) return `Use ${HANDLE_MIN}–${HANDLE_MAX} characters.`
  if (!CHARS.test(handle)) return 'Use lowercase letters, numbers, dots, underscores or dashes.'
  if (/^[.-]|[.-]$/.test(handle)) return 'Start and end with a letter, number or underscore.'
  if (handle.includes('..')) return 'Use one dot at a time.'
  if (RESERVED_HANDLES.includes(handle)) return `@${handle} is reserved — pick another.`
  if (FILE_EXT.test(handle)) return 'Don’t end it like a file name (.png, .js…).'
  return null
}

export const isValidHandle = (handle: string) => handleError(handle) === null

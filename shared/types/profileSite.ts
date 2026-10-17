/**
 * A profile's own website, managed on WeDance (RAZ-412): WeDance is the CMS
 * (the page's words, images, sections) and the CRM (who signed up on it). The
 * site itself (e.g. montuno.club) only renders what
 * GET /api/profiles/<username>/site returns and posts sign-ups to
 * POST /api/profiles/<username>/contacts. Events always come from the
 * profile's events on WeDance — a site never lists one by hand.
 *
 * Every text is per language ({ en: '…', de: '…' }); a missing language falls
 * back to the site's first language. Section kinds are generic, the site
 * decides how each looks.
 */
import { z } from 'zod'

export const SITE_LOCALES = ['en', 'de', 'es', 'ru', 'uk', 'fr', 'it', 'pt', 'pl'] as const
export type SiteLocale = (typeof SITE_LOCALES)[number]

/** Text in each language. */
export type L10n = Partial<Record<string, string>>

export const SECTION_KINDS = ['hero', 'text', 'cards', 'events', 'faq', 'video', 'person', 'location', 'signup', 'cta'] as const
export type SectionKind = (typeof SECTION_KINDS)[number]

/** What each kind is for, and which fields the editor shows for it. */
export const SECTION_INFO: Record<SectionKind, { label: string; hint: string; fields: (keyof SiteSection)[]; items?: { label: string; fields: (keyof SiteItem)[] } }> = {
  hero: { label: 'Hero', hint: 'The top of the page: a big title over a photo, with buttons.', fields: ['eyebrow', 'title', 'titleAccent', 'body', 'image', 'buttons'] },
  text: { label: 'Text', hint: 'A heading and paragraphs, with up to four big numbers or words beside it.', fields: ['eyebrow', 'title', 'titleAccent', 'body', 'image', 'items', 'callout'], items: { label: 'Highlights', fields: ['title', 'body'] } },
  cards: { label: 'Cards', hint: 'A row of cards: offers, steps, stops, reasons. Optionally a video under them.', fields: ['eyebrow', 'title', 'titleAccent', 'body', 'items', 'video', 'callout'], items: { label: 'Cards', fields: ['tag', 'title', 'body', 'image', 'url'] } },
  events: { label: 'Events', hint: 'Your upcoming events on WeDance, each with a sign-up button. Edit the events themselves under Events.', fields: ['eyebrow', 'title', 'titleAccent', 'body', 'days', 'callout'] },
  faq: { label: 'Questions', hint: 'Questions and answers.', fields: ['eyebrow', 'title', 'titleAccent', 'items'], items: { label: 'Questions', fields: ['title', 'body'] } },
  video: { label: 'Video', hint: 'A YouTube video.', fields: ['eyebrow', 'title', 'titleAccent', 'body', 'video'] },
  person: { label: 'Person', hint: 'A teacher, DJ or host: photo, name and story.', fields: ['eyebrow', 'title', 'titleAccent', 'body', 'image', 'items'], items: { label: 'Facts', fields: ['title', 'body'] } },
  location: { label: 'Location', hint: 'Where to find you, with a map.', fields: ['eyebrow', 'title', 'titleAccent', 'body', 'address', 'mapUrl', 'items'], items: { label: 'Facts', fields: ['title'] } },
  signup: { label: 'Sign-up form', hint: 'Name, email and phone. People who sign up land in your Contacts on WeDance.', fields: ['eyebrow', 'title', 'titleAccent', 'body'] },
  cta: { label: 'Call to action', hint: 'One message with a button (WhatsApp group, tickets, Instagram…).', fields: ['eyebrow', 'title', 'titleAccent', 'body', 'buttons'] },
}

export type SiteButton = { label: L10n; url: string }
export type SiteItem = { id: string; tag?: L10n; title?: L10n; body?: L10n; image?: string; url?: string }
export type SiteCallout = { title?: L10n; body?: L10n; button?: SiteButton }

export type SiteSection = {
  id: string
  kind: SectionKind
  hidden?: boolean
  /** #anchor on the page; with navLabel, it's in the site's menu. */
  anchor?: string
  navLabel?: L10n
  eyebrow?: L10n
  title?: L10n
  /** The highlighted end of the title. */
  titleAccent?: L10n
  /** Paragraphs, separated by a blank line. */
  body?: L10n
  image?: string
  video?: string
  address?: L10n
  mapUrl?: string
  /** events: how many days ahead (default 35). */
  days?: number
  buttons?: SiteButton[]
  items?: SiteItem[]
  callout?: SiteCallout
}

export type ProfileSite = {
  /** The site's address, e.g. https://montuno.club (links in emails point there). */
  domain?: string
  /** First = default; texts fall back to it. */
  locales: string[]
  seo?: { title?: L10n; description?: L10n; image?: string }
  /** The email someone gets after signing up on the site. */
  welcome?: { subject?: L10n; body?: L10n }
  sections: SiteSection[]
}

// --- validation (the editor and the API share it) ---------------------------

const l10n = z.record(z.string().max(12), z.string().max(8000)).optional()
const url = z.string().max(2000)
const button = z.object({ label: z.record(z.string().max(12), z.string().max(200)), url })
const item = z.object({ id: z.string().max(40), tag: l10n, title: l10n, body: l10n, image: url.optional(), url: url.optional() })
export const siteSectionSchema = z.object({
  id: z.string().max(40),
  kind: z.enum(SECTION_KINDS),
  hidden: z.boolean().optional(),
  anchor: z.string().max(40).regex(/^[a-z0-9-]*$/, 'Anchors are lowercase letters, numbers and dashes.').optional(),
  navLabel: l10n,
  eyebrow: l10n,
  title: l10n,
  titleAccent: l10n,
  body: l10n,
  image: url.optional(),
  video: url.optional(),
  address: l10n,
  mapUrl: url.optional(),
  days: z.number().int().min(1).max(180).optional(),
  buttons: z.array(button).max(4).optional(),
  items: z.array(item).max(24).optional(),
  callout: z.object({ title: l10n, body: l10n, button: button.optional() }).optional(),
})
export const profileSiteSchema = z.object({
  domain: url.optional(),
  locales: z.array(z.string().min(2).max(12)).min(1).max(10),
  seo: z.object({ title: l10n, description: l10n, image: url.optional() }).optional(),
  welcome: z.object({ subject: l10n, body: l10n }).optional(),
  sections: z.array(siteSectionSchema).max(40),
})

// --- one language, for the site to render ------------------------------------

export type Resolved<T> = T extends L10n ? string : T extends (infer U)[] ? Resolved<U>[] : T extends object ? { [K in keyof T]: Resolved<T[K]> } : T

const isL10n = (k: string) => ['navLabel', 'eyebrow', 'title', 'titleAccent', 'body', 'address', 'tag', 'label', 'subject', 'description'].includes(k)

/** Text in `locale`, else the site's first language, else any. */
export function pick(t: L10n | undefined, locale: string, fallback: string): string {
  if (!t) return ''
  return t[locale] || t[fallback] || Object.values(t).find(Boolean) || ''
}

function resolveValue(v: any, locale: string, fallback: string): any {
  if (Array.isArray(v)) return v.map(x => resolveValue(x, locale, fallback))
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, isL10n(k) && x && typeof x === 'object' && !Array.isArray(x) ? pick(x as L10n, locale, fallback) : resolveValue(x, locale, fallback)]))
  }
  return v
}

/** The site in one language, hidden sections left out. */
export function resolveSite(site: ProfileSite, locale: string) {
  const fallback = site.locales[0] ?? 'en'
  const lang = site.locales.includes(locale) ? locale : fallback
  return {
    lang,
    locales: site.locales,
    domain: site.domain ?? null,
    seo: resolveValue(site.seo ?? {}, lang, fallback) as Resolved<NonNullable<ProfileSite['seo']>>,
    sections: site.sections.filter(s => !s.hidden).map(s => resolveValue(s, lang, fallback)) as Resolved<SiteSection>[],
  }
}

/** Which texts a language still lacks (the editor's "missing" hints). */
export function missingTexts(site: ProfileSite, locale: string): number {
  const fallback = site.locales[0] ?? 'en'
  let n = 0
  const walk = (v: any, key = '') => {
    if (Array.isArray(v)) return v.forEach(x => walk(x))
    if (v && typeof v === 'object') {
      if (isL10n(key) && !Array.isArray(v)) { if (v[fallback] && !v[locale]) n++; return }
      for (const [k, x] of Object.entries(v)) walk(x, k)
    }
  }
  walk(site.sections)
  walk(site.seo)
  return n
}

export const newId = () => Math.random().toString(36).slice(2, 10)

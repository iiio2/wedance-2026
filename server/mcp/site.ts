/**
 * Editing a page's own website over MCP (RAZ-412): WeDance is the CMS of sites
 * on their own domain — they render
 * /api/profiles/<username>/site. An assistant changes a few things at a time,
 * so update_my_site takes a patch, not the whole site: sections merge by id,
 * texts merge per language. Pure, for tests.
 */
import { z } from 'zod'
import { SECTION_INFO, SECTION_KINDS, newId, profileSiteSchema, siteSectionSchema, type L10n, type ProfileSite, type SiteSection, type SiteLegal, type SiteThemeSettings } from '../../shared/types/profileSite'
import { SITE_FONTS, SITE_THEMES } from '../../shared/utils/siteThemes'

/** Section fields that hold text per language ({ en: '…', de: '…' }). */
const L10N_FIELDS = ['navLabel', 'eyebrow', 'title', 'titleAccent', 'body', 'address'] as const

const l10n = z.record(z.string().min(2).max(12), z.string().max(8000))
  .describe('Text per language, e.g. {"en": "…", "de": "…"}. Languages you leave out stay; "" removes one.')

const s = siteSectionSchema.shape
export const sectionPatchSchema = z.object({
  id: z.string().max(40).optional().describe('An existing section’s id (from get_my_site) to change it; leave out to add a new section.'),
  kind: z.enum(SECTION_KINDS).optional().describe('Needed for a new section: ' + SECTION_KINDS.join(', ') + '.'),
  position: z.number().int().min(0).max(40).optional().describe('Where to put a new section (0 = top); default the end.'),
  hidden: s.hidden,
  anchor: s.anchor,
  navLabel: l10n.optional().describe('Menu label (with anchor, the section is in the site’s menu); per language.'),
  eyebrow: l10n.optional(),
  title: l10n.optional(),
  titleAccent: l10n.optional().describe('The highlighted end of the title; per language.'),
  body: l10n.optional().describe('Paragraphs separated by a blank line; per language.'),
  image: s.image.describe('Image URL; "" removes it.'),
  video: s.video.describe('Video URL (YouTube, or a file for a hero background); "" removes it.'),
  address: l10n.optional(),
  mapUrl: s.mapUrl,
  days: s.days,
  buttons: s.buttons.describe('Replaces the whole list: send every button.'),
  items: s.items.describe('Cards / questions / facts. Replaces the whole list: send every item (keep their ids).'),
  callout: s.callout.describe('Replaces the callout.'),
})
export type SectionPatch = z.infer<typeof sectionPatchSchema>

export const sitePatchInput = {
  domain: z.string().trim().max(2000).optional().describe('The site’s address, e.g. https://yourdanceschool.com.'),
  locales: z.array(z.string().min(2).max(12)).min(1).max(10).optional().describe('The site’s languages, first = default (texts fall back to it). Replaces the list.'),
  seo: z.object({ title: l10n.optional(), description: l10n.optional(), image: z.string().max(2000).optional() }).optional()
    .describe('Search/share title, description (per language) and image.'),
  welcome: z.object({ subject: l10n.optional(), body: l10n.optional() }).optional()
    .describe('The email someone gets after signing up on the site (per language).'),
  sections: z.array(sectionPatchSchema).max(40).optional().describe('Sections to change (by id) or add (no id, with kind). Only the fields you pass change.'),
  remove_sections: z.array(z.string().max(40)).max(40).optional().describe('Ids of sections to delete. To keep one off the page but saved, set hidden: true instead.'),
  order: z.array(z.string().max(40)).max(40).optional().describe('Section ids in the new order; sections you leave out follow in their current order.'),
  theme: z.object({
    preset: z.enum(Object.keys(SITE_THEMES) as [string, ...string[]]).optional().describe('The style: ' + Object.entries(SITE_THEMES).map(([id, t]) => `${id} (${t.label})`).join(', ') + '.'),
    accent: z.string().regex(/^(#[0-9a-fA-F]{6})?$/).optional().describe('One accent colour #rrggbb for buttons and highlights; "" = the style\'s own.'),
    font: z.string().max(40).optional().describe('Heading font: ' + Object.keys(SITE_FONTS).join(', ') + '; "" = the style\'s own.'),
    logo: z.string().max(2000).optional().describe('Logo image URL (replaces the name in the top bar); "" removes it.'),
    favicon: z.string().max(2000).optional().describe('Browser-tab icon URL; "" removes it.'),
  }).optional().describe('The look on sites.wedance.vip. Only the keys you pass change.'),
  legal: z.object({
    name: z.string().max(200).optional(), address: z.string().max(400).optional(), email: z.string().max(200).optional(),
    phone: z.string().max(60).optional(), vatId: z.string().max(40).optional(), register: z.string().max(200).optional(), responsible: z.string().max(300).optional(),
  }).optional().describe('Who runs the site, for its Impressum and privacy page (required for German businesses). Only the keys you pass change; "" clears one. Use the user\'s own words; never invent these.'),
  published: z.boolean().optional().describe('true = live on sites.wedance.vip; false = back to a draft (only preview links show it).'),
}
export type SitePatch = { [K in keyof typeof sitePatchInput]?: z.infer<(typeof sitePatchInput)[K]> }

/** Merge texts per language; "" removes a language; nothing left → undefined. */
export function mergeL10n(cur: L10n | undefined, next: Record<string, string> | undefined): L10n | undefined {
  if (next === undefined) return cur
  const out: L10n = { ...(cur ?? {}) }
  for (const [lang, text] of Object.entries(next)) {
    if (text.trim()) out[lang] = text
    else delete out[lang]
  }
  return Object.keys(out).length ? out : undefined
}

function mergeSection(cur: SiteSection, p: SectionPatch): SiteSection {
  const { id: _i, kind, position: _p, ...fields } = p
  const out: any = { ...cur }
  if (kind) out.kind = kind
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue
    if ((L10N_FIELDS as readonly string[]).includes(k)) out[k] = mergeL10n(cur[k as keyof SiteSection] as L10n | undefined, v as Record<string, string>)
    else if (v === '' && ['image', 'video', 'mapUrl', 'anchor'].includes(k)) delete out[k]
    else out[k] = v
    if (out[k] === undefined) delete out[k]
  }
  // New items/buttons from an assistant may come without ids.
  if (out.items) out.items = out.items.map((it: any) => ({ ...it, id: it.id || newId() }))
  return out
}

export class SitePatchError extends Error {}

/** The site after the patch, validated like the web editor's save. */
export function applySitePatch(site: ProfileSite, patch: SitePatch): ProfileSite {
  let sections = [...site.sections]
  const known = new Set(sections.map(x => x.id))

  for (const id of patch.remove_sections ?? []) {
    if (!known.has(id)) throw new SitePatchError(`No section with id "${id}" (see get_my_site).`)
    sections = sections.filter(x => x.id !== id)
  }
  for (const p of patch.sections ?? []) {
    const at = p.id ? sections.findIndex(x => x.id === p.id) : -1
    if (at >= 0) { sections[at] = mergeSection(sections[at]!, p); continue }
    if (p.id && known.has(p.id)) throw new SitePatchError(`Section "${p.id}" is removed in the same change.`)
    if (!p.kind) throw new SitePatchError(p.id ? `No section with id "${p.id}" (see get_my_site); to add one, give its kind.` : 'A new section needs its kind.')
    const added = mergeSection({ id: p.id || newId(), kind: p.kind }, p)
    sections.splice(Math.min(p.position ?? sections.length, sections.length), 0, added)
  }
  if (patch.order) {
    const byId = new Map(sections.map(x => [x.id, x]))
    for (const id of patch.order) if (!byId.has(id)) throw new SitePatchError(`No section with id "${id}" to order.`)
    const first = patch.order.map(id => byId.get(id)!)
    sections = [...new Set([...first, ...sections])]
  }

  const next: ProfileSite = { ...site, sections }
  if (patch.domain !== undefined) {
    if (patch.domain) next.domain = /^https?:\/\//i.test(patch.domain) ? patch.domain : `https://${patch.domain}`
    else delete next.domain
  }
  if (patch.locales) next.locales = patch.locales
  if (patch.seo) {
    const seo = { ...(site.seo ?? {}) }
    seo.title = mergeL10n(seo.title, patch.seo.title)
    seo.description = mergeL10n(seo.description, patch.seo.description)
    if (patch.seo.image !== undefined) seo.image = patch.seo.image || undefined
    next.seo = JSON.parse(JSON.stringify(seo))
  }
  if (patch.welcome) {
    next.welcome = JSON.parse(JSON.stringify({
      subject: mergeL10n(site.welcome?.subject, patch.welcome.subject),
      body: mergeL10n(site.welcome?.body, patch.welcome.body),
    }))
  }
  if (patch.theme) {
    const theme: SiteThemeSettings = { ...(site.theme ?? {}) }
    for (const [k, v] of Object.entries(patch.theme)) {
      if (v === undefined) continue
      if (v) (theme as any)[k] = v
      else delete (theme as any)[k]
    }
    next.theme = theme
  }
  if (patch.legal) {
    const legal: SiteLegal = { ...(site.legal ?? {}) }
    for (const [k, v] of Object.entries(patch.legal)) {
      if (v === undefined) continue
      if (v.trim()) (legal as any)[k] = v.trim()
      else delete (legal as any)[k]
    }
    if (Object.keys(legal).length) next.legal = legal
    else delete next.legal
  }
  if (patch.published !== undefined) next.published = patch.published
  const ok = profileSiteSchema.safeParse(next)
  if (!ok.success) throw new SitePatchError(ok.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '))
  return next
}

export { siteChanges } from '../../shared/utils/siteDiff'

/** Section kinds for the assistant: what each is for and its fields. */
export const sectionKinds = Object.fromEntries(Object.entries(SECTION_INFO).map(([k, v]) => [k, { label: v.label, hint: v.hint, fields: v.fields, ...(v.items ? { items: v.items } : {}) }]))

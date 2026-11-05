/**
 * Editing a page's own website over MCP (RAZ-412): WeDance is the CMS of sites
 * like dancegodscompany.com or montuno.club — they render
 * /api/profiles/<username>/site. An assistant changes a few things at a time,
 * so update_my_site takes a patch, not the whole site: sections merge by id,
 * texts merge per language. Pure, for tests.
 */
import { z } from 'zod'
import { SECTION_INFO, SECTION_KINDS, newId, profileSiteSchema, siteSectionSchema, type L10n, type ProfileSite, type SiteSection } from '../../shared/types/profileSite'

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
  domain: z.string().trim().max(2000).optional().describe('The site’s address, e.g. https://dancegodscompany.com.'),
  locales: z.array(z.string().min(2).max(12)).min(1).max(10).optional().describe('The site’s languages, first = default (texts fall back to it). Replaces the list.'),
  seo: z.object({ title: l10n.optional(), description: l10n.optional(), image: z.string().max(2000).optional() }).optional()
    .describe('Search/share title, description (per language) and image.'),
  welcome: z.object({ subject: l10n.optional(), body: l10n.optional() }).optional()
    .describe('The email someone gets after signing up on the site (per language).'),
  sections: z.array(sectionPatchSchema).max(40).optional().describe('Sections to change (by id) or add (no id, with kind). Only the fields you pass change.'),
  remove_sections: z.array(z.string().max(40)).max(40).optional().describe('Ids of sections to delete. To keep one off the page but saved, set hidden: true instead.'),
  order: z.array(z.string().max(40)).max(40).optional().describe('Section ids in the new order; sections you leave out follow in their current order.'),
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
  const ok = profileSiteSchema.safeParse(next)
  if (!ok.success) throw new SitePatchError(ok.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '))
  return next
}

const label = (x: SiteSection, lang: string) => ({ id: x.id, kind: x.kind, title: x.title?.[lang] ?? Object.values(x.title ?? {})[0] ?? '' })

/** What a patch changes, for the preview the user agrees to. */
export function siteChanges(before: ProfileSite, after: ProfileSite) {
  const lang = after.locales[0] ?? 'en'
  const was = new Map(before.sections.map(x => [x.id, x]))
  const now = new Map(after.sections.map(x => [x.id, x]))
  const changed = after.sections.filter(x => was.has(x.id)).flatMap((x) => {
    const old = was.get(x.id)!
    const keys = [...new Set([...Object.keys(old), ...Object.keys(x)])].filter(k => JSON.stringify((old as any)[k]) !== JSON.stringify((x as any)[k]))
    return keys.length ? [{ ...label(x, lang), changes: Object.fromEntries(keys.map(k => [k, { from: (old as any)[k] ?? null, to: (x as any)[k] ?? null }])) }] : []
  })
  const site = (['domain', 'locales', 'seo', 'welcome'] as const)
    .filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map(k => ({ field: k, from: before[k] ?? null, to: after[k] ?? null }))
  const orderBefore = before.sections.filter(x => now.has(x.id)).map(x => x.id)
  const orderAfter = after.sections.filter(x => was.has(x.id)).map(x => x.id)
  return {
    site,
    added: after.sections.filter(x => !was.has(x.id)),
    changed,
    removed: before.sections.filter(x => !now.has(x.id)).map(x => label(x, lang)),
    reordered: JSON.stringify(orderBefore) !== JSON.stringify(orderAfter) ? after.sections.map(x => label(x, lang)) : null,
  }
}

/** Section kinds for the assistant: what each is for and its fields. */
export const sectionKinds = Object.fromEntries(Object.entries(SECTION_INFO).map(([k, v]) => [k, { label: v.label, hint: v.hint, fields: v.fields, ...(v.items ? { items: v.items } : {}) }]))

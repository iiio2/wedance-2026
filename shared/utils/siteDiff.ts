/**
 * What changed between two versions of a page's website (RAZ-412): the
 * structured diff the MCP preview shows, and the short lines the version
 * history lists ("Changed Hero “Dance with us”: title (en)").
 */
import { SECTION_INFO, type L10n, type ProfileSite, type SiteSection } from '../types/profileSite'

/** JSON with object keys sorted: Postgres jsonb reorders keys, so plain JSON.stringify can't compare a stored site with a new one. */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, x) => x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]]))
    : x)
}
const same = (a: unknown, b: unknown) => stableJson(a ?? null) === stableJson(b ?? null)

const label = (x: SiteSection, lang: string) => ({ id: x.id, kind: x.kind, title: x.title?.[lang] ?? Object.values(x.title ?? {})[0] ?? '' })

/** What a change does, section by section (for previews). */
export function siteChanges(before: ProfileSite, after: ProfileSite) {
  const lang = after.locales[0] ?? 'en'
  const was = new Map(before.sections.map(x => [x.id, x]))
  const now = new Map(after.sections.map(x => [x.id, x]))
  const changed = after.sections.filter(x => was.has(x.id)).flatMap((x) => {
    const old = was.get(x.id)!
    const keys = [...new Set([...Object.keys(old), ...Object.keys(x)])].filter(k => !same((old as any)[k], (x as any)[k]))
    return keys.length ? [{ ...label(x, lang), changes: Object.fromEntries(keys.map(k => [k, { from: (old as any)[k] ?? null, to: (x as any)[k] ?? null }])) }] : []
  })
  const site = (['domain', 'locales', 'seo', 'welcome', 'theme', 'published', 'legal'] as const)
    .filter(k => !same(before[k], after[k]))
    .map(k => ({ field: k, from: before[k] ?? null, to: after[k] ?? null }))
  const orderBefore = before.sections.filter(x => now.has(x.id)).map(x => x.id)
  const orderAfter = after.sections.filter(x => was.has(x.id)).map(x => x.id)
  return {
    site,
    added: after.sections.filter(x => !was.has(x.id)),
    changed,
    removed: before.sections.filter(x => !now.has(x.id)).map(x => label(x, lang)),
    reordered: !same(orderBefore, orderAfter) ? after.sections.map(x => label(x, lang)) : null,
  }
}

const FIELD_NAMES: Record<string, string> = {
  title: 'title', titleAccent: 'title highlight', eyebrow: 'small heading', body: 'text', navLabel: 'menu label', anchor: 'anchor',
  image: 'image', video: 'video', address: 'address', mapUrl: 'map', days: 'days ahead', buttons: 'buttons', items: 'items',
  callout: 'callout', hidden: 'visibility', kind: 'kind', description: 'description', subject: 'subject',
}
const SITE_FIELDS: Record<string, string> = { domain: 'own domain', locales: 'languages', seo: 'search & sharing', welcome: 'welcome email', theme: 'look', legal: 'legal details' }
const THEME_FIELDS: Record<string, string> = { preset: 'style', accent: 'accent colour', font: 'font', logo: 'logo', favicon: 'favicon' }

const isL10n = (v: unknown): v is L10n => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v as object).every(x => typeof x === 'string')
/** "title (en, de)" when only some languages of a text changed. */
function fieldLabel(key: string, from: unknown, to: unknown): string {
  const name = FIELD_NAMES[key] ?? key
  if ((from == null || isL10n(from)) && (to == null || isL10n(to)) && (from || to)) {
    const a = (from ?? {}) as L10n, b = (to ?? {}) as L10n
    const langs = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(l => a[l] !== b[l])
    if (langs.length) return `${name} (${langs.join(', ')})`
  }
  return name
}

const sectionName = (s: { kind: string; title?: string }) => {
  const kind = SECTION_INFO[s.kind as keyof typeof SECTION_INFO]?.label ?? s.kind
  return s.title ? `${kind} “${s.title.length > 40 ? `${s.title.slice(0, 39)}…` : s.title}”` : kind
}

/** Short lines saying what changed, newest version's view. Empty = nothing changed. */
export function siteChangeSummary(before: ProfileSite | null, after: ProfileSite): string[] {
  if (!before) return ['Created the site']
  const c = siteChanges(before, after)
  const lang = after.locales[0] ?? 'en'
  const lines: string[] = []
  for (const s of c.site) {
    const name = SITE_FIELDS[s.field] ?? s.field
    if (s.field === 'published') { lines.push(s.to === false ? 'Made it a draft' : 'Published'); continue }
    if (s.field === 'theme') {
      const a = (s.from ?? {}) as Record<string, unknown>, b = (s.to ?? {}) as Record<string, unknown>
      const parts = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !same(a[k], b[k])).map(k => THEME_FIELDS[k] ?? k)
      lines.push(parts.length ? `Changed look: ${parts.join(', ')}` : 'Changed look')
      continue
    }
    // seo / welcome: which of their texts, in which languages.
    if (s.field === 'seo' || s.field === 'welcome') {
      const a = (s.from ?? {}) as Record<string, unknown>, b = (s.to ?? {}) as Record<string, unknown>
      const parts = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !same(a[k], b[k])).map(k => fieldLabel(k, a[k], b[k]))
      lines.push(parts.length ? `Changed ${name}: ${parts.join(', ')}` : `Changed ${name}`)
      continue
    }
    lines.push(`Changed ${name}`)
  }
  for (const a of c.added) lines.push(`Added ${sectionName(label(a, lang))}`)
  for (const x of c.changed) {
    const hidden = (x.changes as any).hidden
    if (hidden && Object.keys(x.changes).length === 1) { lines.push(`${hidden.to ? 'Hid' : 'Showed'} ${sectionName(x)}`); continue }
    const fields = Object.entries(x.changes).filter(([k]) => k !== 'id').map(([k, v]: [string, any]) => fieldLabel(k, v.from, v.to))
    lines.push(`Changed ${sectionName(x)}: ${fields.join(', ')}`)
  }
  for (const r of c.removed) lines.push(`Removed ${sectionName(r)}`)
  if (c.reordered) lines.push('Reordered sections')
  return lines
}

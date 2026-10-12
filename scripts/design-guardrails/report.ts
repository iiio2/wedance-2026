/**
 * Design-system drift REPORT — a record, never a gate.
 *
 *   bun scripts/design-guardrails/report.ts
 *
 * Prints what drifted against the baseline (literal hex, literal font-family,
 * non-Playfair/Caveat Google Fonts, quoted font lists, runtime-built Tailwind
 * classes). In CI it also writes the report to the run's summary page, so every
 * commit carries a trace of design drift. Always exits 0: we ship continuously
 * and keep records of what changed, when and why — drift is fixed forward.
 */
import { appendFileSync } from 'node:fs'
import {
  readBaseline,
  scanDynamicClasses,
  scanFontFamily,
  scanGoogleFonts,
  scanHex,
  scanQuotedFontLists,
} from './scan'

const baseline = readBaseline()
const hex = scanHex()
const font = scanFontFamily()
const fmt = (hits: { file: string, line: number, text: string }[]) => hits.map(h => `- \`${h.file}:${h.line}\` ${h.text}`).join('\n')

const grownHex = Object.entries(hex.perFile)
  .filter(([f, n]) => n > (baseline.hex.perFile[f] ?? 0))
  .map(([f, n]) => ({ file: f, was: baseline.hex.perFile[f] ?? 0, now: n }))
const fontHits = font.hits.filter(h => (font.perFile[h.file] ?? 0) > (baseline.fontFamily.perFile[h.file] ?? 0))
const gfonts = scanGoogleFonts()
const quoted = scanQuotedFontLists()
const dynamic = scanDynamicClasses()

const sections: string[] = []
if (grownHex.length) sections.push(`**New literal hex colours** (use tokens: \`var(--wd-*)\`, \`bg-wd-*\`, \`WD.*\`):\n${grownHex.map(g => `- \`${g.file}\`: ${g.was} → ${g.now}\n${fmt(hex.hits.filter(h => h.file === g.file)).replace(/^/gm, '  ')}`).join('\n')}`)
if (fontHits.length) sections.push(`**Literal font-family** (use \`font-display\` / \`font-sans\` / \`font-hand\`):\n${fmt(fontHits)}`)
if (gfonts.length) sections.push(`**Google Fonts outside the system** (Playfair Display, Caveat):\n${fmt(gfonts)}`)
if (quoted.length) sections.push(`**Quoted font list** (\`'Caveat, cursive'\` is one bogus family):\n${fmt(quoted)}`)
if (dynamic.length) sections.push(`**Tailwind class built at runtime** (renders nothing — use full class strings or \`var(--wd-*)\`):\n${fmt(dynamic)}`)

const trend = `Hex literals: ${hex.total} (baseline ${baseline.hex.total}).`
const md = [
  '## Design-system drift',
  sections.length ? `${sections.length} kind(s) of drift — recorded, not blocking. See docs/design-system.md → Guardrails.` : 'No drift. ✅',
  trend,
  ...sections,
].join('\n\n')

console.log(md)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`)

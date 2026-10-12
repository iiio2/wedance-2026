/**
 * Design-system drift scanner — shared by the vitest guardrail
 * (token-drift.test.ts) and the baseline updater (update-baseline.ts).
 *
 * Rules enforced (see docs/design-system.md → "Guardrails"):
 *   1. Literal 6/8-digit hex colours in app/ may not grow (per-file ratchet).
 *   2. Inline font-family must be var(--wd-font-*) — never a literal stack.
 *   3. Google Fonts URLs may only load Playfair Display.
 *   4. Font tokens in tailwind.css may not quote a comma list as one name
 *      ('Caveat, cursive' is one font called "Caveat, cursive" — it never matches).
 *   5. No Tailwind class names assembled at runtime (`bg-wd-${key}`, 'text-' + c):
 *      Tailwind only generates classes it finds literally in source, so a built
 *      name silently renders nothing (the white swatches on /docs/design/foundations/colors).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const BASELINE_PATH = join(ROOT, 'scripts/design-guardrails/baseline.json')
export const TAILWIND_CSS = 'app/assets/css/tailwind.css'

/** Paths (posix, relative to repo root) that may hold literal colours/fonts. */
const EXEMPT: RegExp[] = [
  /^app\/pages\/sketches\//, // frozen design explorations
  /^app\/data\/mock-[^/]*\.ts$/, // festival accents are content
  /^app\/lib\/brand\.ts$/, // the JS mirror of the tokens
  /^app\/assets\/css\/tailwind\.css$/, // where tokens are defined
  /\.test\.ts$/,
]

export function listAppFiles(dir = join(ROOT, 'app')): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) out.push(...listAppFiles(abs))
    else if (/\.(vue|ts)$/.test(name)) {
      const rel = relative(ROOT, abs).split(sep).join('/')
      if (!EXEMPT.some(re => re.test(rel))) out.push(rel)
    }
  }
  return out.sort()
}

// `#` not preceded by `&` (HTML entity) or an identifier char (URL fragments like a#b).
const HEX_RE = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/g

export interface Hit { file: string, line: number, text: string }

function lineOf(src: string, index: number) {
  return src.slice(0, index).split('\n').length
}

export function scanHex(files = listAppFiles()) {
  const perFile: Record<string, number> = {}
  const hits: Hit[] = []
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), 'utf8')
    for (const m of src.matchAll(HEX_RE)) {
      perFile[file] = (perFile[file] ?? 0) + 1
      hits.push({ file, line: lineOf(src, m.index!), text: m[0] })
    }
  }
  return { perFile, hits, total: hits.length }
}

// font-family: …  /  fontFamily: '…'  (CSS, inline style strings, :style objects)
const FONT_RE = /(?:font-family|fontFamily)\s*:\s*([^;}\n]+)/g

export function scanFontFamily(files = listAppFiles()) {
  const perFile: Record<string, number> = {}
  const hits: Hit[] = []
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), 'utf8')
    for (const m of src.matchAll(FONT_RE)) {
      // JS object literal (`fontFamily: 'var(--x)', …`) → the quoted value;
      // CSS / style string → up to `;`, minus trailing quote chars.
      const raw = m[1]!.trim()
      const quoted = /^(['"`])(.*?)\1/.exec(raw)
      const value = (quoted ? quoted[2]! : raw.replace(/['"`,]+$/g, '')).trim()
      if (/^var\(--wd-font-[\w-]+\)$/.test(value)) continue
      if (/^(inherit|initial|unset)$/.test(value)) continue
      perFile[file] = (perFile[file] ?? 0) + 1
      hits.push({ file, line: lineOf(src, m.index!), text: m[0].trim() })
    }
  }
  return { perFile, hits }
}

const GFONTS_RE = /https:\/\/fonts\.googleapis\.com\/css2?\?[^'"`\s)]+/g
export const ALLOWED_GOOGLE_FAMILIES = ['Playfair Display', 'Caveat']

export function scanGoogleFonts(files = [...listAppFiles(), 'nuxt.config.ts']) {
  const hits: Hit[] = []
  for (const file of files) {
    let src: string
    try { src = readFileSync(join(ROOT, file), 'utf8') }
    catch { continue }
    for (const m of src.matchAll(GFONTS_RE)) {
      const url = new URL(m[0].replace(/&amp;/g, '&'))
      const families = url.searchParams.getAll('family').map(f => f.split(':')[0]!.replace(/\+/g, ' '))
      for (const fam of families) {
        if (!ALLOWED_GOOGLE_FAMILIES.includes(fam))
          hits.push({ file, line: lineOf(src, m.index!), text: fam })
      }
    }
  }
  return hits
}

/** A quoted string containing a comma inside a font declaration = one bogus family name. */
export function scanQuotedFontLists(file = TAILWIND_CSS) {
  return findQuotedFontLists(readFileSync(join(ROOT, file), 'utf8'), file)
}

export function findQuotedFontLists(src: string, file = '<inline>') {
  const hits: Hit[] = []
  const re = /(?:font-family|--(?:wd-)?font-[\w-]+)\s*:\s*([^;]+);/g
  for (const m of src.matchAll(re)) {
    for (const q of m[1]!.matchAll(/(['"])([^'"]*,[^'"]*)\1/g))
      hits.push({ file, line: lineOf(src, m.index!), text: q[0] })
  }
  return hits
}

const UTILITY = '(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|decoration|accent|caret|divide|placeholder)'
// `…bg-${x}…`  or  'bg-' + x  /  "text-wd-" + x
const DYNAMIC_CLASS_RE = new RegExp(
  '(?<![\\w-])' + UTILITY + '-(?:[\\w-]*-)?(?:\\$\\{|[\'"]\\s*\\+)',
  'g',
)

export function scanDynamicClasses(files = listAppFiles()) {
  return files.flatMap(file => findDynamicClasses(readFileSync(join(ROOT, file), 'utf8'), file))
}

export function findDynamicClasses(src: string, file = '<inline>') {
  const hits: Hit[] = []
  for (const m of src.matchAll(DYNAMIC_CLASS_RE))
    hits.push({ file, line: lineOf(src, m.index!), text: src.slice(m.index!, m.index! + 40).split('\n')[0]! })
  return hits
}

export interface Baseline {
  $comment?: string
  hex: { total: number, perFile: Record<string, number> }
  fontFamily: { perFile: Record<string, number> }
}

export function readBaseline(): Baseline {
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

export function currentBaseline(): Baseline {
  const hex = scanHex()
  const font = scanFontFamily()
  return {
    $comment: 'Design-system ratchet. Numbers may only go DOWN. Regenerate with `bun scripts/design-guardrails/update-baseline.ts` after removing hex/font literals. See docs/design-system.md → Guardrails.',
    hex: { total: hex.total, perFile: hex.perFile },
    fontFamily: { perFile: font.perFile },
  }
}

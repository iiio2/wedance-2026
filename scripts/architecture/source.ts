/**
 * Tiny static-analysis helpers for the architecture generator.
 *
 * Deliberately regex/tokenizer based (no TypeScript compiler dependency): the
 * server code follows a small set of shapes (top-level `function` / `const`
 * declarations, `name: xProcedure` router keys, named imports), and that is all
 * the "which tables does this touch" question needs. It over-approximates
 * rather than under-approximates — a table mentioned in a helper the procedure
 * calls counts as touched.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/** Replace comments with spaces (keeps offsets/line numbers), leave strings intact. */
export function stripComments(src: string): string {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]!
    const next = src[i + 1]
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++ }
      continue
    }
    if (c === '/' && next === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++ }
      out += '  '
      i += 2
      continue
    }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c
      out += c
      i++
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') { out += src[i]! + (src[i + 1] ?? ''); i += 2; continue }
        if (q !== '`' && src[i] === '\n') break
        out += src[i]
        i++
      }
      if (i < n) { out += src[i]; i++ }
      continue
    }
    out += c
    i++
  }
  return out
}

export interface ImportBinding {
  local: string
  imported: string // 'default' | '*' | export name
  from: string // absolute path without extension resolution applied
}

const IMPORT_RE = /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g

export function parseImports(src: string, file: string): ImportBinding[] {
  const out: ImportBinding[] = []
  for (const m of src.matchAll(IMPORT_RE)) {
    if (m[1]) continue // type-only import
    const clause = m[2]!.trim()
    const spec = m[3]!
    if (!spec.startsWith('.')) continue
    const from = resolveModule(resolve(dirname(file), spec))
    if (!from) continue
    const named = clause.match(/\{([\s\S]*)\}/)
    const head = clause.replace(/\{[\s\S]*\}/, '').replace(/,\s*$/, '').trim()
    if (head.startsWith('* as ')) out.push({ local: head.slice(5).trim(), imported: '*', from })
    else if (head) out.push({ local: head.replace(/,$/, '').trim(), imported: 'default', from })
    if (named) {
      for (const part of named[1]!.split(',')) {
        const p = part.trim()
        if (!p || p.startsWith('type ')) continue
        const [imported, local] = p.split(/\s+as\s+/).map(s => s.trim())
        out.push({ local: local ?? imported!, imported: imported!, from })
      }
    }
  }
  return out
}

export function resolveModule(base: string): string | null {
  for (const cand of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (existsSync(cand) && cand.endsWith('.ts')) return cand
  }
  return null
}

export interface Decl { name: string, start: number, end: number }

const DECL_RE = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+([A-Za-z_$][\w$]*))/gm
const EXPORT_DEFAULT_RE = /^export\s+default\b/gm

/** Top-level (column-0) declarations and their source spans. */
export function topLevelDecls(src: string): Decl[] {
  const marks: { name: string, start: number }[] = []
  for (const m of src.matchAll(DECL_RE)) marks.push({ name: m[1] ?? m[2]!, start: m.index! })
  for (const m of src.matchAll(EXPORT_DEFAULT_RE)) {
    if (!marks.some(d => d.start === m.index)) marks.push({ name: 'default', start: m.index! })
  }
  // Any other column-0 statement (import, type, interface, …) also ends a span.
  const boundaries = new Set<number>(marks.map(d => d.start))
  for (const m of src.matchAll(/^[A-Za-z_$@]/gm)) boundaries.add(m.index!)
  const sorted = [...boundaries].sort((a, b) => a - b)
  return marks.map((d) => {
    const nextB = sorted.find(b => b > d.start)
    return { name: d.name, start: d.start, end: nextB ?? src.length }
  })
}

/** Identifiers used in a span, ignoring property names (`a.b`, `{ b: … }`). */
export function identifiersIn(text: string): Set<string> {
  const out = new Set<string>()
  const re = /[A-Za-z_$][\w$]*/g
  for (const m of text.matchAll(re)) {
    const i = m.index!
    const prev = text[i - 1]
    if (prev === '.' && text[i - 2] !== '.') continue
    if (prev && /[\w$'"`]/.test(prev)) continue
    const after = text.slice(i + m[0].length).match(/^\s*(\??:)/)
    if (after && after[1] === ':') {
      const before = text.slice(0, i).trimEnd()
      if (!before.endsWith('?')) continue
    }
    out.add(m[0])
  }
  return out
}

interface FileInfo { src: string, imports: Map<string, ImportBinding>, decls: Map<string, Decl> }

/**
 * Resolves "which schema tables does this piece of code reach", following
 * same-file helpers and relative imports transitively.
 */
export class TableReach {
  private files = new Map<string, FileInfo>()
  private memo = new Map<string, Set<string>>()

  constructor(private schemaFile: string, private tableVars: Set<string>) {}

  file(path: string): FileInfo {
    let f = this.files.get(path)
    if (!f) {
      const src = stripComments(readFileSync(path, 'utf8'))
      const imports = new Map(parseImports(src, path).map(b => [b.local, b]))
      const decls = new Map(topLevelDecls(src).map(d => [d.name, d]))
      f = { src, imports, decls }
      this.files.set(path, f)
    }
    return f
  }

  /** Tables reached from an arbitrary text span of `path`. */
  fromText(path: string, text: string, seen = new Set<string>()): Set<string> {
    const f = this.file(path)
    const out = new Set<string>()
    const ids = identifiersIn(text)
    for (const id of ids) {
      if (path === this.schemaFile && this.tableVars.has(id)) { out.add(id); continue }
      const imp = f.imports.get(id)
      if (imp) {
        if (imp.from === this.schemaFile) {
          if (imp.imported === '*') {
            for (const m of text.matchAll(new RegExp(`\\b${id}\\.([A-Za-z_$][\\w$]*)`, 'g'))) if (this.tableVars.has(m[1]!)) out.add(m[1]!)
          }
          else if (this.tableVars.has(imp.imported)) out.add(imp.imported)
          continue
        }
        if (imp.imported === '*') continue
        for (const t of this.fromDecl(imp.from, imp.imported, seen)) out.add(t)
        continue
      }
      if (f.decls.has(id)) for (const t of this.fromDecl(path, id, seen)) out.add(t)
    }
    return out
  }

  fromDecl(path: string, name: string, seen = new Set<string>()): Set<string> {
    const key = `${path}#${name}`
    const cached = this.memo.get(key)
    if (cached) return cached
    if (seen.has(key)) return new Set()
    seen.add(key)
    const f = this.file(path)
    const d = f.decls.get(name)
    if (!d) {
      // Re-export (`export { x } from './y'`) or not found — give up quietly.
      return new Set()
    }
    const res = this.fromText(path, f.src.slice(d.start, d.end), seen)
    this.memo.set(key, res)
    return res
  }

  /** Tables reached by a whole file (every top-level declaration). */
  fromFile(path: string): Set<string> {
    return this.fromText(path, this.file(path).src)
  }
}

/** The first JSDoc / block comment of a file, cleaned up. */
export function leadingDoc(raw: string): string | null {
  const m = raw.match(/\/\*\*?([\s\S]*?)\*\//)
  if (!m) return null
  return m[1]!
    .split('\n')
    .map(l => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim()
}

export function lineOf(src: string, index: number): number {
  return src.slice(0, index).split('\n').length
}

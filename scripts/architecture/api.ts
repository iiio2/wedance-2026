/**
 * API catalog extraction.
 *
 * tRPC: the procedure list, kind (query/mutation), input schema and auth level
 * come from the LIVE appRouter object — auth level is decided by middleware
 * identity (does the procedure carry adminProcedure's / protectedProcedure's
 * middleware?), not by reading source. Source text is used only to locate each
 * procedure (file:line) and to statically resolve the tables it touches.
 *
 * REST: every file under server/api (and server/routes, if it appears) except
 * tests and *.lib.ts helpers. Method + path come from the file name (Nitro's
 * own convention); purpose from the file's leading comment.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { z } from 'zod'
import { TableReach, leadingDoc, lineOf, parseImports, stripComments } from './source'

export type AuthLevel = 'public' | 'protected' | 'admin'

export interface ProcedureDoc {
  path: string // router.procedure
  router: string
  name: string
  kind: 'query' | 'mutation' | 'subscription'
  auth: AuthLevel
  input: unknown | null
  tables: string[] // SQL table names
  file: string
  line: number
}

export interface RestDoc {
  method: string
  path: string
  file: string
  auth: 'public' | 'session' | 'admin' | 'signature'
  purpose: string | null
  tables: string[]
}

export interface RouterDoc { name: string, file: string, procedures: number, summary: string | null }

interface ApiInput {
  rootDir: string
  appRouter: any
  protectedMiddlewares: unknown[]
  adminMiddlewares: unknown[]
  reach: TableReach
  sqlName: (tableKey: string) => string
}

function authOf(mws: unknown[], input: ApiInput): AuthLevel {
  if (input.adminMiddlewares.some(m => mws.includes(m))) return 'admin'
  if (input.protectedMiddlewares.some(m => mws.includes(m))) return 'protected'
  return 'public'
}

function inputSchema(inputs: unknown[]): unknown | null {
  if (!inputs?.length) return null
  const schemas = inputs.map((i) => {
    try {
      const js = z.toJSONSchema(i as z.ZodType, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>
      delete js.$schema
      return js
    }
    catch {
      return { description: '(schema not representable as JSON Schema)' }
    }
  })
  return schemas.length === 1 ? schemas[0] : { allOf: schemas }
}

/** appRouter key → router source file, from server/trpc/index.ts imports. */
function routerFiles(rootDir: string): Map<string, string> {
  const indexFile = join(rootDir, 'server/trpc/index.ts')
  const src = stripComments(readFileSync(indexFile, 'utf8'))
  const imports = new Map(parseImports(src, indexFile).map(b => [b.local, b.from]))
  const body = src.slice(src.indexOf('router({'))
  const out = new Map<string, string>()
  for (const m of body.matchAll(/^[ \t]+(\w+):[ \t]*(\w+),?[ \t]*$/gm)) {
    const file = imports.get(m[2]!)
    if (file) out.set(m[1]!, file)
  }
  return out
}

export function extractTrpc(input: ApiInput): { procedures: ProcedureDoc[], routers: RouterDoc[] } {
  const files = routerFiles(input.rootDir)
  const procs = input.appRouter._def.procedures as Record<string, any>
  const procedures: ProcedureDoc[] = []
  const located = new Map<string, { line: number, span: string }>()

  for (const [routerName, file] of files) {
    const src = input.reach.file(file).src
    const re = /^([ \t]+)(\w+):\s*(public|protected|admin)Procedure\b/gm
    const hits = [...src.matchAll(re)]
    const indent = hits[0]?.[1]
    const own = hits.filter(h => h[1] === indent)
    own.forEach((h, i) => {
      const start = h.index!
      const end = own[i + 1]?.index ?? src.length
      located.set(`${routerName}.${h[2]}`, { line: lineOf(src, start), span: src.slice(start, end) })
    })
  }

  for (const [path, proc] of Object.entries(procs)) {
    const def = proc._def
    const [routerName, ...rest] = path.split('.')
    const file = files.get(routerName!)
    const loc = located.get(path)
    const tables = file && loc ? [...input.reach.fromText(file, loc.span)].map(input.sqlName).sort() : []
    procedures.push({
      path,
      router: routerName!,
      name: rest.join('.'),
      kind: def.type,
      auth: authOf(def.middlewares ?? [], input),
      input: inputSchema(def.inputs ?? []),
      tables,
      file: file ? relative(input.rootDir, file) : '',
      line: loc?.line ?? 0,
    })
  }

  const routers: RouterDoc[] = [...files].map(([name, file]) => {
    const raw = readFileSync(file, 'utf8')
    return {
      name,
      file: relative(input.rootDir, file),
      procedures: procedures.filter(p => p.router === name).length,
      summary: routerSummary(raw),
    }
  })
  return { procedures, routers }
}

/** The first doc comment in a router file that isn't a license/import note. */
function routerSummary(raw: string): string | null {
  const doc = leadingDoc(raw)
  if (!doc) return null
  return firstParagraph(doc)
}

function firstParagraph(doc: string): string {
  return doc.split(/\n\s*\n/)[0]!.replace(/\s+/g, ' ').trim()
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

export function extractRest(input: Pick<ApiInput, 'rootDir' | 'reach' | 'sqlName'>): RestDoc[] {
  const out: RestDoc[] = []
  for (const base of ['server/api', 'server/routes']) {
    const dir = join(input.rootDir, base)
    for (const file of walk(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file.endsWith('.lib.ts')) continue
      const rel = relative(dir, file).replace(/\.ts$/, '')
      const m = rel.match(/^(.*?)(?:\.(get|post|put|patch|delete|head|options))?$/)!
      const route = m[1]!.replace(/(^|\/)index$/, '').replace(/\[\.\.\.(\w*)\]/g, '**').replace(/\[(\w+)\]/g, ':$1')
      const urlPath = `${base === 'server/api' ? '/api' : ''}/${route}`.replace(/\/$/, '') || '/'
      const raw = readFileSync(file, 'utf8')
      const code = stripComments(raw)
      let auth: RestDoc['auth'] = 'public'
      if (/constructEvent|x-tt-signature|timingSafeEqual/.test(code)) auth = 'signature'
      else if (/requireAdmin|isAdmin/.test(code)) auth = 'admin'
      else if (/createContext|authorization/.test(code)) auth = 'session'
      // The tRPC endpoint authenticates per procedure; document it as such.
      const isTrpc = /fetchRequestHandler/.test(code)
      if (isTrpc) auth = 'session'
      const doc = leadingDoc(raw)
      let purpose = doc ? firstParagraph(doc.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+\/\S+[^\n]*\n+/, '')) : null
      if (!purpose && isTrpc) purpose = 'tRPC endpoint — dispatches every procedure in the API catalog below.'
      out.push({
        method: (m[2] ?? 'any').toUpperCase(),
        path: urlPath,
        file: relative(input.rootDir, file),
        auth,
        purpose,
        // The tRPC endpoint reaches every table through appRouter; its
        // procedures carry their own table lists, so don't repeat them here.
        tables: isTrpc ? [] : [...input.reach.fromFile(file)].map(input.sqlName).sort(),
      })
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
}

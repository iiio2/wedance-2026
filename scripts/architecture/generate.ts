/**
 * Generates the data behind /architecture from the code itself, so the docs
 * cannot drift (see docs/architecture/adr/000-generated-architecture-docs.md).
 *
 *   bun scripts/architecture/generate.ts      # manual run
 *
 * Runs automatically on `nuxt dev`, `nuxt build` and `nuxt prepare` via
 * scripts/architecture/nuxt-module.ts. Output (gitignored):
 *   app/generated/architecture/*.json         public — bundled into the pages
 *   server/assets/architecture/admin.json     admin-only — served by
 *                                             GET /api/architecture/admin
 * Admin-level tRPC procedures are written ONLY to the admin file.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMAINS } from './domains'
import { extractDataModel, type TableDoc } from './data-model'
import { extractRest, extractTrpc, type ProcedureDoc, type RestDoc, type RouterDoc } from './api'
import { TableReach } from './source'
import { parseFrontmatter, renderMarkdownParts, type DocPart } from './markdown'

export const PUBLIC_OUT = 'app/generated/architecture'
export const ADMIN_OUT = 'server/assets/architecture'

export type StoryStatus = 'built' | 'partial' | 'missing' | 'unknown'
export interface StoryDoc {
  id: string
  title: string
  url: string | null
  journey: string | null
  actor: string | null
  story: string | null
  status: StoryStatus
  tables: string[]
  procedures: string[]
  routes: string[]
  evidence: string | null
  notes: string | null
  /** Admin-level procedures this story references (names withheld publicly). */
  adminProcedures: number
  unknownProcedures: string[]
  unknownTables: string[]
  unknownRoutes: string[]
}

export interface StoriesDoc {
  state: 'ok' | 'missing' | 'invalid'
  error: string | null
  source: string
  generatedAt: string | null
  sources: string[]
  stories: StoryDoc[]
  unmappedProcedures: string[]
  unknownProcedures: string[]
}

/**
 * A rendered doc under docs/architecture: an ADR (`adr/`), an architecture review
 * (`review/`) or a target-design doc (`target/`). All render on /architecture/decisions.
 */
export type DocKind = 'review' | 'target' | 'adr'
export interface AdrDoc { id: string, kind: DocKind, slug: string, file: string, title: string, status: string, date: string | null, summary: string | null, parts: DocPart[] }

export interface UsedBy { procedures: string[], rest: string[] }

export interface Architecture {
  meta: { generatedAt: string, counts: { tables: number, procedures: number, publicProcedures: number, adminProcedures: number, routers: number, rest: number, stories: number, adrs: number } }
  data: { domains: { id: string, title: string, summary: string, tables: string[] }[], tables: (TableDoc & { usedBy: UsedBy })[] }
  api: { routers: RouterDoc[], procedures: ProcedureDoc[], rest: RestDoc[], adminProcedureCount: number }
  stories: StoriesDoc
  decisions: AdrDoc[]
  admin: { procedures: ProcedureDoc[], routers: RouterDoc[], tables: Record<string, string[]>, unmappedProcedures: string[], storyRefs: Record<string, string[]> }
}

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))

function pageRoutes(rootDir: string): string[] {
  const dir = join(rootDir, 'app/pages')
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])
  return walk(dir)
    .filter(f => f.endsWith('.vue'))
    .map(f => `/${relative(dir, f).replace(/\.vue$/, '').replace(/(^|\/)index$/, '')}`.replace(/\/$/, '') || '/')
}

function routeMatches(storyRoute: string, routes: string[]): boolean {
  const norm = (r: string) => r.split('?')[0]!.replace(/\/$/, '') || '/'
  const target = norm(storyRoute)
  const toRe = (r: string) => new RegExp(`^${r.replace(/\[\.\.\.\w*\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/]+').replace(/@/g, '@')}$`)
  return routes.some(r => r === target || toRe(r).test(target) || toRe(target).test(r))
}

/**
 * Story free text (title, notes, evidence) is written by people/agents and may
 * mention admin procedures. The public output must not carry their names, so
 * replace full paths (`admin.assignGroups`) and distinctive bare names
 * (camelCase, not also a public procedure or a table export name).
 */
export function adminNameScrubber(procedures: ProcedureDoc[], tableKeys: Set<string>) {
  const admin = procedures.filter(p => p.auth === 'admin')
  const publicNames = new Set(procedures.filter(p => p.auth !== 'admin').map(p => p.name))
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const paths = admin.map(p => esc(p.path))
  const bare = admin.map(p => p.name).filter(n => /[a-z][A-Z]/.test(n) && !publicNames.has(n) && !tableKeys.has(n)).map(esc)
  const re = paths.length ? new RegExp(`\\b(?:${[...paths, ...bare].join('|')})\\b`, 'g') : null
  return (text: string | null) => (text && re ? text.replace(re, '(admin procedure)') : text)
}

function readStories(rootDir: string, storiesPath: string, ctx: { procedures: ProcedureDoc[], tableName: (t: string) => string | null, routes: string[], scrub: (t: string | null) => string | null }): { doc: StoriesDoc, adminRefs: Record<string, string[]> } {
  const source = relative(rootDir, storiesPath)
  const empty: StoriesDoc = { state: 'missing', error: null, source, generatedAt: null, sources: [], stories: [], unmappedProcedures: [], unknownProcedures: [] }
  const byPath = new Map(ctx.procedures.map(p => [p.path, p]))
  const publicPaths = ctx.procedures.filter(p => p.auth !== 'admin').map(p => p.path)
  const adminPaths = ctx.procedures.filter(p => p.auth === 'admin').map(p => p.path)
  if (!existsSync(storiesPath)) {
    return { doc: { ...empty, unmappedProcedures: publicPaths }, adminRefs: { unmapped: adminPaths } }
  }
  let raw: any
  try {
    raw = JSON.parse(readFileSync(storiesPath, 'utf8'))
    if (!raw || !Array.isArray(raw.stories)) throw new Error('expected { stories: [...] }')
  }
  catch (err) {
    return { doc: { ...empty, state: 'invalid', error: (err as Error).message, unmappedProcedures: publicPaths }, adminRefs: { unmapped: adminPaths } }
  }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const referenced = new Set<string>()
  const unknown = new Set<string>()
  const adminRefs: Record<string, string[]> = {}
  const stories: StoryDoc[] = raw.stories.map((s: any, i: number): StoryDoc => {
    const procs = arr(s.procedures)
    procs.forEach(p => referenced.add(p))
    const missing = procs.filter(p => !byPath.has(p))
    missing.forEach(p => unknown.add(p))
    const admin = procs.filter(p => byPath.get(p)?.auth === 'admin')
    const id = str(s.id) ?? `story-${i + 1}`
    if (admin.length) adminRefs[id] = admin
    const status = (['built', 'partial', 'missing', 'unknown'] as const).includes(s.status) ? s.status : 'unknown'
    return {
      id,
      title: ctx.scrub(str(s.title)) ?? '(untitled)',
      url: str(s.url),
      journey: str(s.journey),
      actor: str(s.actor),
      story: ctx.scrub(str(s.story)),
      status,
      // Stories may name a table by SQL name or Drizzle export name; normalise to SQL.
      tables: arr(s.tables).map(t => ctx.tableName(t) ?? t),
      procedures: procs.filter(p => byPath.get(p)?.auth !== 'admin'),
      routes: arr(s.routes),
      evidence: ctx.scrub(str(s.evidence)),
      notes: ctx.scrub(str(s.notes)),
      adminProcedures: admin.length,
      unknownProcedures: missing,
      unknownTables: arr(s.tables).filter(t => !ctx.tableName(t)),
      unknownRoutes: arr(s.routes).filter(r => !routeMatches(r, ctx.routes)),
    }
  })
  return {
    doc: {
      state: 'ok',
      error: null,
      source,
      generatedAt: str(raw.generatedAt),
      sources: arr(raw.sources),
      stories,
      unmappedProcedures: publicPaths.filter(p => !referenced.has(p)),
      unknownProcedures: [...unknown].sort(),
    },
    adminRefs: { ...adminRefs, unmapped: adminPaths.filter(p => !referenced.has(p)) },
  }
}

const DOC_DIRS: { kind: DocKind, dir: string, prefix: string }[] = [
  { kind: 'review', dir: 'docs/architecture/review', prefix: 'REVIEW' },
  { kind: 'target', dir: 'docs/architecture/target', prefix: 'TARGET' },
  { kind: 'adr', dir: 'docs/architecture/adr', prefix: 'ADR' },
]

/**
 * Reads every doc under docs/architecture/{review,target,adr}. `scrub` replaces
 * admin-level procedure names (they must never reach the public bundle, ADR-000).
 */
function readDocs(rootDir: string, scrub: (t: string | null) => string | null = t => t): AdrDoc[] {
  return DOC_DIRS.flatMap(({ kind, dir, prefix }) => {
    const abs = join(rootDir, dir)
    if (!existsSync(abs)) return []
    return readdirSync(abs)
      .filter(f => f.endsWith('.md'))
      .sort()
      .map((f): AdrDoc => {
        const { data, body } = parseFrontmatter(scrub(readFileSync(join(abs, f), 'utf8'))!)
        const slug = f.replace(/\.md$/, '')
        const num = slug.match(/^(\d+)-/)?.[1]
        return {
          id: data.id ?? (kind === 'adr' && num ? `ADR-${num.padStart(3, '0')}` : `${prefix}`),
          kind,
          slug,
          file: `${dir}/${f}`,
          title: data.title ?? slug,
          status: data.status ?? 'proposed',
          date: data.date ?? null,
          summary: data.summary ?? null,
          parts: renderMarkdownParts(body),
        }
      })
  })
}

export interface BuildOptions { rootDir?: string, storiesPath?: string }

export async function buildArchitecture(opts: BuildOptions = {}): Promise<Architecture> {
  const rootDir = opts.rootDir ?? ROOT
  const schemaFile = join(rootDir, 'server/database/schema.ts')
  const schema = await import(schemaFile) as Record<string, unknown>
  const { appRouter } = await import(join(rootDir, 'server/trpc/index.ts'))
  const { adminProcedure, protectedProcedure } = await import(join(rootDir, 'server/trpc/trpc.ts'))

  const domainOf = (key: string) => DOMAINS.find(d => d.tables.includes(key))?.id ?? 'unassigned'
  const tables = extractDataModel(schema, readFileSync(schemaFile, 'utf8'), domainOf)
  const sqlNameOf = new Map(tables.map(t => [t.key, t.name]))
  const reach = new TableReach(schemaFile, new Set(sqlNameOf.keys()))
  const sqlName = (k: string) => sqlNameOf.get(k) ?? k

  const { procedures, routers } = extractTrpc({
    rootDir,
    appRouter,
    adminMiddlewares: adminProcedure._def.middlewares,
    protectedMiddlewares: protectedProcedure._def.middlewares,
    reach,
    sqlName,
  })
  const rest = extractRest({ rootDir, reach, sqlName })

  const publicProcs = procedures.filter(p => p.auth !== 'admin')
  const adminProcs = procedures.filter(p => p.auth === 'admin')

  const usage = (procs: ProcedureDoc[]) => {
    const m: Record<string, string[]> = {}
    for (const p of procs) for (const t of p.tables) (m[t] ??= []).push(p.path)
    return m
  }
  const publicUsage = usage(publicProcs)
  const adminUsage = usage(adminProcs)
  const restUsage: Record<string, string[]> = {}
  for (const r of rest) for (const t of r.tables) (restUsage[t] ??= []).push(`${r.method} ${r.path}`)

  const routes = pageRoutes(rootDir)
  const storiesPath = opts.storiesPath ?? join(rootDir, 'docs/architecture/stories.json')
  const sqlNames = new Set(tables.map(t => t.name))
  const tableName = (t: string) => (sqlNames.has(t) ? t : sqlNameOf.get(t) ?? null)
  const { doc: stories, adminRefs } = readStories(rootDir, storiesPath, { procedures, tableName, routes, scrub: adminNameScrubber(procedures, new Set(sqlNameOf.keys())) })
  const decisions = readDocs(rootDir, adminNameScrubber(procedures, new Set(sqlNameOf.keys())))

  const publicRouters = routers
    .map(r => ({ ...r, procedures: publicProcs.filter(p => p.router === r.name).length }))
    .filter(r => r.procedures > 0)

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      counts: {
        tables: tables.length,
        procedures: procedures.length,
        publicProcedures: publicProcs.length,
        adminProcedures: adminProcs.length,
        routers: routers.length,
        rest: rest.length,
        stories: stories.stories.length,
        adrs: decisions.filter(d => d.kind === 'adr').length,
      },
    },
    data: {
      domains: DOMAINS.map(d => ({ ...d, tables: d.tables.map(sqlName) })),
      tables: tables.map(t => ({ ...t, usedBy: { procedures: publicUsage[t.name] ?? [], rest: restUsage[t.name] ?? [] } })),
    },
    api: { routers: publicRouters, procedures: publicProcs, rest, adminProcedureCount: adminProcs.length },
    stories,
    decisions,
    admin: {
      procedures: adminProcs,
      routers: routers.filter(r => adminProcs.some(p => p.router === r.name)).map(r => ({ ...r, procedures: adminProcs.filter(p => p.router === r.name).length })),
      tables: adminUsage,
      unmappedProcedures: adminRefs.unmapped ?? [],
      storyRefs: Object.fromEntries(Object.entries(adminRefs).filter(([k]) => k !== 'unmapped')),
    },
  }
}

export async function writeArchitecture(opts: BuildOptions = {}): Promise<Architecture> {
  const rootDir = opts.rootDir ?? ROOT
  const arch = await buildArchitecture(opts)
  const pub = join(rootDir, PUBLIC_OUT)
  const adm = join(rootDir, ADMIN_OUT)
  mkdirSync(pub, { recursive: true })
  mkdirSync(adm, { recursive: true })
  const write = (file: string, data: unknown) => {
    const next = `${JSON.stringify(data, null, 2)}\n`
    // Skip unchanged files so dev-server HMR doesn't churn.
    if (existsSync(file) && readFileSync(file, 'utf8') === next) return
    writeFileSync(file, next)
  }
  const { generatedAt: _, ...stableMeta } = arch.meta
  write(join(pub, 'meta.json'), stableMeta)
  write(join(pub, 'data.json'), arch.data)
  write(join(pub, 'api.json'), arch.api)
  write(join(pub, 'stories.json'), arch.stories)
  write(join(pub, 'decisions.json'), arch.decisions)
  write(join(adm, 'admin.json'), arch.admin)
  return arch
}

if (import.meta.main || process.argv[1] === fileURLToPath(import.meta.url)) {
  writeArchitecture().then((a) => {
    const c = a.meta.counts
    console.log(`architecture: ${c.tables} tables, ${c.procedures} procedures (${c.adminProcedures} admin), ${c.rest} REST handlers, ${c.stories} stories, ${c.adrs} ADRs`)
  }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

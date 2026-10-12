/**
 * Drift guard for the generated /architecture docs (ADR-000): fails when a
 * table or tRPC procedure that exists in the code is missing from the generated
 * output, when a table has no bounded context, or when an admin-level procedure
 * leaks into the public (client-bundled) files.
 */
import { describe, expect, it, beforeAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { is } from 'drizzle-orm'
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core'
import * as schema from '../../server/database/schema'
import { appRouter } from '../../server/trpc'
import { buildArchitecture, type Architecture } from './generate'
import { DOMAINS } from './domains'
import { renderMarkdown } from './markdown'

const FIXTURE = fileURLToPath(new URL('./__fixtures__/stories.json', import.meta.url))
const tableKeys = Object.entries(schema).filter(([, v]) => is(v, PgTable)).map(([k]) => k)
const tableNames = Object.values(schema).filter(v => is(v, PgTable)).map(v => getTableConfig(v as PgTable).name)
const procedurePaths = Object.keys((appRouter as any)._def.procedures)

let arch: Architecture
beforeAll(async () => {
  arch = await buildArchitecture({ storiesPath: FIXTURE })
}, 60_000)

describe('generated data model', () => {
  it('documents every table in the schema', () => {
    expect(arch.data.tables.map(t => t.name).sort()).toEqual([...tableNames].sort())
  })

  it('assigns every table to exactly one bounded context', () => {
    const assigned = DOMAINS.flatMap(d => d.tables)
    expect(assigned.filter(k => !tableKeys.includes(k)), 'names in domains.ts that are not tables').toEqual([])
    expect(tableKeys.filter(k => !assigned.includes(k)), 'tables missing from domains.ts').toEqual([])
    expect(new Set(assigned).size, 'a table is in two contexts').toBe(assigned.length)
  })

  it('documents every column of every table', () => {
    for (const [key, value] of Object.entries(schema)) {
      if (!is(value, PgTable)) continue
      const cfg = getTableConfig(value as PgTable)
      const doc = arch.data.tables.find(t => t.key === key)!
      expect(doc.columns.map(c => c.name), key).toEqual(cfg.columns.map(c => c.name))
    }
  })

  it('resolves foreign keys and literal unions', () => {
    const sessions = arch.data.tables.find(t => t.name === 'sessions')!
    expect(sessions.foreignKeys[0]).toMatchObject({ columns: ['dancer_id'], table: 'dancers' })
    const status = arch.data.tables.find(t => t.name === 'city_videos')!.columns.find(c => c.name === 'status')!
    expect(status.enum).toEqual(['pending', 'approved', 'rejected'])
  })
})

describe('generated API catalog', () => {
  it('documents every tRPC procedure (public file + admin file together)', () => {
    const documented = [...arch.api.procedures, ...arch.admin.procedures].map(p => p.path).sort()
    expect(documented).toEqual([...procedurePaths].sort())
  })

  it('locates every procedure in its router source', () => {
    const unlocated = [...arch.api.procedures, ...arch.admin.procedures].filter(p => !p.file || !p.line).map(p => p.path)
    expect(unlocated).toEqual([])
  })

  it('reads auth level from middleware: admin procedures are exactly the adminProcedure ones', () => {
    expect(arch.admin.procedures.length).toBeGreaterThan(0)
    expect(arch.admin.procedures.every(p => p.auth === 'admin')).toBe(true)
    expect(arch.api.procedures.some(p => p.auth === 'admin')).toBe(false)
    expect(arch.api.procedures.find(p => p.path === 'auth.me')?.auth).toBe('public')
  })

  it('never puts admin procedure names in the public output', () => {
    const publicJson = JSON.stringify({ meta: arch.meta, data: arch.data, api: arch.api, stories: arch.stories, decisions: arch.decisions })
    for (const p of arch.admin.procedures) expect(publicJson, p.path).not.toContain(p.path)
    // Distinctive bare names too (fixture notes mention `assignGroups`).
    expect(publicJson).not.toContain('assignGroups')
    expect(arch.stories.stories[0]!.notes).toContain('(admin procedure)')
  })

  it('documents every REST handler under server/api', () => {
    const paths = arch.api.rest.map(r => `${r.method} ${r.path}`)
    expect(paths).toContain('POST /api/stripe/webhook')
    expect(paths).toContain('POST /api/webhooks/tickettailor')
    expect(paths).toContain('GET /api/cities/:slug')
    expect(paths.some(p => p.includes('.lib') || p.includes('.test'))).toBe(false)
  })

  it('finds the tables a procedure touches', () => {
    expect(arch.api.procedures.find(p => p.path === 'events.byProfile')?.tables).toContain('events')
  })
})

describe('stories cross-check', () => {
  it('flags unknown procedures, tables and routes and hides admin procedure names', () => {
    const s = arch.stories.stories[0]!
    expect(arch.stories.state).toBe('ok')
    expect(s.unknownProcedures).toEqual(['events.doesNotExist'])
    expect(s.unknownTables).toEqual(['not_a_table'])
    expect(s.unknownRoutes).toEqual(['/no-such-page'])
    expect(s.procedures).not.toContain('admin.listFestivals')
    expect(s.adminProcedures).toBe(1)
    expect(arch.admin.storyRefs['fixture:list-events']).toEqual(['admin.listFestivals'])
    expect(arch.stories.unmappedProcedures).not.toContain('events.byProfile')
    expect(arch.stories.unmappedProcedures).toContain('events.get')
  })

  it('handles a missing stories file', async () => {
    const missing = await buildArchitecture({ storiesPath: '/nonexistent/stories.json' })
    expect(missing.stories.state).toBe('missing')
    expect(missing.stories.unmappedProcedures.length).toBe(missing.api.procedures.length)
  })
})

describe('ADR markdown', () => {
  it('escapes HTML and renders basics', () => {
    const html = renderMarkdown('## Title\n\nSome **bold** `code` <script>x</script>\n\n- a\n- b')
    expect(html).toContain('<h3>Title</h3>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>')
  })

  it('renders the seeded ADR-000', () => {
    expect(arch.decisions.find(d => d.id === 'ADR-000')?.status).toBe('accepted')
  })
})

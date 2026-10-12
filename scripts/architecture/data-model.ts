/**
 * Data model extraction: introspects the Drizzle table objects exported by
 * server/database/schema.ts (getTableConfig) — no regex parsing of columns.
 * The only things read from source text are what Drizzle does not keep at
 * runtime: the comment above each table, its line number, and the string
 * literal unions declared with `.$type<'a' | 'b'>()` ("enums in TypeScript").
 */
import { readFileSync } from 'node:fs'
import { is, SQL } from 'drizzle-orm'
import { PgDialect, PgTable, getTableConfig } from 'drizzle-orm/pg-core'
import { getTableColumns } from 'drizzle-orm'

export interface ColumnDoc {
  key: string
  name: string
  type: string
  nullable: boolean
  default: string | null
  primaryKey: boolean
  unique: boolean
  enum: string[] | null
  references: { table: string, column: string, onDelete: string | null } | null
}

export interface IndexDoc { name: string, columns: string[], unique: boolean, where: string | null, using: string | null }
export interface UniqueDoc { name: string, columns: string[] }
export interface ForeignKeyDoc { name: string, columns: string[], table: string, foreignColumns: string[], onDelete: string | null, onUpdate: string | null }

export interface TableDoc {
  key: string
  name: string
  domain: string
  description: string | null
  line: number
  columns: ColumnDoc[]
  indexes: IndexDoc[]
  uniques: UniqueDoc[]
  foreignKeys: ForeignKeyDoc[]
  /** Tables whose FKs point at this table (SQL names). */
  referencedBy: { table: string, columns: string[] }[]
}

const dialect = new PgDialect()

function renderSql(value: unknown): string {
  if (is(value, SQL)) return dialect.sqlToQuery(value as SQL).sql
  return JSON.stringify(value)
}

function renderDefault(col: any): string | null {
  if (col.defaultFn) {
    if (col.columnType === 'PgUUID') return 'gen_random_uuid()'
    return '(app-generated)'
  }
  if (!col.hasDefault) return null
  if (col.default === undefined) return '(database default)'
  if (is(col.default, SQL)) return renderSql(col.default)
  return JSON.stringify(col.default)
}

/** jsKey → string-literal union members, per table block, from schema source. */
function literalUnions(src: string): Map<string, Map<string, string[]>> {
  const out = new Map<string, Map<string, string[]>>()
  const tableRe = /export const (\w+)\s*=\s*pgTable\(/g
  const starts = [...src.matchAll(tableRe)].map(m => ({ key: m[1]!, at: m.index! }))
  starts.forEach((t, i) => {
    const block = src.slice(t.at, starts[i + 1]?.at ?? src.length)
    const cols = new Map<string, string[]>()
    for (const m of block.matchAll(/(\w+):\s*\w+\(\s*'[^']+'[^\n]*?\$type<([^>]+)>/g)) {
      const members = m[2]!.split('|').map(s => s.trim())
      if (members.length && members.every(s => /^'[^']*'$/.test(s))) cols.set(m[1]!, members.map(s => s.slice(1, -1)))
    }
    out.set(t.key, cols)
  })
  return out
}

/** The comment block right above `export const <key> = pgTable(`. */
function tableComments(src: string): Map<string, { description: string | null, line: number }> {
  const lines = src.split('\n')
  const out = new Map<string, { description: string | null, line: number }>()
  lines.forEach((line, i) => {
    const m = line.match(/^export const (\w+)\s*=\s*pgTable\(/)
    if (!m) return
    const buf: string[] = []
    for (let j = i - 1; j >= 0; j--) {
      const l = lines[j]!.trim()
      if (!l) break
      if (l.startsWith('//') || l.startsWith('*') || l.startsWith('/**') || l.startsWith('*/')) {
        const text = l.replace(/^\/\*\*|\*\/$|^\/\/|^\*/g, '').trim()
        if (/^-{3,}$/.test(text) || /^[-─]+$/.test(text)) continue
        buf.unshift(text)
        continue
      }
      break
    }
    const description = buf.join(' ').replace(/\s+/g, ' ').trim() || null
    out.set(m[1]!, { description, line: i + 1 })
  })
  return out
}

export function extractDataModel(schemaModule: Record<string, unknown>, schemaSource: string, domainOf: (key: string) => string): TableDoc[] {
  const unions = literalUnions(schemaSource)
  const comments = tableComments(schemaSource)
  const tables: TableDoc[] = []
  const sqlNameOfKey = new Map<string, string>()

  for (const [key, value] of Object.entries(schemaModule)) {
    if (!is(value, PgTable)) continue
    sqlNameOfKey.set(key, getTableConfig(value as PgTable).name)
  }

  for (const [key, value] of Object.entries(schemaModule)) {
    if (!is(value, PgTable)) continue
    const table = value as PgTable
    const cfg = getTableConfig(table)
    const jsCols = getTableColumns(table) as Record<string, any>
    const keyOfCol = new Map<any, string>(Object.entries(jsCols).map(([k, c]) => [c, k]))

    const fks: ForeignKeyDoc[] = cfg.foreignKeys.map((fk) => {
      const ref = fk.reference()
      return {
        name: fk.getName(),
        columns: ref.columns.map(c => c.name),
        table: getTableConfig(ref.foreignTable).name,
        foreignColumns: ref.foreignColumns.map(c => c.name),
        onDelete: fk.onDelete ?? null,
        onUpdate: fk.onUpdate ?? null,
      }
    })

    const columns: ColumnDoc[] = cfg.columns.map((col: any) => {
      const k = keyOfCol.get(col) ?? col.name
      const fk = fks.find(f => f.columns.length === 1 && f.columns[0] === col.name)
      return {
        key: k,
        name: col.name,
        type: col.getSQLType(),
        nullable: !col.notNull,
        default: renderDefault(col),
        primaryKey: !!col.primary,
        unique: !!col.isUnique,
        enum: unions.get(key)?.get(k) ?? null,
        references: fk ? { table: fk.table, column: fk.foreignColumns[0]!, onDelete: fk.onDelete } : null,
      }
    })

    const indexes: IndexDoc[] = cfg.indexes.map((ix: any) => ({
      name: ix.config.name,
      columns: ix.config.columns.map((c: any) => (is(c, SQL) ? renderSql(c) : c.name)),
      unique: !!ix.config.unique,
      where: ix.config.where ? renderSql(ix.config.where) : null,
      using: ix.config.method && ix.config.method !== 'btree' ? ix.config.method : null,
    }))

    const uniques: UniqueDoc[] = [
      ...cfg.columns.filter((c: any) => c.isUnique).map((c: any) => ({ name: c.uniqueName ?? `${cfg.name}_${c.name}_unique`, columns: [c.name] })),
      ...cfg.uniqueConstraints.map((u: any) => ({ name: u.getName ? u.getName() : u.name, columns: u.columns.map((c: any) => c.name) })),
    ]

    const meta = comments.get(key)
    tables.push({
      key,
      name: cfg.name,
      domain: domainOf(key),
      description: meta?.description ?? null,
      line: meta?.line ?? 0,
      columns,
      indexes,
      uniques,
      foreignKeys: fks,
      referencedBy: [],
    })
  }

  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      const target = tables.find(x => x.name === fk.table)
      if (!target) continue
      const existing = target.referencedBy.find(r => r.table === t.name)
      if (existing) existing.columns.push(...fk.columns)
      else target.referencedBy.push({ table: t.name, columns: [...fk.columns] })
    }
  }
  return tables
}

export function readSource(path: string) {
  return readFileSync(path, 'utf8')
}

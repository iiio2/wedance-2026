/**
 * Compare the Drizzle schema (server/database/schema.ts) with a live database's
 * information_schema: missing tables / columns, type and NULL mismatches, and
 * what only the database has. Pure — scripts/db-schema-diff.ts does the I/O.
 * Built after production drifted silently (missing discover_swipes, hangout
 * place columns, organizer_subscriptions, old follows shape — 2026-10-18).
 */
import { is } from 'drizzle-orm'
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core'

export type DbColumn = { table_name: string; column_name: string; udt_name: string; is_nullable: 'YES' | 'NO' }
export type SchemaGap =
  | { kind: 'missing-table'; table: string }
  | { kind: 'missing-column'; table: string; column: string; notNull: boolean; hasDefault: boolean }
  | { kind: 'type'; table: string; column: string; schema: string; db: string }
  | { kind: 'nullability'; table: string; column: string; schema: 'NOT NULL' | 'NULL'; db: 'NOT NULL' | 'NULL' }
  | { kind: 'db-only-column'; table: string; column: string }
  | { kind: 'db-only-table'; table: string }

const UDT: Record<string, string> = {
  PgUUID: 'uuid', PgText: 'text', PgInteger: 'int4', PgBoolean: 'bool', PgTimestamp: 'timestamp', PgTimestampString: 'timestamp',
  PgDateString: 'date', PgDate: 'date', PgJson: 'json', PgJsonb: 'jsonb', PgDoublePrecision: 'float8', PgNumeric: 'numeric',
  PgVarchar: 'varchar', PgSerial: 'int4', PgBigInt53: 'int8', PgBigSerial53: 'int8',
}

export function diffSchema(schema: Record<string, unknown>, dbColumns: DbColumn[]): SchemaGap[] {
  const db = new Map<string, Map<string, DbColumn>>()
  for (const c of dbColumns) {
    if (!db.has(c.table_name)) db.set(c.table_name, new Map())
    db.get(c.table_name)!.set(c.column_name, c)
  }
  const gaps: SchemaGap[] = []
  const known = new Set<string>()
  for (const v of Object.values(schema)) {
    if (!is(v, PgTable)) continue
    const t = getTableConfig(v as PgTable)
    known.add(t.name)
    const cols = db.get(t.name)
    if (!cols) { gaps.push({ kind: 'missing-table', table: t.name }); continue }
    for (const col of t.columns) {
      const have = cols.get(col.name)
      if (!have) { gaps.push({ kind: 'missing-column', table: t.name, column: col.name, notNull: col.notNull, hasDefault: col.hasDefault }); continue }
      const want = UDT[col.columnType] ?? col.columnType
      // citext is text for the app (handles.handle).
      if (want !== have.udt_name && !(want === 'text' && have.udt_name === 'citext')) gaps.push({ kind: 'type', table: t.name, column: col.name, schema: want, db: have.udt_name })
      const dbNotNull = have.is_nullable === 'NO'
      if (col.notNull !== dbNotNull) gaps.push({ kind: 'nullability', table: t.name, column: col.name, schema: col.notNull ? 'NOT NULL' : 'NULL', db: dbNotNull ? 'NOT NULL' : 'NULL' })
    }
    for (const name of cols.keys()) if (!t.columns.some(c => c.name === name)) gaps.push({ kind: 'db-only-column', table: t.name, column: name })
  }
  for (const name of db.keys()) if (!known.has(name)) gaps.push({ kind: 'db-only-table', table: name })
  return gaps
}

/** Gaps a deploy must not ship with (the app would query something that isn't there). */
export const blockingGaps = (gaps: SchemaGap[]) => gaps.filter(g => g.kind === 'missing-table' || g.kind === 'missing-column' || g.kind === 'type')

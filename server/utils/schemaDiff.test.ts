/**
 * schemaDiff (pure) + migration 0049 against a real Postgres: drop the table,
 * apply the file twice (idempotent), and the database matches schema.ts for it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core'
import * as schema from '../database/schema'
import { blockingGaps, diffSchema, type DbColumn } from './schemaDiff'

const things = pgTable('things', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  count: integer('count'),
})
const col = (table_name: string, column_name: string, udt_name: string, is_nullable: 'YES' | 'NO'): DbColumn => ({ table_name, column_name, udt_name, is_nullable })

describe('diffSchema', () => {
  it('reports nothing when the database matches', () => {
    expect(diffSchema({ things }, [col('things', 'id', 'uuid', 'NO'), col('things', 'name', 'text', 'NO'), col('things', 'count', 'int4', 'YES')])).toEqual([])
  })

  it('finds missing tables and columns, type and NULL mismatches, and db-only leftovers', () => {
    const gaps = diffSchema({ things, other: pgTable('other', { id: uuid('id') }) }, [
      col('things', 'id', 'uuid', 'NO'), col('things', 'name', 'varchar', 'YES'), col('things', 'legacy', 'text', 'YES'),
      col('old_table', 'id', 'uuid', 'NO'),
    ])
    expect(gaps).toEqual([
      { kind: 'type', table: 'things', column: 'name', schema: 'text', db: 'varchar' },
      { kind: 'nullability', table: 'things', column: 'name', schema: 'NOT NULL', db: 'NULL' },
      { kind: 'missing-column', table: 'things', column: 'count', notNull: false, hasDefault: false },
      { kind: 'db-only-column', table: 'things', column: 'legacy' },
      { kind: 'missing-table', table: 'other' },
      { kind: 'db-only-table', table: 'old_table' },
    ])
    expect(blockingGaps(gaps).map(g => g.kind)).toEqual(['type', 'missing-column', 'missing-table'])
  })
})

const LOCAL_PG = process.env.LOCAL_PG_URL ?? (process.env.DATABASE_URL && !process.env.NEON_FETCH_ENDPOINT ? process.env.DATABASE_URL : undefined)

describe.skipIf(!LOCAL_PG)('migration 0049_organizer_subscriptions', () => {
  it('creates organizer_subscriptions exactly as schema.ts has it, and is idempotent', async () => {
    const sqlText = readFileSync(fileURLToPath(new URL('../database/migrations/0049_organizer_subscriptions.sql', import.meta.url)), 'utf8')
    const client = new pg.Client({ connectionString: LOCAL_PG })
    await client.connect()
    try {
      await client.query('BEGIN')
      await client.query('DROP TABLE IF EXISTS "organizer_subscriptions" CASCADE')
      await client.query(sqlText)
      await client.query(sqlText)
      const { rows } = await client.query<DbColumn>("SELECT table_name, column_name, udt_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizer_subscriptions'")
      expect(diffSchema({ organizerSubscriptions: schema.organizerSubscriptions }, rows)).toEqual([])
      const { rows: idx } = await client.query("SELECT indexname FROM pg_indexes WHERE tablename = 'organizer_subscriptions' ORDER BY 1")
      expect(idx.map(r => r.indexname)).toEqual(expect.arrayContaining(['org_sub_dancer_idx', 'org_sub_profile_idx', 'organizer_subscriptions_stripe_subscription_id_unique']))
    } finally {
      // Leave the test database as it was (the table is recreated identically anyway).
      await client.query('ROLLBACK').catch(() => {})
      await client.end()
    }
  })
})

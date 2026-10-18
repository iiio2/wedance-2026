#!/usr/bin/env bun
/**
 * Read-only: diff server/database/schema.ts against a database (default the
 * DATABASE_URL target). Lists missing tables/columns, type and NULL mismatches,
 * and tables/columns only the database has. Exit 1 when something the app
 * needs is missing — so it can gate a deploy or a CI job.
 *
 *   bun scripts/db-schema-diff.ts            # human-readable
 *   bun scripts/db-schema-diff.ts --json
 *
 * Opens a read-only session; never writes.
 */
import pg from 'pg'
import * as schema from '../server/database/schema'
import { blockingGaps, diffSchema, type DbColumn } from '../server/utils/schemaDiff'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL not set'); process.exit(2) }
const client = new pg.Client({ connectionString: url })
await client.connect()
await client.query('SET default_transaction_read_only = on')
const { rows } = await client.query<DbColumn>("SELECT table_name, column_name, udt_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public'")
await client.end()

const gaps = diffSchema(schema as Record<string, unknown>, rows)
if (process.argv.includes('--json')) console.log(JSON.stringify(gaps, null, 2))
else if (!gaps.length) console.log('schema and database match')
else for (const g of gaps) console.log(g.kind.padEnd(15), 'column' in g ? `${g.table}.${g.column}` : g.table, 'schema' in g ? `schema ${g.schema} · db ${g.db}` : '')
process.exit(blockingGaps(gaps).length ? 1 : 0)

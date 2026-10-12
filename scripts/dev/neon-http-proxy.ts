#!/usr/bin/env bun
/**
 * Local stand-in for Neon's HTTP SQL endpoint, so the app (drizzle neon-http)
 * and the scripts can run against a plain local Postgres — e.g. a Docker copy
 * of production — instead of writing to the real Neon database.
 *
 * Speaks the same wire format the @neondatabase/serverless `neon()` driver
 * sends: POST /sql with `{ query, params }` (or `{ queries: [...] }` for a
 * transaction batch), answered with `{ fields, rows, command, rowCount }` where
 * every value is raw Postgres text and each field carries its type OID — the
 * driver does the type parsing itself, exactly as against real Neon.
 *
 * Usage:
 *   docker run -d --name wedance-2026-dev-db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev \
 *     -e POSTGRES_DB=wedance -p 5441:5432 postgres:17-alpine
 *   LOCAL_PG_URL=postgresql://dev:dev@localhost:5441/wedance bun scripts/dev/neon-http-proxy.ts
 *
 * Then point the app / scripts at it:
 *   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance
 *   NEON_FETCH_ENDPOINT=http://localhost:4444/sql
 *
 * Dev-only. Never deployed (server/utils/db.ts only honours NEON_FETCH_ENDPOINT
 * when it is set, and it is never set on Vercel).
 */
import pg from 'pg'

const PORT = Number(process.env.NEON_PROXY_PORT ?? 4444)
const PG_URL = process.env.LOCAL_PG_URL ?? 'postgresql://dev:dev@localhost:5441/wedance'

// Return every value as the raw text Postgres sent — the Neon driver parses it.
const rawText = { getTypeParser: () => (v: string) => v } as any
const pool = new pg.Pool({ connectionString: PG_URL, max: 10 })
// An idle client losing its connection (Postgres restarted, Docker hiccup) emits
// 'error' on the pool; unhandled, that kills the whole proxy and every query
// after it fails. The pool already drops the dead client, so just log it — the
// next query opens a fresh connection.
pool.on('error', (err) => console.warn(`neon-http-proxy: idle connection lost (${err.message}) — will reconnect`))

type Q = { query: string; params?: unknown[] }

async function run(client: pg.PoolClient, q: Q) {
  const res = await client.query({ text: q.query, values: q.params ?? [], rowMode: 'array', types: rawText })
  return {
    fields: res.fields.map(f => ({ name: f.name, dataTypeID: f.dataTypeID, tableID: f.tableID, columnID: f.columnID, dataTypeSize: f.dataTypeSize, dataTypeModifier: f.dataTypeModifier, format: 'text' })),
    rows: res.rows,
    command: res.command,
    rowCount: res.rowCount,
    rowAsArray: true,
  }
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    if (req.method !== 'POST') return new Response('neon-http-proxy: POST /sql', { status: 404 })
    const body = await req.json() as Q | { queries: Q[] }
    const client = await pool.connect()
    try {
      if ('queries' in body) {
        await client.query('BEGIN')
        const results = []
        for (const q of body.queries) results.push(await run(client, q))
        await client.query('COMMIT')
        return Response.json({ results })
      }
      return Response.json(await run(client, body))
    } catch (e: any) {
      if ('queries' in body) await client.query('ROLLBACK').catch(() => {})
      return Response.json({ message: e.message, code: e.code, detail: e.detail, hint: e.hint, position: e.position, constraint: e.constraint, table: e.table, column: e.column, severity: e.severity }, { status: 400 })
    } finally {
      client.release()
    }
  },
})
console.log(`neon-http-proxy → ${PG_URL.replace(/:[^:@/]+@/, ':***@')} on http://localhost:${PORT}/sql`)

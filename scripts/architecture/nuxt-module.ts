/**
 * Regenerates the /architecture data from code on every `nuxt prepare`,
 * `nuxt dev` and `nuxt build` (so the Vercel build is always current), and
 * again in dev when the schema, the tRPC routers, the API handlers, the stories
 * file or an ADR changes. See docs/architecture/adr/000-generated-architecture-docs.md.
 */
import { defineNuxtModule } from '@nuxt/kit'
import { createJiti } from 'jiti'

const WATCH = /^(server\/(database\/schema\.ts|trpc\/|api\/|routes\/|utils\/)|docs\/architecture\/|scripts\/architecture\/domains\.ts)/

export default defineNuxtModule({
  meta: { name: 'wedance-architecture-docs' },
  async setup(_options, nuxt) {
    const rootDir = nuxt.options.rootDir
    const run = async () => {
      // Fresh jiti per run: no module cache, so dev regenerations see edits.
      const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false })
      const { writeArchitecture } = await jiti.import<typeof import('./generate')>('./generate.ts')
      const arch = await writeArchitecture({ rootDir })
      const c = arch.meta.counts
      console.info(`[architecture] ${c.tables} tables · ${c.procedures} tRPC procedures (${c.adminProcedures} admin, kept server-side) · ${c.rest} REST handlers · ${c.stories} stories · ${c.adrs} ADRs`)
    }
    await run()
    if (nuxt.options.dev) {
      nuxt.hook('builder:watch', async (_event, path) => {
        const rel = path.startsWith(rootDir) ? path.slice(rootDir.length + 1) : path
        if (!WATCH.test(rel)) return
        try { await run() }
        catch (err) { console.error('[architecture] regeneration failed:', err) }
      })
    }
  },
})

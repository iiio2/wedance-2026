/**
 * Which routes the design guardrails cover.
 *
 * /docs/design pages come from app/lib/design-nav.ts automatically — every
 * non-planned nav item whose page file exists is covered. Add a /docs/design page to
 * the nav and it is snapshotted, contract-checked and axe-scanned with no edit
 * here. Product routes are listed by hand: add one line to PRODUCT_ROUTES.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { designNav } from '../../app/lib/design-nav'

const PAGES_DIR = fileURLToPath(new URL('../../app/pages', import.meta.url))

function pageExists(route: string) {
  const base = join(PAGES_DIR, route === '/' ? 'index' : route.replace(/^\//, ''))
  return existsSync(`${base}.vue`) || existsSync(join(base, 'index.vue'))
}

export interface Route {
  path: string
  /** File-safe snapshot name. */
  name: string
  /** Screenshot the whole page (docs) or just the first viewport (data-driven product pages). */
  fullPage: boolean
}

const slug = (p: string) => (p === '/' ? 'home' : p.replace(/^\//, '').replace(/\//g, '--'))

export const DESIGN_ROUTES: Route[] = designNav
  .flatMap(s => s.items)
  .filter(i => i.status !== 'planned' && pageExists(i.to))
  .map(i => ({ path: i.to, name: slug(i.to), fullPage: false }))

/**
 * Key product routes. Their content comes from the database, so only the first
 * viewport is snapshotted and dynamic regions are masked (see helpers.ts).
 */
export const PRODUCT_ROUTES: Route[] = [
  '/',
  '/festivals',
  '/cities/munich',
  '/for-organizers',
  '/artists',
].map(p => ({ path: p, name: slug(p), fullPage: false }))

/** Pages that render the shared ui components in every variant. */
export const COMPONENT_SHOWCASE_ROUTES = [...DESIGN_ROUTES.map(r => r.path)]

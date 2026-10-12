import type { DocSection } from '~/lib/design-nav'

/**
 * Navigation for the /docs/architecture docs. Everything except the Overview and the
 * ADRs is generated from code (scripts/architecture/generate.ts, ADR-000).
 */
export const architectureNav: DocSection[] = [
  {
    title: 'Getting started',
    items: [
      { title: 'Overview', to: '/docs/architecture', status: 'stable', summary: 'Contexts, stack, integrations and the system context diagram.' },
    ],
  },
  {
    title: 'Generated from code',
    items: [
      { title: 'Data model', to: '/docs/architecture/data', status: 'stable', summary: 'Every table from the Drizzle schema, grouped by context, with an ER diagram.' },
      { title: 'API', to: '/docs/architecture/api', status: 'stable', summary: 'Every tRPC procedure and REST/webhook handler, with auth, input and tables.' },
      { title: 'User stories', to: '/docs/architecture/stories', status: 'beta', summary: 'Stories mapped to tables, procedures and routes, with gaps flagged.' },
    ],
  },
  {
    title: 'Decisions',
    items: [
      { title: 'Review & ADRs', to: '/docs/architecture/decisions', status: 'stable', summary: 'Architecture review, target design and decision records.' },
    ],
  },
]

/** GitHub deep link for a repo file (and optional line). */
export function sourceUrl(file: string, line?: number) {
  return `https://github.com/razbakov/wedance-2026/blob/main/${file}${line ? `#L${line}` : ''}`
}

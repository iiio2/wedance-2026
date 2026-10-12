import type { DocSection } from '~/lib/design-nav'
import { designNav } from '~/lib/design-nav'
import { architectureNav } from '~/lib/architecture-nav'

/**
 * The /docs umbrella: one top-level nav across the sections, and the sidebar
 * for the section the current route belongs to. DocsShell reads both.
 */
export const REPO_URL = 'https://github.com/razbakov/wedance-2026'
export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`
export const ISSUES_URL = `${REPO_URL}/issues`
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`
export const GOVERNANCE_URL = 'https://org.wedance.vip/docs/'
export const SITE_URL = 'https://2026.wedance.vip'

export interface DocsTab {
  label: string
  to: string
}

/** Top bar tabs. `to` is also the prefix that selects the section sidebar. */
export const docsTabs: DocsTab[] = [
  { label: 'Overview', to: '/docs' },
  { label: 'Design', to: '/docs/design' },
  { label: 'Architecture', to: '/docs/architecture' },
]

/** Sidebar for the hub pages (/docs, /docs/getting-started). */
export const hubNav: DocSection[] = [
  {
    title: 'Getting started',
    items: [
      { title: 'Introduction', to: '/docs', status: 'stable', summary: 'What WeDance is and where everything lives.' },
      { title: 'Quick start', to: '/docs/getting-started', status: 'stable', summary: 'Run WeDance on your machine with a local database.' },
    ],
  },
  {
    title: 'Sections',
    items: [
      { title: 'Design system', to: '/docs/design', status: 'stable', summary: 'Tokens, components and patterns.' },
      { title: 'Architecture', to: '/docs/architecture', status: 'stable', summary: 'Data model, API, stories and decisions — generated from code.' },
    ],
  },
  {
    title: 'Community',
    items: [
      { title: 'Contributing', to: CONTRIBUTING_URL, status: 'stable', summary: 'How to propose a change.' },
      { title: 'Issues', to: ISSUES_URL, status: 'stable', summary: 'Report a bug or suggest a feature.' },
      { title: 'Governance', to: GOVERNANCE_URL, status: 'stable', summary: 'The WeDance organisation\'s living docs.' },
    ],
  },
]

export interface DocsSectionConfig {
  /** Section home, the brand link target. */
  home: string
  /** Section name in the sidebar header. */
  label: string
  nav: DocSection[]
}

const sections: DocsSectionConfig[] = [
  { home: '/docs/design', label: 'Design system', nav: designNav },
  { home: '/docs/architecture', label: 'Architecture', nav: architectureNav },
]

const HUB: DocsSectionConfig = { home: '/docs', label: 'Docs', nav: hubNav }

/** The section a docs route belongs to (hub for /docs and its own pages). */
export function docsSectionFor(path: string): DocsSectionConfig {
  return sections.find(s => path === s.home || path.startsWith(`${s.home}/`)) ?? HUB
}

export const isExternal = (to: string) => /^https?:\/\//.test(to)

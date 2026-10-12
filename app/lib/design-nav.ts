/**
 * Navigation for the /docs/design docs — the single source for the sidebar, the
 * overview and the components index. Add a page here and it shows up everywhere.
 *
 * status: 'stable'  — documented, safe to use
 *         'beta'    — usable, API or look may still change
 *         'planned' — not built yet; listed so the roadmap is visible (no page)
 */
export type DocStatus = 'stable' | 'beta' | 'planned'

export interface DocItem {
  title: string
  to: string
  status: DocStatus
  summary: string
}

export interface DocSection {
  title: string
  items: DocItem[]
}

export const designNav: DocSection[] = [
  {
    title: 'Getting started',
    items: [
      { title: 'Overview', to: '/docs/design', status: 'stable', summary: 'Principles, how to use the system, status board.' },
    ],
  },
  {
    title: 'Brand',
    items: [
      { title: 'Logo, voice & imagery', to: '/docs/design/brand', status: 'beta', summary: 'Logo use, tone of voice, photo rules.' },
    ],
  },
  {
    title: 'Foundations',
    items: [
      { title: 'Colors', to: '/docs/design/foundations/colors', status: 'stable', summary: 'Core, semantic, status and extended palettes with contrast.' },
      { title: 'Typography', to: '/docs/design/foundations/typography', status: 'stable', summary: 'Font pair, type scale, small-size tokens and usage rules.' },
      { title: 'Elevation', to: '/docs/design/foundations/elevation', status: 'stable', summary: 'Radii and the shadow tokens.' },
      { title: 'Motion', to: '/docs/design/foundations/motion', status: 'stable', summary: 'Duration and easing tokens, reduced motion.' },
      { title: 'Spacing & layout', to: '/docs/design/foundations/spacing', status: 'stable', summary: 'Spacing scale, containers, breakpoints.' },
      { title: 'Icons', to: '/docs/design/foundations/icons', status: 'stable', summary: 'Lucide set, sizes and colours.' },
    ],
  },
  {
    title: 'Components',
    items: [
      { title: 'All components', to: '/docs/design/components', status: 'stable', summary: 'Index with status for every component.' },
      { title: 'Button', to: '/docs/design/components/button', status: 'stable', summary: 'Actions, including the brand CTA.' },
      { title: 'Badge', to: '/docs/design/components/badge', status: 'stable', summary: 'Small status and category labels.' },
      { title: 'Card', to: '/docs/design/components/card', status: 'beta', summary: 'Surface for grouped content.' },
      { title: 'Dialog', to: '/docs/design/components/dialog', status: 'beta', summary: 'Modal for focused tasks.' },
      { title: 'Tabs', to: '/docs/design/components/tabs', status: 'beta', summary: 'Switch between related views.' },
      { title: 'Avatar', to: '/docs/design/components/avatar', status: 'beta', summary: 'Person or organisation image with fallback.' },
      { title: 'Separator', to: '/docs/design/components/separator', status: 'beta', summary: 'Visual divider between content.' },
      { title: 'Input', to: '/docs/design/components/input', status: 'beta', summary: 'Single-line text field.' },
      { title: 'Select', to: '/docs/design/components/select', status: 'beta', summary: 'Pick one option from a list.' },
      { title: 'City combobox', to: '/docs/design/components/city-combobox', status: 'beta', summary: 'Type-ahead city field with suggestions.' },
      { title: 'Textarea', to: '/docs/design/components/textarea', status: 'beta', summary: 'Multi-line text field.' },
      { title: 'Checkbox', to: '/docs/design/components/checkbox', status: 'beta', summary: 'Toggle an option on or off.' },
      { title: 'Field', to: '/docs/design/components/field', status: 'beta', summary: 'Label + control + hint + error wrapper (includes Label).' },
      { title: 'Dance style picker', to: '/docs/design/components/dance-style-picker', status: 'beta', summary: 'Pick dances from the taxonomy: popular first, grouped by family, alias search. Plus read-only style chips.' },
    ],
  },
  {
    title: 'Patterns',
    items: [
      { title: 'Forms & validation', to: '/docs/design/patterns/forms', status: 'beta', summary: 'Layout, validation timing, error copy.' },
      { title: 'Cards', to: '/docs/design/patterns/cards', status: 'beta', summary: 'Event, festival, artist and plan cards.' },
      { title: 'Heroes', to: '/docs/design/patterns/heroes', status: 'beta', summary: 'Page headers with photo and title.' },
      { title: 'Empty states', to: '/docs/design/patterns/empty-states', status: 'beta', summary: 'What to show when there is nothing yet.' },
    ],
  },
]

export const allDocItems = designNav.flatMap(s => s.items)
export const componentItems = designNav.find(s => s.title === 'Components')!.items.filter(i => i.to !== '/docs/design/components')

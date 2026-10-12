import type { ArchTable } from '~/composables/useArchitecture'

/**
 * Mermaid sources built from the generated data model. Pure functions of the
 * generated JSON, so the diagrams can never disagree with the tables pages.
 */
const ident = (s: string) => s.replace(/[^\w]/g, '_')
const mtype = (t: string) => t.replace(/\s+/g, '_').replace(/[^\w]/g, '')

function relation(child: ArchTable, fkCols: string[], parentName: string) {
  const nullable = fkCols.some(c => child.columns.find(x => x.name === c)?.nullable)
  return `  ${ident(parentName)} ${nullable ? '|o' : '||'}--o{ ${ident(child.name)} : "${fkCols.join(', ')}"`
}

/** Entity-relationship diagram. `withColumns`: 'all' | 'keys' (PK/FK/unique) | 'none'. */
export function erDiagram(tables: ArchTable[], opts: { withColumns: 'all' | 'keys' | 'none', include?: Set<string> } ) {
  const names = new Set(tables.map(t => t.name))
  const lines = ['erDiagram']
  for (const t of tables) {
    if (opts.withColumns === 'none') { lines.push(`  ${ident(t.name)}`); continue }
    const cols = t.columns.filter(c => opts.withColumns === 'all' || c.primaryKey || c.references || c.unique)
    lines.push(`  ${ident(t.name)} {`)
    for (const c of cols) {
      const keys = [c.primaryKey && 'PK', c.references && 'FK', c.unique && 'UK'].filter(Boolean).join(',')
      lines.push(`    ${mtype(c.type)} ${ident(c.name)}${keys ? ` ${keys}` : ''}`)
    }
    lines.push('  }')
  }
  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      if (!names.has(fk.table)) continue
      lines.push(relation(t, fk.columns, fk.table))
    }
  }
  return lines.join('\n')
}

/** A table plus every table it references or is referenced by. */
export function neighbourhood(all: ArchTable[], name: string): ArchTable[] {
  const t = all.find(x => x.name === name)
  if (!t) return []
  const related = new Set([name, ...t.foreignKeys.map(f => f.table), ...t.referencedBy.map(r => r.table)])
  return all.filter(x => related.has(x.name))
}

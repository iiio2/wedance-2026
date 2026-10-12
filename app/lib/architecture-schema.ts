/**
 * Renders a JSON Schema (produced from a tRPC zod input) as a compact,
 * TypeScript-like signature for the API catalog. Constraints are kept as
 * trailing comments so the shape stays readable.
 */
type S = Record<string, any>

function constraints(s: S): string[] {
  const c: string[] = []
  if (s.format) c.push(s.format)
  if (s.minLength !== undefined || s.maxLength !== undefined) c.push(`len ${s.minLength ?? 0}..${s.maxLength ?? '∞'}`)
  if (s.minimum !== undefined || s.maximum !== undefined) c.push(`${s.minimum ?? '-∞'}..${s.maximum ?? '∞'}`)
  if (s.exclusiveMinimum !== undefined) c.push(`> ${s.exclusiveMinimum}`)
  if (s.minItems !== undefined || s.maxItems !== undefined) c.push(`items ${s.minItems ?? 0}..${s.maxItems ?? '∞'}`)
  // A format (uuid, email…) already says what the pattern spells out.
  if (s.pattern && !s.format) c.push(`/${s.pattern}/`)
  if (s.default !== undefined) c.push(`default ${JSON.stringify(s.default)}`)
  return c
}

function typeOf(s: S, indent: string): string {
  if (!s || typeof s !== 'object') return 'unknown'
  if (s.const !== undefined) return JSON.stringify(s.const)
  if (s.enum) return s.enum.map((v: unknown) => JSON.stringify(v)).join(' | ')
  for (const k of ['anyOf', 'oneOf'] as const) {
    if (s[k]) return s[k].map((x: S) => typeOf(x, indent)).join(' | ')
  }
  if (s.allOf) return s.allOf.map((x: S) => typeOf(x, indent)).join(' & ')
  const t = Array.isArray(s.type) ? s.type : [s.type]
  if (t.includes('object') || s.properties) {
    const props = Object.entries(s.properties ?? {}) as [string, S][]
    if (!props.length) return s.additionalProperties ? `Record<string, ${typeOf(s.additionalProperties, indent)}>` : '{}'
    const req = new Set<string>(s.required ?? [])
    const inner = `${indent}  `
    const lines = props.map(([k, v]) => {
      const c = constraints(v)
      return `${inner}${k}${req.has(k) ? '' : '?'}: ${typeOf(v, inner)}${c.length ? `  // ${c.join(', ')}` : ''}`
    })
    return `{\n${lines.join('\n')}\n${indent}}`
  }
  if (t.includes('array')) {
    const item = s.items ? typeOf(s.items, indent) : 'unknown'
    return /[|&\s]/.test(item) && !item.startsWith('{') ? `(${item})[]` : `${item}[]`
  }
  if (t.includes('integer')) return 'number /* int */'
  if (t.length && t[0]) return t.join(' | ')
  return 'unknown'
}

export function schemaSignature(schema: unknown): string {
  if (!schema) return 'void'
  const s = schema as S
  const top = constraints(s)
  return typeOf(s, '') + (top.length ? `  // ${top.join(', ')}` : '')
}

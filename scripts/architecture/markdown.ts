/**
 * Minimal Markdown → HTML for the docs under docs/architecture/{adr,review,target}.
 * Supports what those docs use: headings (with anchor ids), paragraphs, lists,
 * fenced code, GitHub-style tables, blockquotes, inline code, bold/italic and
 * links. ```mermaid fences are split out as separate parts so the page can
 * render them with <ArchMermaid>. Everything is HTML-escaped first, so doc text
 * can never inject markup into the page.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(s: string): string {
  const codes: string[] = []
  let t = esc(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
  t = t
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
      const safe = /^(https?:|\/|#|\.)/.test(href) ? href : '#'
      return `<a href="${safe}">${text}</a>`
    })
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`)
}

/** GitHub-style anchor id for a heading: lower-case, punctuation dropped, spaces → '-'. */
export function headingId(text: string): string {
  return text.toLowerCase().replace(/`/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')
}

/** Split one table row on unescaped pipes; `\|` stays a literal pipe. */
function tableCells(row: string): string[] {
  const t = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  return t.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'))
}

const isTableRow = (l: string | undefined) => l !== undefined && /^\s*\|.*\|\s*$/.test(l)
const isTableSep = (l: string | undefined) => l !== undefined && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l)

export type DocPart = { type: 'html', html: string } | { type: 'mermaid', code: string }

/** Markdown → ordered parts: HTML chunks interleaved with raw Mermaid sources. */
export function renderMarkdownParts(md: string): DocPart[] {
  const parts: DocPart[] = []
  let html: string[] = []
  const flush = () => {
    if (html.length) parts.push({ type: 'html', html: html.join('\n') })
    html = []
  }
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out = { push: (s: string) => html.push(s) }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i]!)) buf.push(lines[i++]!)
      i++
      if (lang === 'mermaid') {
        flush()
        parts.push({ type: 'mermaid', code: buf.join('\n') })
      }
      else {
        out.push(`<pre data-lang="${esc(lang)}"><code>${esc(buf.join('\n'))}</code></pre>`)
      }
      continue
    }
    if (isTableRow(line) && isTableSep(lines[i + 1])) {
      const head = tableCells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) rows.push(tableCells(lines[i++]!))
      const th = head.map(c => `<th>${inline(c)}</th>`).join('')
      const tb = rows.map(r => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? '')}</td>`).join('')}</tr>`).join('')
      out.push(`<div class="arch-table"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = Math.min(h[1]!.length + 1, 5)
      out.push(`<h${level} id="${esc(headingId(h[2]!))}">${inline(h[2]!)}</h${level}>`)
      i++
      continue
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) {
        let item = lines[i]!.replace(/^\s*([-*]|\d+\.)\s+/, '')
        i++
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]!) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) item += ` ${lines[i++]!.trim()}`
        items.push(`<li>${inline(item)}</li>`)
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`)
      continue
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i]!)) buf.push(lines[i++]!.replace(/^>\s?/, ''))
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`)
      continue
    }
    if (!line.trim()) { i++; continue }
    const buf: string[] = []
    while (i < lines.length && lines[i]!.trim() && !/^(```|#{1,4}\s|>\s?|\s*([-*]|\d+\.)\s+)/.test(lines[i]!) && !(isTableRow(lines[i]) && isTableSep(lines[i + 1]))) buf.push(lines[i++]!.trim())
    out.push(`<p>${inline(buf.join(' '))}</p>`)
  }
  flush()
  return parts
}

/** Markdown → one HTML string (Mermaid fences become `<pre data-lang="mermaid">`). */
export function renderMarkdown(md: string): string {
  return renderMarkdownParts(md)
    .map(p => (p.type === 'html' ? p.html : `<pre data-lang="mermaid"><code>${esc(p.code)}</code></pre>`))
    .join('\n')
}

/** `---\nkey: value\n---` frontmatter (flat string values only). */
export function parseFrontmatter(md: string): { data: Record<string, string>, body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return { data: {}, body: md }
  const data: Record<string, string> = {}
  for (const line of m[1]!.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (kv) data[kv[1]!] = kv[2]!.replace(/^['"]|['"]$/g, '').trim()
  }
  return { data, body: md.slice(m[0].length) }
}

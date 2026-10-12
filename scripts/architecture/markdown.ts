/**
 * Minimal Markdown → HTML for the ADRs in docs/architecture/adr. Supports what
 * ADRs use: headings, paragraphs, lists, fenced code, blockquotes, inline code,
 * bold/italic and links. Everything is HTML-escaped first, so ADR text can
 * never inject markup into the page.
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

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i]!)) buf.push(lines[i++]!)
      i++
      out.push(`<pre data-lang="${esc(lang)}"><code>${esc(buf.join('\n'))}</code></pre>`)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = Math.min(h[1]!.length + 1, 5)
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`)
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
    while (i < lines.length && lines[i]!.trim() && !/^(```|#{1,4}\s|>\s?|\s*([-*]|\d+\.)\s+)/.test(lines[i]!)) buf.push(lines[i++]!.trim())
    out.push(`<p>${inline(buf.join(' '))}</p>`)
  }
  return out.join('\n')
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

/**
 * A video link people paste → the embed URL the pages render, or null when it
 * isn't a YouTube or Vimeo link. Accepts watch, short, shorts, embed and
 * Vimeo page links.
 */
export function videoEmbedUrl(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  let u: URL
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) } catch { return null }
  const host = u.hostname.replace(/^(www|m)\./, '')
  const id = (s: string | null | undefined) => (s && /^[\w-]{6,20}$/.test(s) ? s : null)
  let yt: string | null = null
  if (host === 'youtu.be') yt = id(u.pathname.slice(1))
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, rest] = u.pathname.split('/')
    yt = kind === 'watch' ? id(u.searchParams.get('v')) : ['embed', 'shorts', 'live'].includes(kind ?? '') ? id(rest) : null
  }
  if (yt) return `https://www.youtube.com/embed/${yt}`
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const v = u.pathname.split('/').find(x => /^\d{5,12}$/.test(x))
    if (v) return `https://player.vimeo.com/video/${v}`
  }
  return null
}

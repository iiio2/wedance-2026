/**
 * One public Instagram post or reel through Apify (#453): what an event import
 * reads off the organiser's announcement — caption, picture, owner, tagged and
 * mentioned accounts, location.
 *
 * Actor: apify~instagram-scraper with the post URL as a direct URL
 * (resultsType "posts"). Its output is read defensively, like the profile
 * scraper's: every field may be missing, `taggedUsers` comes as handles or as
 * objects, and a private / deleted post comes back as no item or an error item.
 */
import { runActor, apifyToken, type ActorOptions } from './apify'

export const POST_SCRAPER = 'apify~instagram-scraper'

export type InstagramPost = {
  code: string
  url: string
  caption: string
  /** The post's picture (a reel's cover). A CDN link that expires: re-host it, never store it. */
  imageUrl: string | null
  ownerHandle: string | null
  ownerName: string | null
  /** Accounts tagged on the picture, plus collaborators. Lowercased, no @. */
  tagged: string[]
  /** Accounts @mentioned in the caption (the actor's list and our own reading). */
  mentions: string[]
  hashtags: string[]
  locationName: string | null
  /** When it was posted (ISO), to tell which year "31 October" is. */
  postedAt: string | null
}

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}
const handleOf = (v: unknown): string | null => {
  const h = str(typeof v === 'object' && v ? (v as any).username : v)?.replace(/^@/, '').toLowerCase()
  return h && /^[a-z0-9._]{1,30}$/.test(h) ? h : null
}
const handles = (list: unknown): string[] => Array.isArray(list) ? list.map(handleOf).filter((h): h is string => !!h) : []

/** Every @handle written in a text, lowercased, without the trailing dot of a sentence. */
export function mentionsIn(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/(?:^|[^\w@.])@([A-Za-z0-9._]{1,30})/g)) {
    const h = m[1]!.replace(/\.+$/, '').toLowerCase()
    if (h) out.add(h)
  }
  return [...out]
}

/** One dataset item → an InstagramPost, or null when it isn't a post (an error / "not found" row). */
export function normalizeInstagramPost(item: unknown, fallbackCode?: string): InstagramPost | null {
  if (!item || typeof item !== 'object') return null
  const it = item as Record<string, any>
  if (it.error || it.errorDescription) return null
  const code = str(it.shortCode ?? it.shortcode ?? it.code) ?? fallbackCode ?? null
  const caption = str(it.caption) ?? ''
  const imageUrl = str(it.displayUrl ?? it.display_url) ?? str(Array.isArray(it.images) ? it.images[0] : null) ?? str(it.childPosts?.[0]?.displayUrl)
  if (!code || (!caption && !imageUrl)) return null
  const unique = (xs: string[]) => [...new Set(xs)]
  return {
    code,
    url: str(it.url) ?? `https://www.instagram.com/p/${code}/`,
    caption,
    imageUrl,
    ownerHandle: handleOf(it.ownerUsername ?? it.owner?.username),
    ownerName: str(it.ownerFullName ?? it.owner?.full_name),
    tagged: unique([...handles(it.taggedUsers), ...handles(it.coauthorProducers), ...handles(it.childPosts?.flatMap?.((c: any) => c?.taggedUsers ?? []))]),
    mentions: unique([...handles(it.mentions), ...mentionsIn(caption)]),
    hashtags: Array.isArray(it.hashtags) ? it.hashtags.map(str).filter((h: string | null): h is string => !!h) : [],
    locationName: str(it.locationName ?? it.location?.name),
    postedAt: str(it.timestamp),
  }
}

/**
 * The post behind a post / reel URL, or null when Instagram shows nothing
 * public there (private, deleted, wrong link). Throws ApifyError when the run
 * fails. Null without a token — check `apifyEnabled()` first to tell the two apart.
 */
// A post asked for again soon (the assistant retries with the page to run it as) isn't paid twice.
const cache = new Map<string, { at: number; post: InstagramPost }>()
const CACHE_MS = 15 * 60_000

export async function fetchInstagramPost(url: string, code: string, opts: ActorOptions = {}): Promise<InstagramPost | null> {
  const token = opts.token === undefined ? apifyToken() : opts.token
  if (!token) return null
  const hit = cache.get(code)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.post
  const items = await runActor(POST_SCRAPER, { directUrls: [url], resultsType: 'posts', resultsLimit: 1, addParentData: false }, { timeoutSecs: 90, ...opts, token })
  const posts = items.map(i => normalizeInstagramPost(i, code)).filter((p): p is InstagramPost => !!p)
  // The asked-for post, never some other post of that account.
  const post = posts.find(p => p.code === code) ?? null
  if (post) {
    cache.set(code, { at: Date.now(), post })
    if (cache.size > 200) cache.delete(cache.keys().next().value!)
  }
  return post
}

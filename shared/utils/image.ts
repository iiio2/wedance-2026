/**
 * A Cloudinary image at the size it is shown, not the size it was uploaded.
 *
 * Flyers are stored as 1080×1920 PNGs (~3.5 MB) and photos as whatever the
 * phone sent; showing them as is used 64 GB of Cloudinary bandwidth in a month
 * and got the account switched off (Nov 2026). `c_limit,w_<width>` scales down
 * (never up), `f_auto,q_auto` picks WebP/AVIF at a sensible quality — usually
 * 100–300 KB for a flyer. Each size is one cached derivative on Cloudinary.
 *
 * `width` is in image pixels: pass about twice the CSS width for sharp
 * screens. Anything that isn't a plain Cloudinary image upload — another host,
 * a data/blob preview, a link that already carries a transformation, an SVG —
 * comes back unchanged, so it is safe on any `src`.
 */
const UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/
// A transformation segment: comma-separated `x_value` params (c_fill,w_540 …).
const TRANSFORMATION = /^[a-z]{1,3}_[^,/]+(?:,[a-z]{1,3}_[^,/]+)*$/

export function sizedImage(url: string, width: number): string
export function sizedImage(url: string | null | undefined, width: number): string | undefined
export function sizedImage(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined
  const m = UPLOAD.exec(url)
  if (!m) return url
  const rest = m[2]!
  if (TRANSFORMATION.test(rest.split('/')[0]!) || /\.svg(?:$|\?)/i.test(rest)) return url
  return `${m[1]}c_limit,w_${Math.round(width)},f_auto,q_auto/${rest}`
}

/** Image widths by how a picture is shown (≈2× its CSS width). */
export const IMG = {
  /** Round avatars, logos, chips — up to ~96 px on screen. */
  avatar: 192,
  /** Cards, thumbnails, flyer previews in a grid. */
  card: 640,
  /** A flyer or photo shown on its own, up to ~540 px wide. */
  large: 1080,
  /** Full-width heroes and covers. */
  hero: 1600,
} as const

import cloudinary from 'cloudinary'
import { TRPCError } from '@trpc/server'

/**
 * Copy a photo from someone else's server (an Instagram CDN link, a website)
 * into WeDance's own Cloudinary, so the page keeps its photo when the source
 * link expires. Cloudinary fetches the URL itself, so our server never opens
 * an arbitrary address, and it refuses anything that isn't an image.
 *
 * A photo already on our Cloudinary is kept as is.
 */
export async function rehostImage(url: string, folder: 'profiles' | 'events' = 'profiles'): Promise<string> {
  const keys = cloudinaryKeys()
  if (!keys) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Photo upload isn’t set up on this server. Leave the photo out and try again.' })
  }
  const { cloud, apiKey, apiSecret } = keys
  if (url.startsWith(`https://res.cloudinary.com/${cloud}/`)) return url
  cloudinary.v2.config({ cloud_name: cloud, api_key: apiKey, api_secret: apiSecret })
  try {
    const res = await cloudinary.v2.uploader.upload(url, { folder: `wedance-2026/${folder}`, resource_type: 'image' })
    return res.secure_url as string
  } catch {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'That photo couldn’t be loaded. Use a direct link to an image (JPG, PNG or WebP) that opens without signing in.' })
  }
}

/**
 * The Cloudinary keys: Nitro's runtime config, or the same env vars when run
 * from a script outside Nitro (scripts/backfill-instagram-profiles.ts). Null
 * when photo upload isn't set up.
 */
export function cloudinaryKeys(): { cloud: string; apiKey: string; apiSecret: string } | null {
  const config = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : null
  const cloud = config ? config.public?.cloudinaryCloudName : process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = config ? config.cloudinaryApiKey : process.env.NUXT_CLOUDINARY_API_KEY
  const apiSecret = config ? config.cloudinaryApiSecret : process.env.NUXT_CLOUDINARY_API_SECRET
  return cloud && apiKey && apiSecret ? { cloud, apiKey, apiSecret } : null
}

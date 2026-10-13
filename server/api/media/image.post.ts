import { defineEventHandler, readMultipartFormData, getQuery, createError } from 'h3'
import cloudinary from 'cloudinary'

// Allowed Cloudinary sub-folders (?folder=…); anything else falls back to avatars.
const FOLDERS = new Set(['avatars', 'profiles', 'events', 'flyers'])

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.cloudinaryApiKey || !config.cloudinaryApiSecret || !config.public.cloudinaryCloudName) {
    throw createError({ statusCode: 503, statusMessage: 'Image upload is not configured.' })
  }

  cloudinary.v2.config({
    cloud_name: config.public.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  })

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No form data provided.' })
  }

  const fileField = formData.find((f) => f.name === 'file')
  if (!fileField || !fileField.data) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded.' })
  }

  const requested = String(getQuery(event).folder ?? '')
  const folder = FOLDERS.has(requested) ? requested : 'avatars'

  const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream(
      { folder: `wedance-2026/${folder}` },
      (error, result) => {
        if (error) reject(error)
        else resolve(result as { secure_url: string })
      },
    )
    stream.end(fileField.data)
  })

  return { url: uploadResult.secure_url }
})

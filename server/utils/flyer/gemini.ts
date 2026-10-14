/**
 * Thin Gemini REST client for flyers: paint an image, read text off an image,
 * write a caption. No SDK — same endpoints as the image-from-gemini skill.
 */
import { logAiCall, aiLabel } from '../aiUsage'

const API = 'https://generativelanguage.googleapis.com/v1beta/models'
export const IMAGE_MODEL = 'gemini-3.1-flash-image-preview'
// The alias, not a pinned version: pinned flash models get retired for new keys
// (gemini-2.5-flash was, 2026-10).
export const TEXT_MODEL = 'gemini-flash-latest'

export type InlineImage = { mimeType: string; data: string } // base64

function key() {
  const k = useRuntimeConfig().geminiApiKey
  if (!k) throw new Error('Flyers aren’t set up: GEMINI_API_KEY is missing.')
  return k
}

// A call that hangs would leave a flyer "painting" or "checking" forever.
// Painting gets 2 minutes, reading text 1.
// Every call is logged to ai_usage (purpose, tokens, cost, time; /admin/ai-usage).
async function call(model: string, body: unknown, purpose: string) {
  const ms = model === IMAGE_MODEL ? 120_000 : 60_000
  const started = performance.now()
  let res: Response
  try {
    res = await fetch(`${API}/${model}:generateContent?key=${key()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    })
  } catch (e: any) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    await logAiCall({ purpose, model, durationMs: performance.now() - started, status: 'error', error: timeout ? 'timeout' : (e?.message ?? String(e)) })
    if (timeout) throw new Error(model === IMAGE_MODEL ? 'Painting took too long. Try again.' : 'Reading the words took too long.')
    throw e
  }
  const json: any = await res.json().catch(() => ({}))
  const parts = json?.candidates?.[0]?.content?.parts ?? []
  // A painting with no image back is a soft refusal.
  const refused = res.ok && model === IMAGE_MODEL && !parts.some((p: any) => p.inlineData?.data)
  await logAiCall({ purpose, model, durationMs: performance.now() - started, status: !res.ok ? 'error' : refused ? 'refused' : 'ok', response: json, error: res.ok ? (refused ? json?.candidates?.[0]?.finishReason : undefined) : (json?.error?.message || `Gemini ${res.status}`) })
  if (!res.ok) throw new Error(json?.error?.message || `Gemini ${res.status}`)
  return json
}

/**
 * One painted image, or null when Gemini softly refuses (IMAGE_OTHER / no parts).
 * Refusals are random — callers retry the same prompt.
 */
export async function paint(prompt: string, images: InlineImage[], aspectRatio: '9:16' | '4:5'): Promise<InlineImage | null> {
  const json = await call(IMAGE_MODEL, {
    // Images first, then the words: "Image 1" in the prompt is the first image (the skill's order).
    contents: [{ parts: [...images.map(i => ({ inlineData: i })), { text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } },
  }, `paint: ${aiLabel() ?? 'image'}`)
  const parts = json?.candidates?.[0]?.content?.parts ?? []
  const img = parts.find((p: any) => p.inlineData?.data)
  return img ? { mimeType: img.inlineData.mimeType || 'image/png', data: img.inlineData.data } : null
}

/**
 * Paint with retries on soft refusals. Refusals (no image back) are random and
 * the La Clave recipe retries the same prompt up to ~8×; a refusal returns no
 * image, so it costs far less than a painting. Six here, within the 5-minute job.
 */
export async function paintWithRetries(prompt: string, images: InlineImage[], aspectRatio: '9:16' | '4:5', tries = 6) {
  let lastError: unknown = null
  // The job has 5 minutes: no new try after 3.5.
  const until = Date.now() + 210_000
  for (let i = 0; i < tries && Date.now() < until; i++) {
    try {
      const img = await paint(prompt, images, aspectRatio)
      if (img) return img
    } catch (e) {
      lastError = e
    }
  }
  throw new Error(lastError instanceof Error ? lastError.message : 'Gemini didn’t return an image after several tries.')
}

/** Every line of text visible on the image, exactly as printed. */
export async function readText(image: InlineImage): Promise<string[]> {
  const json = await call(TEXT_MODEL, {
    contents: [{ parts: [
      // Without the "_" rule the reader fills in letters a person's head covers
      // (it read "THURSDAY" off "TH[head]DAY"), and the check passes a broken flyer.
      { text: 'You are proofreading a poster before it is printed. Transcribe only the letters you can actually see, exactly as printed: keep spelling, accents, umlauts, numbers and symbols, and do not correct anything. If any letters of a word are hidden — covered by a person, an object, cropped off or unreadable — do not guess them: write each hidden letter as "_" (for example "TH___DAY"). One entry per line of text.' },
      { inlineData: image },
    ] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { lines: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['lines'] },
      temperature: 0,
    },
  }, 'read-back')
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  try { return JSON.parse(text).lines ?? [] } catch { return [] }
}

export async function writeText(prompt: string): Promise<string> {
  const json = await call(TEXT_MODEL, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } }, aiLabel() ?? 'text')
  return (json?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('').trim()
}

/** Fetch a photo URL as an inline image (line-up reference photos). */
export async function fetchImage(url: string): Promise<InlineImage | null> {
  try {
    // Photos stored as site paths ("/people/silvio.jpg", the festival imports).
    const abs = url.startsWith('/') ? `${(useRuntimeConfig().siteUrl || 'https://2026.wedance.vip').replace(/\/$/, '')}${url}` : url
    const res = await fetch(abs)
    if (!res.ok) return null
    const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]!
    if (!mimeType.startsWith('image/')) return null
    return { mimeType, data: Buffer.from(await res.arrayBuffer()).toString('base64') }
  } catch {
    return null
  }
}

/** Ask about some images and get JSON back (reading a look off past flyers). */
export async function askAboutImages<T>(prompt: string, images: InlineImage[]): Promise<T> {
  const json = await call(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }, ...images.map(i => ({ inlineData: i }))] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  }, aiLabel() ?? 'read images')
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '{}'
  return JSON.parse(text.replace(/^```(json)?|```$/g, '').trim()) as T
}

/** Text in, JSON out (captions). */
export async function writeJson<T>(prompt: string): Promise<T> {
  const json = await call(TEXT_MODEL, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }, aiLabel() ?? 'text')
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '{}'
  return JSON.parse(text.replace(/^```(json)?|```$/g, '').trim()) as T
}

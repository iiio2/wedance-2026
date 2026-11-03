/**
 * Spike: the flyer agent's hands. Claude (the art director) calls these from
 * Bash; each Gemini call is logged with its cost to <run>/calls.jsonl.
 *
 *   bun tools.ts paint --prompt <file> [--image <png|jpg>]... --out <png> [--aspect 9:16|4:5]
 *   bun tools.ts read  --image <png>
 *   bun tools.ts fit   --image <png> --out <png> [--aspect 9:16|4:5]
 *
 * paint = a new poster or an edit (pass the poster to change as an image).
 * Images go first, then the words: "image 1" in a prompt is the first --image.
 * Budget: FLYER_MAX_PAINTS (default 8) paintings per run directory.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { aiCost, tokensOf } from '../../shared/utils/aiPricing'

const API = 'https://generativelanguage.googleapis.com/v1beta/models'
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview'
const TEXT_MODEL = 'gemini-flash-latest'
const SIZE = { '9:16': { width: 1080, height: 1920 }, '4:5': { width: 1080, height: 1350 } } as const

const [cmd, ...rest] = process.argv.slice(2)
const arg = (k: string) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : undefined }
const args = (k: string) => rest.flatMap((v, i) => rest[i - 1] === `--${k}` ? [v] : [])
const run = process.env.FLYER_RUN_DIR || process.cwd()
const log = resolve(run, 'calls.jsonl')

async function inline(path: string) {
  const buf = readFileSync(path)
  const { format } = await sharp(buf).metadata()
  if (format === 'jpeg' || format === 'png' || format === 'webp') return { mimeType: `image/${format}`, data: buf.toString('base64') }
  return { mimeType: 'image/png', data: (await sharp(buf).png().toBuffer()).toString('base64') }
}

async function gemini(model: string, body: unknown, purpose: string) {
  const started = performance.now()
  const res = await fetch(`${API}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
  })
  const json: any = await res.json().catch(() => ({}))
  const t = tokensOf(json?.usageMetadata)
  const cost = aiCost(json?.modelVersion || model, t) ?? 0
  appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), purpose, model, ok: res.ok, finish: json?.candidates?.[0]?.finishReason, ms: Math.round(performance.now() - started), cost }) + '\n')
  if (!res.ok) throw new Error(json?.error?.message || `Gemini ${res.status}`)
  return json
}

function paintsSoFar() {
  if (!existsSync(log)) return 0
  return readFileSync(log, 'utf8').split('\n').filter(l => l.includes('"purpose":"paint"') && l.includes('"ok":true')).length
}

async function fit(img: Buffer, aspect: '9:16' | '4:5') {
  return sharp(img).resize({ ...SIZE[aspect], fit: 'cover', position: 'centre' }).png().toBuffer()
}

if (cmd === 'paint') {
  const max = Number(process.env.FLYER_MAX_PAINTS || 8)
  if (paintsSoFar() >= max) { console.log(`BUDGET SPENT: ${max} paintings used. Pick your best poster and finish.`); process.exit(0) }
  const prompt = readFileSync(arg('prompt')!, 'utf8')
  const aspect = (arg('aspect') || '9:16') as '9:16' | '4:5'
  const images = await Promise.all(args('image').map(inline))
  // Soft refusals (no image back) are random: retry the same prompt a few times.
  for (let i = 0; i < 4; i++) {
    const json = await gemini(IMAGE_MODEL, {
      contents: [{ parts: [...images.map(i => ({ inlineData: i })), { text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect } },
    }, 'paint').catch(e => ({ error: e.message }))
    const part = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)
    if (part) {
      const out = resolve(arg('out')!)
      writeFileSync(out, await fit(Buffer.from(part.inlineData.data, 'base64'), aspect))
      console.log(`Saved ${out} (${SIZE[aspect].width}×${SIZE[aspect].height}). Paintings used: ${paintsSoFar()}/${max}. Look at it with Read before deciding.`)
      process.exit(0)
    }
    console.error(`try ${i + 1}: no image (${json?.error || json?.candidates?.[0]?.finishReason || 'refused'})`)
  }
  console.log('Gemini returned no image after 4 tries. Shorten or soften the prompt (no "identity", no "keep his face exactly") and try again.')
} else if (cmd === 'read') {
  const json = await gemini(TEXT_MODEL, {
    contents: [{ parts: [
      { text: 'You are proofreading a poster before it is printed. Transcribe only the letters you can actually see, exactly as printed: keep spelling, accents, umlauts, numbers and symbols, and do not correct anything. If any letters of a word are hidden or cut off, write each hidden letter as "_". One entry per line of text, top to bottom.' },
      { inlineData: await inline(arg('image')!) },
    ] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { lines: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['lines'] }, temperature: 0 },
  }, 'read')
  console.log(JSON.parse(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"lines":[]}').lines.join('\n'))
} else if (cmd === 'fit') {
  const out = resolve(arg('out')!)
  writeFileSync(out, await fit(readFileSync(arg('image')!), (arg('aspect') || '9:16') as '9:16' | '4:5'))
  console.log(`Saved ${out}`)
} else {
  console.log('Usage: paint | read | fit (see the header of this file)')
}

/**
 * What a Gemini call cost, from the tokens Gemini reports (usageMetadata).
 * Paid-tier standard prices in USD per 1M tokens, from
 * https://ai.google.dev/gemini-api/docs/pricing (read 2026-10-14). Image output
 * is priced per token (a 1K image ≈ 1,120 tokens ≈ $0.067 on Flash Image).
 * Update here when Google changes them; unknown models cost null (not 0).
 */
export const PRICES_CHECKED = '2026-10-14'
// `from`: the price starts that day (Google announced 3.6/3.8 Flash doubling on 2027-01-01).
const PRICES: { prefix: string; input: number; text: number; image?: number; from?: string }[] = [
  { prefix: 'gemini-3.8-flash', input: 1.5, text: 7.5, from: '2027-01-01' },
  { prefix: 'gemini-3.8-flash', input: 0.75, text: 3.75 },
  { prefix: 'gemini-3.6-flash', input: 1.5, text: 7.5, from: '2027-01-01' },
  { prefix: 'gemini-3.6-flash', input: 0.75, text: 3.75 },
  { prefix: 'gemini-3.1-flash-image', input: 0.5, text: 3, image: 60 },
  { prefix: 'gemini-3-pro-image', input: 2, text: 12, image: 120 },
  { prefix: 'gemini-3-flash', input: 0.5, text: 3 },
  { prefix: 'gemini-2.5-flash', input: 0.3, text: 2.5 },
]

export type AiTokens = { input: number; outputText: number; outputImage: number; thoughts: number }

/** The price for a model on a day (yyyy-mm-dd; default today). Gemini's alias resolves to the model it reports. */
export function priceFor(model: string, day = new Date().toISOString().slice(0, 10)) {
  return PRICES.find(p => model.startsWith(p.prefix) && (!p.from || day >= p.from)) ?? null
}

/** Cost in USD, or null when the model isn't in the price list. Thinking is billed as text output. */
export function aiCost(model: string, t: AiTokens, day?: string): number | null {
  const p = priceFor(model, day)
  if (!p) return null
  return (t.input * p.input + (t.outputText + t.thoughts) * p.text + t.outputImage * (p.image ?? p.text)) / 1_000_000
}

/** The token counts out of a Gemini response's usageMetadata. */
export function tokensOf(usage: any): AiTokens {
  const details: any[] = usage?.candidatesTokensDetails ?? []
  const image = details.filter(d => d.modality === 'IMAGE').reduce((n, d) => n + (d.tokenCount ?? 0), 0)
  const total = usage?.candidatesTokenCount ?? 0
  return { input: usage?.promptTokenCount ?? 0, outputImage: image, outputText: Math.max(0, total - image), thoughts: usage?.thoughtsTokenCount ?? 0 }
}

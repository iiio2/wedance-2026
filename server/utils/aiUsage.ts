/**
 * Who and what an AI call is for, carried through async work (a flyer painted
 * after the response) without passing it along: the action that started it
 * (tRPC path), the person, the event and the flyer. Every Gemini call is
 * logged to ai_usage with it (server/utils/flyer/gemini.ts), never failing
 * the call itself.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { aiUsage } from '../database/schema'
import { aiCost, tokensOf } from '../../shared/utils/aiPricing'
import { useDb } from './db'

export type AiContext = {
  source?: string; dancerId?: string | null; eventId?: string | null; flyerId?: string | null
  /** What the work is ("caption: artist", a flyer's mode): names the logged call. */
  label?: string
}
/** The label set for this work, if any. */
export const aiLabel = () => store.getStore()?.label
const store = new AsyncLocalStorage<AiContext>()

/** Run `fn` with more context (merged into what's already there). */
export function withAi<T>(more: AiContext, fn: () => T): T {
  return store.run({ ...(store.getStore() ?? {}), ...more }, fn)
}

export async function logAiCall(e: { purpose: string; model: string; durationMs: number; status: 'ok' | 'refused' | 'error'; response?: any; error?: string }) {
  try {
    const c = store.getStore() ?? {}
    const t = tokensOf(e.response?.usageMetadata)
    const version = e.response?.modelVersion ?? null
    const cost = aiCost(version || e.model, t)
    await useDb().insert(aiUsage).values({
      purpose: e.purpose, source: c.source ?? null, model: e.model, modelVersion: version, status: e.status, durationMs: Math.round(e.durationMs),
      inputTokens: t.input, outputTextTokens: t.outputText, outputImageTokens: t.outputImage, thoughtTokens: t.thoughts,
      costUsd: cost == null ? null : cost.toFixed(6), eventId: c.eventId ?? null, flyerId: c.flyerId ?? null, dancerId: c.dancerId ?? null,
      error: e.error?.slice(0, 500) ?? null,
    })
  } catch (err) {
    // The log never breaks the work it logs.
    console.warn('[ai-usage] not logged:', (err as any)?.message ?? err)
  }
}

import { describe, expect, it } from 'vitest'
import { aiCost, tokensOf } from './aiPricing'

describe('aiCost', () => {
  it('prices a painted flyer from its tokens', () => {
    const t = tokensOf({ promptTokenCount: 1000, candidatesTokenCount: 1300, candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }, { modality: 'TEXT', tokenCount: 180 }] })
    expect(t).toEqual({ input: 1000, outputImage: 1120, outputText: 180, thoughts: 0 })
    // 1000 × 0.5 + 180 × 3 + 1120 × 60, per million
    expect(aiCost('gemini-3.1-flash-image-preview', t)).toBeCloseTo(0.06824, 5)
  })
  it('knows the alias’s current model and its 2027 price', () => {
    const t = { input: 390, outputText: 119, outputImage: 0, thoughts: 796 }
    expect(aiCost('gemini-3.8-flash', t, '2026-10-14')).toBeCloseTo((390 * 0.75 + 915 * 3.75) / 1e6, 9)
    expect(aiCost('gemini-3.8-flash', t, '2027-01-02')).toBeCloseTo((390 * 1.5 + 915 * 7.5) / 1e6, 9)
  })
  it('bills thinking as text output, and doesn’t guess unknown models', () => {
    expect(aiCost('gemini-3-flash-preview', { input: 2000, outputText: 300, outputImage: 0, thoughts: 700 })).toBeCloseTo(0.004, 6)
    expect(aiCost('some-new-model', { input: 1, outputText: 1, outputImage: 0, thoughts: 0 })).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import { PREVIEW_FIXTURE_DECK_PAYLOAD } from '@/components/matcha-deck/fixtures'
import {
  createDeckSourcePayload,
  isMatchaDeckPreviewAllowed,
} from '@/components/matcha-deck/sourceBoundary'
import type { DeckRecommendation } from '@/components/matcha-deck/types'

function liveRecommendation(): DeckRecommendation {
  return {
    recommendationId: 'rec-001',
    opportunityVersion: 'opp-v1',
    opportunity: {
      opportunityId: 'opp-001',
      title: 'Hospitalist',
      employerName: 'North Valley Health',
      workArrangement: 'onsite',
    },
    explanation: {
      overallLabel: 'possible',
      confirmed: [],
      preferences: [],
      needsReview: [],
      unknown: [],
      blockers: [],
    },
    freshness: { label: 'Posting date unknown', stale: false },
    actions: { canExpressInterest: true, canApply: true },
  }
}

describe('MATCHA Deck source boundary', () => {
  it('keeps Apply disabled for every preview fixture recommendation', () => {
    expect(PREVIEW_FIXTURE_DECK_PAYLOAD.mode).toBe('preview_fixture')
    for (const recommendation of PREVIEW_FIXTURE_DECK_PAYLOAD.recommendations) {
      expect(recommendation.isFixture).toBe(true)
      expect(recommendation.actions.canApply).toBe(false)
    }
  })

  it.each([
    ['fixture flag', { isFixture: true }],
    ['fixture id', { recommendationId: 'fx-rec-001' }],
    ['sample employer', { opportunity: { ...liveRecommendation().opportunity, employerName: 'Sample Health' } }],
  ])('rejects %s markers in a live payload', (_label, patch) => {
    const recommendation = { ...liveRecommendation(), ...patch } as DeckRecommendation
    expect(() =>
      createDeckSourcePayload({
        mode: 'live',
        sourceLabel: 'Live MATCHA recommendations',
        recommendations: [recommendation],
      }),
    ).toThrow(/Fixture marker detected/)
  })

  it('rejects a fixture marker in a live source label', () => {
    expect(() =>
      createDeckSourcePayload({
        mode: 'live',
        sourceLabel: 'Sample recommendations',
        recommendations: [liveRecommendation()],
      }),
    ).toThrow(/source label/)
  })

  it('accepts a clean live payload', () => {
    const payload = createDeckSourcePayload({
      mode: 'live',
      sourceLabel: 'Live MATCHA recommendations',
      recommendations: [liveRecommendation()],
    })
    expect(payload.mode).toBe('live')
  })

  it('requires an honest empty payload to contain no recommendations', () => {
    expect(() =>
      createDeckSourcePayload({
        mode: 'empty',
        sourceLabel: 'Live feed unavailable',
        recommendations: [liveRecommendation()],
      }),
    ).toThrow(/cannot contain recommendations/)
  })

  it('never enables the preview harness on canonical production', () => {
    expect(
      isMatchaDeckPreviewAllowed({
        NODE_ENV: 'production',
        MATCHA_DECK_PREVIEW: '1',
        RAILWAY_ENVIRONMENT: 'production',
      }),
    ).toBe(false)
    expect(isMatchaDeckPreviewAllowed({ NODE_ENV: 'production' })).toBe(false)
    expect(
      isMatchaDeckPreviewAllowed({ NODE_ENV: 'production', MATCHA_DECK_PREVIEW: '1' }),
    ).toBe(true)
    expect(isMatchaDeckPreviewAllowed({ NODE_ENV: 'development' })).toBe(true)
  })
})

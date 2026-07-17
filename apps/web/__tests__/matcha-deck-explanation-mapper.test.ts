import { describe, expect, it } from 'vitest'

import {
  classifyFitReason,
  mapEngineExplanation,
  overallLabelForBand,
  type EngineExplanation,
} from '@/lib/matcha-deck/explanationMapper'

function engine(overrides: Partial<EngineExplanation> = {}): EngineExplanation {
  return {
    matchBand: 'NEAR_CLEAR',
    matchScore: 70,
    fitReasons: [],
    blockers: [],
    ...overrides,
  }
}

describe('explanation mapper — band → overall label', () => {
  it('maps each band to its deck label', () => {
    expect(overallLabelForBand('CLEAR')).toBe('strong')
    expect(overallLabelForBand('NEAR_CLEAR')).toBe('promising')
    expect(overallLabelForBand('PARTIAL')).toBe('possible')
    expect(overallLabelForBand('INELIGIBLE')).toBe('limited')
  })

  it('falls back to possible for an unknown band', () => {
    expect(overallLabelForBand('WHATEVER')).toBe('possible')
  })
})

describe('explanation mapper — confirmed is only ever source-checked', () => {
  it('a "checked" credential positive lands in confirmed as source_backed', () => {
    const result = mapEngineExplanation(
      engine({ fitReasons: [{ dimension: 'state', label: 'CA license checked', positive: true }] }),
    )
    expect(result.confirmed).toHaveLength(1)
    expect(result.confirmed[0]).toMatchObject({ kind: 'source_backed', label: 'CA license checked' })
    expect(result.needsReview).toHaveLength(0)
  })

  it('an "on file, not source-checked" positive is inferred and routes to needsReview, never confirmed', () => {
    const result = mapEngineExplanation(
      engine({
        fitReasons: [
          { dimension: 'state', label: 'CA license on file, not source-checked', positive: true },
        ],
      }),
    )
    expect(result.confirmed).toHaveLength(0)
    expect(result.needsReview).toHaveLength(1)
    expect(result.needsReview[0].kind).toBe('inferred')
  })

  it('the fabrication shape can NEVER reach confirmed', () => {
    // Every positive evidence label that does not literally say "checked" must
    // stay out of the confirmed group. This is the guard against a future
    // engine label sneaking an unverified claim into "confirmed".
    const suspiciousPositives = [
      'Licensed in NY', // the old fabricated label
      'CA license on file, not source-checked',
      'Practice address in CA — license not checked',
      'State license claimed',
    ]
    for (const label of suspiciousPositives) {
      const result = mapEngineExplanation(
        engine({ fitReasons: [{ dimension: 'state', label, positive: true }] }),
      )
      for (const reason of result.confirmed) {
        expect(reason.label).toMatch(/\bchecked\b/i)
        expect(reason.label).not.toMatch(/not (?:source-)?checked/i)
      }
    }
  })
})

describe('explanation mapper — preferences vs evidence', () => {
  it('positive preference dimensions land in preferences', () => {
    const result = mapEngineExplanation(
      engine({
        fitReasons: [
          { dimension: 'location', label: 'CA is in preferred locations', positive: true },
          { dimension: 'pay', label: 'Pay range meets minimum', positive: true },
          { dimension: 'schedule', label: 'Permanent role matches preference', positive: true },
        ],
      }),
    )
    expect(result.preferences.map((r) => r.kind)).toEqual(['preference', 'preference', 'preference'])
    expect(result.confirmed).toHaveLength(0)
  })

  it('a negative preference is a needs-review item, not a blocker', () => {
    const result = mapEngineExplanation(
      engine({ fitReasons: [{ dimension: 'pay', label: 'Pay range below minimum preference', positive: false }] }),
    )
    expect(result.needsReview).toHaveLength(1)
    expect(result.blockers).toHaveLength(0)
  })
})

describe('explanation mapper — negatives split review vs unknown', () => {
  it('a "not checked" negative is unknown', () => {
    const result = mapEngineExplanation(
      engine({
        fitReasons: [
          {
            dimension: 'state',
            label: 'Remote role — needs NY license (telehealth is practiced where the patient is)',
            positive: false,
          },
          { dimension: 'state', label: 'Practice address in CA — license not checked', positive: false },
        ],
      }),
    )
    // "needs NY license" is a real gap → needsReview; "not checked" → unknown.
    expect(result.unknown.some((r) => /not checked/i.test(r.label))).toBe(true)
    expect(result.needsReview.some((r) => /needs NY license/i.test(r.label))).toBe(true)
  })

  it('a plain negative evidence reason is needs-review', () => {
    const result = mapEngineExplanation(
      engine({ fitReasons: [{ dimension: 'specialty', label: 'Specialty mismatch (EM required)', positive: false }] }),
    )
    expect(result.needsReview).toHaveLength(1)
    expect(result.needsReview[0].kind).toBe('needs_review')
  })
})

describe('explanation mapper — blockers by severity', () => {
  it('a hard blocker lands in blockers; a soft one is needs-review', () => {
    const result = mapEngineExplanation(
      engine({
        blockers: [
          { label: 'DEA registration', severity: 'hard', actionLabel: 'Add DEA' },
          { label: 'CA medical license', severity: 'soft', actionLabel: 'Apply for CA license' },
        ],
      }),
    )
    expect(result.blockers).toHaveLength(1)
    expect(result.blockers[0]).toMatchObject({ kind: 'blocker', label: 'DEA registration' })
    expect(result.blockers[0].origin).toContain('Add DEA')
    expect(result.needsReview).toHaveLength(1)
    expect(result.needsReview[0].label).toBe('CA medical license')
  })
})

describe('explanation mapper — classifyFitReason units', () => {
  it('classifies the full matrix', () => {
    expect(classifyFitReason({ dimension: 'state', label: 'CA license checked', positive: true })).toBe('source_backed')
    expect(classifyFitReason({ dimension: 'credentials', label: 'DEA on file, not source-checked', positive: true })).toBe('inferred')
    expect(classifyFitReason({ dimension: 'location', label: 'preferred', positive: true })).toBe('preference')
    expect(classifyFitReason({ dimension: 'pay', label: 'below minimum', positive: false })).toBe('needs_review')
    expect(classifyFitReason({ dimension: 'state', label: 'requirements not checked', positive: false })).toBe('unknown')
    expect(classifyFitReason({ dimension: 'specialty', label: 'mismatch', positive: false })).toBe('needs_review')
  })
})

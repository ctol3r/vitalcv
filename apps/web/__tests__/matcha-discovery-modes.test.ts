import { describe, expect, it } from 'vitest'

import {
  applyDiscoveryMode,
  isModeAvailable,
  DISCOVERY_MODES,
} from '@/lib/matcha-deck/discoveryModes'
import { FIXTURE_RECOMMENDATIONS } from '@/components/matcha-deck/fixtures'

const ids = (list: { recommendationId: string }[]) => list.map((r) => r.recommendationId)

describe('discovery modes — honest re-ranking (J6)', () => {
  it('for_you preserves the MATCHA order and never mutates the input', () => {
    const before = ids(FIXTURE_RECOMMENDATIONS)
    const out = applyDiscoveryMode(FIXTURE_RECOMMENDATIONS, 'for_you')
    expect(ids(out)).toEqual(before)
    // input untouched
    expect(ids(FIXTURE_RECOMMENDATIONS)).toEqual(before)
  })

  it('ready_sooner orders by fewest readiness gaps first, ties keep MATCHA order', () => {
    const out = applyDiscoveryMode(FIXTURE_RECOMMENDATIONS, 'ready_sooner')
    const gaps = out.map((r) => r.explanation.needsReview.length + r.explanation.blockers.length)
    // non-decreasing gap counts
    for (let i = 1; i < gaps.length; i += 1) {
      expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1])
    }
  })

  it('best_comp ranks disclosed pay highest-first and pushes unknown pay LAST, never as zero', () => {
    const out = applyDiscoveryMode(FIXTURE_RECOMMENDATIONS, 'best_comp')
    const hasComp = (r: (typeof out)[number]) =>
      !!r.opportunity.compensation && r.opportunity.compensation.provenance !== 'unknown'
    // Every priced role comes before every unpriced role.
    const firstUnpriced = out.findIndex((r) => !hasComp(r))
    if (firstUnpriced !== -1) {
      expect(out.slice(firstUnpriced).every((r) => !hasComp(r))).toBe(true)
    }
    // Among priced roles, compensation is non-increasing.
    const priced = out.filter(hasComp).map((r) => r.opportunity.compensation!.max ?? r.opportunity.compensation!.min ?? 0)
    for (let i = 1; i < priced.length; i += 1) {
      expect(priced[i]).toBeLessThanOrEqual(priced[i - 1])
    }
  })

  it('remote keeps only remote / hybrid / multi-site roles', () => {
    const out = applyDiscoveryMode(FIXTURE_RECOMMENDATIONS, 'remote')
    expect(out.length).toBeGreaterThan(0)
    for (const r of out) {
      expect(['remote', 'hybrid', 'multi_site']).toContain(r.opportunity.workArrangement)
    }
  })

  it('new orders by most-recent freshness first; undated roles sort last', () => {
    const out = applyDiscoveryMode(FIXTURE_RECOMMENDATIONS, 'new')
    const time = (r: (typeof out)[number]) => {
      const f = r.freshness
      const stamp = f.lastMaterialChangeAt ?? f.postedAt ?? f.ingestedAt
      return stamp ? Date.parse(stamp) : null
    }
    const times = out.map(time)
    const firstNull = times.findIndex((t) => t === null)
    if (firstNull !== -1) {
      expect(times.slice(firstNull).every((t) => t === null)).toBe(true)
    }
    const dated = times.filter((t): t is number => t !== null)
    for (let i = 1; i < dated.length; i += 1) {
      expect(dated[i]).toBeLessThanOrEqual(dated[i - 1])
    }
  })

  it('near_me needs a location: unavailable without one, in-state first with one', () => {
    expect(isModeAvailable('near_me', {})).toBe(false)
    expect(isModeAvailable('near_me', { homeState: 'CA' })).toBe(true)

    const out = applyDiscoveryMode(FIXTURE_RECOMMENDATIONS, 'near_me', { homeState: 'CA' })
    const tier = (r: (typeof out)[number]) => {
      if (r.opportunity.state?.toUpperCase() === 'CA') return 0
      if (['remote', 'hybrid', 'multi_site'].includes(r.opportunity.workArrangement)) return 1
      return 2
    }
    const tiers = out.map(tier)
    for (let i = 1; i < tiers.length; i += 1) {
      expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1])
    }
  })

  it('every non-location mode is always available', () => {
    for (const meta of DISCOVERY_MODES) {
      if (!meta.needsLocation) expect(isModeAvailable(meta.mode, {})).toBe(true)
    }
  })

  it('no mode invents a recommendation — output is always a subset of the input', () => {
    const inputIds = new Set(ids(FIXTURE_RECOMMENDATIONS))
    for (const meta of DISCOVERY_MODES) {
      const out = applyDiscoveryMode(FIXTURE_RECOMMENDATIONS, meta.mode, { homeState: 'CA' })
      for (const r of out) expect(inputIds.has(r.recommendationId)).toBe(true)
    }
  })
})

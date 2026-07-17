import { describe, expect, it } from 'vitest'

import { FIXTURE_RECOMMENDATIONS } from '@/components/matcha-deck/fixtures'
import type { DeckRecommendation } from '@/components/matcha-deck/types'
import type { DeckDecisionDetail } from '@/lib/matcha/opportunitySignals'
import {
  buildDeckWorkspaces,
  buildWorkspaceItem,
  toCompareColumn,
} from '@/lib/matcha-deck/workspace'

const recs = FIXTURE_RECOMMENDATIONS
const rec = (i: number): DeckRecommendation => recs[i]
const oppId = (i: number) => rec(i).opportunity.opportunityId

function detail(over: Partial<DeckDecisionDetail> & { opportunityId: string; decision: DeckDecisionDetail['decision'] }): DeckDecisionDetail {
  return { opportunityVersion: null, recommendationId: null, decidedAt: null, ...over }
}

describe('workspace — join with live feed', () => {
  it('an active decided role is hydrated from the live feed', () => {
    const map = new Map(recs.map((r) => [r.opportunity.opportunityId, r]))
    const item = buildWorkspaceItem(
      detail({ opportunityId: oppId(0), decision: 'interested', opportunityVersion: rec(0).opportunityVersion }),
      map,
    )
    expect(item.status).toBe('active')
    expect(item.recommendation?.opportunity.opportunityId).toBe(oppId(0))
  })

  it('a role no longer in the feed is unavailable, with no invented content', () => {
    const item = buildWorkspaceItem(
      detail({ opportunityId: 'gone-opp', decision: 'interested', opportunityVersion: 'v1' }),
      new Map(),
    )
    expect(item.status).toBe('unavailable')
    expect(item.recommendation).toBeUndefined()
    expect(item.versionSeen).toBe('v1')
  })

  it('a version mismatch marks the role changed; a match stays active', () => {
    const map = new Map([[oppId(0), rec(0)]])
    const changed = buildWorkspaceItem(
      detail({ opportunityId: oppId(0), decision: 'interested', opportunityVersion: 'OLD-VERSION' }),
      map,
    )
    expect(changed.status).toBe('changed')

    const same = buildWorkspaceItem(
      detail({ opportunityId: oppId(0), decision: 'interested', opportunityVersion: rec(0).opportunityVersion }),
      map,
    )
    expect(same.status).toBe('active')
  })

  it('a missing stored version is not treated as a change', () => {
    const map = new Map([[oppId(0), rec(0)]])
    const item = buildWorkspaceItem(
      detail({ opportunityId: oppId(0), decision: 'interested', opportunityVersion: null }),
      map,
    )
    expect(item.status).toBe('active')
  })
})

describe('workspace — split and ordering', () => {
  const details: DeckDecisionDetail[] = [
    detail({ opportunityId: oppId(0), decision: 'interested', decidedAt: '2026-07-16T10:00:00Z', opportunityVersion: rec(0).opportunityVersion }),
    detail({ opportunityId: oppId(1), decision: 'passed', decidedAt: '2026-07-16T09:00:00Z' }),
    detail({ opportunityId: oppId(3), decision: 'priority', decidedAt: '2026-07-15T08:00:00Z', opportunityVersion: rec(3).opportunityVersion }),
    detail({ opportunityId: oppId(4), decision: 'interested', decidedAt: '2026-07-16T11:00:00Z', opportunityVersion: rec(4).opportunityVersion }),
    detail({ opportunityId: oppId(2), decision: 'passed', decidedAt: '2026-07-16T12:00:00Z' }),
  ]

  it('interested queue lists priority first, then newest interested', () => {
    const { interested } = buildDeckWorkspaces(details, recs)
    expect(interested.map((i) => i.opportunityId)).toEqual([
      oppId(3), // priority first even though it is the oldest
      oppId(4), // newest interested
      oppId(0),
    ])
  })

  it('passed history is newest first', () => {
    const { passed } = buildDeckWorkspaces(details, recs)
    expect(passed.map((i) => i.opportunityId)).toEqual([oppId(2), oppId(1)])
  })

  it('interested and passed are disjoint', () => {
    const { interested, passed } = buildDeckWorkspaces(details, recs)
    const iSet = new Set(interested.map((i) => i.opportunityId))
    expect(passed.every((p) => !iSet.has(p.opportunityId))).toBe(true)
  })
})

describe('workspace — compare columns', () => {
  it('builds a compare column from an active item and never invents values', () => {
    const map = new Map([[oppId(2), rec(2)]]) // fx-rec-003: remote, no comp disclosed
    const item = buildWorkspaceItem(detail({ opportunityId: oppId(2), decision: 'interested' }), map)
    const col = toCompareColumn(item)
    expect(col).not.toBeNull()
    // fixture 003 has no compensation → the cell value is null (renders "Not provided")
    expect(col!.cells.compensation.value).toBeNull()
    expect(col!.cells.arrangement.value).toBe('Remote')
    expect(col!.cells.unknowns.value).toBe(String(rec(2).explanation.unknown.length))
  })

  it('an unavailable item yields no compare column', () => {
    const item = buildWorkspaceItem(detail({ opportunityId: 'gone', decision: 'interested' }), new Map())
    expect(toCompareColumn(item)).toBeNull()
  })
})

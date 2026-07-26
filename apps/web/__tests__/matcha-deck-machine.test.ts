import { describe, expect, it } from 'vitest'

import {
  activeRecommendation,
  createDeckState,
  deckTransition,
  describeCard,
  interestedQueue,
  isDeckExhausted,
  matchSummaryText,
  passedHistory,
  type DeckEvent,
  type DeckState,
} from '../components/matcha-deck/deckMachine'
import { FIXTURE_RECOMMENDATIONS } from '../components/matcha-deck/fixtures'

function fresh(): DeckState {
  return createDeckState(FIXTURE_RECOMMENDATIONS)
}

function apply(state: DeckState, ...events: DeckEvent[]): DeckState {
  return events.reduce((acc, event) => deckTransition(acc, event).state, state)
}

describe('MATCHA deck machine — decisions', () => {
  it('starts on the first card with a position announcement', () => {
    const state = fresh()
    expect(state.cursor).toBe(0)
    expect(activeRecommendation(state)?.recommendationId).toBe('fx-rec-001')
    expect(state.announcement).toContain('Opportunity 1 of 6')
    expect(state.announcement).toContain('Hospitalist at Sample Health System')
  })

  it('interested advances the deck, records the decision, and emits exactly one signal', () => {
    const { state, signals } = deckTransition(fresh(), { type: 'decide', decision: 'interested' })
    expect(state.cursor).toBe(1)
    expect(state.decisions['fx-rec-001']).toBe('interested')
    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({
      action: 'interested',
      recommendationId: 'fx-rec-001',
      opportunityId: 'fx-opp-001',
      opportunityVersion: 'fx-v1',
    })
    expect(state.announcement).toContain('Saved as Interested.')
    expect(state.announcement).toContain('Next opportunity loaded.')
    expect(state.announcement).toContain('Opportunity 2 of 6')
  })

  it('pass and priority record their own decisions and announcements', () => {
    const afterPass = deckTransition(fresh(), { type: 'decide', decision: 'passed' })
    expect(afterPass.state.decisions['fx-rec-001']).toBe('passed')
    expect(afterPass.state.announcement).toContain('Passed.')
    expect(afterPass.signals[0]).toMatchObject({ action: 'passed' })

    const afterPriority = deckTransition(afterPass.state, { type: 'decide', decision: 'priority' })
    expect(afterPriority.state.decisions['fx-rec-002']).toBe('priority')
    expect(afterPriority.state.announcement).toContain('Saved as Priority.')
    expect(afterPriority.signals[0]).toMatchObject({ action: 'priority' })
  })

  it('never double-decides a card that already has a live decision', () => {
    const decided = deckTransition(fresh(), { type: 'decide', decision: 'interested' }).state
    // Force the cursor back onto the decided card, simulating a stale
    // animation callback replaying its commit.
    const replay = deckTransition({ ...decided, cursor: 0 }, { type: 'decide', decision: 'passed' })
    expect(replay.state.decisions['fx-rec-001']).toBe('interested')
    expect(replay.signals).toHaveLength(0)
  })

  it('interest is refused when the recommendation does not allow it', () => {
    const base = fresh()
    const gated: DeckState = {
      ...base,
      recommendations: base.recommendations.map((rec, i) =>
        i === 0 ? { ...rec, actions: { ...rec.actions, canExpressInterest: false } } : rec,
      ),
    }
    const { state, signals } = deckTransition(gated, { type: 'decide', decision: 'interested' })
    expect(state.cursor).toBe(0)
    expect(state.decisions).toEqual({})
    expect(signals).toHaveLength(0)
    expect(state.announcement).toContain('Interest is not available')
  })

  it('announcementSeq bumps on every announcing transition so identical text re-announces', () => {
    const base = fresh()
    const gated: DeckState = {
      ...base,
      recommendations: base.recommendations.map((rec, i) =>
        i === 0 ? { ...rec, actions: { ...rec.actions, canExpressInterest: false } } : rec,
      ),
    }
    const first = deckTransition(gated, { type: 'decide', decision: 'interested' })
    const second = deckTransition(first.state, { type: 'decide', decision: 'interested' })
    expect(second.state.announcement).toBe(first.state.announcement)
    expect(second.state.announcementSeq).toBe(first.state.announcementSeq + 1)
  })

  it('reaching the end of the deck announces caught up', () => {
    let state = fresh()
    for (let i = 0; i < FIXTURE_RECOMMENDATIONS.length; i += 1) {
      state = apply(state, { type: 'decide', decision: 'passed' })
    }
    expect(isDeckExhausted(state)).toBe(true)
    expect(state.announcement).toContain('You are caught up')
  })
})

describe('MATCHA deck machine — undo', () => {
  it('one-step undo restores the exact card, removes the decision, and emits restored', () => {
    let state = apply(
      fresh(),
      { type: 'decide', decision: 'interested' },
      { type: 'decide', decision: 'passed' },
    )
    expect(state.cursor).toBe(2)

    const undone = deckTransition(state, { type: 'undo' })
    state = undone.state
    expect(state.cursor).toBe(1)
    expect(activeRecommendation(state)?.recommendationId).toBe('fx-rec-002')
    expect(state.decisions['fx-rec-002']).toBeUndefined()
    expect(state.decisions['fx-rec-001']).toBe('interested')
    expect(undone.signals).toHaveLength(1)
    expect(undone.signals[0]).toMatchObject({ action: 'restored', recommendationId: 'fx-rec-002' })
    expect(state.announcement).toContain('Undo complete.')
    expect(state.announcement).toContain('Opportunity 2 of 6')
  })

  it('undo is repeatable one step at a time back to the first card', () => {
    const state = apply(
      fresh(),
      { type: 'decide', decision: 'priority' },
      { type: 'decide', decision: 'passed' },
      { type: 'undo' },
      { type: 'undo' },
    )
    expect(state.cursor).toBe(0)
    expect(state.decisions).toEqual({})
    expect(state.history).toHaveLength(0)
  })

  it('undo with no history is a no-op and emits nothing', () => {
    const initial = fresh()
    const { state, signals } = deckTransition(initial, { type: 'undo' })
    expect(state).toBe(initial)
    expect(signals).toHaveLength(0)
  })

  it('a card can be re-decided after undo without a duplicate-signal block', () => {
    const state = apply(fresh(), { type: 'decide', decision: 'passed' }, { type: 'undo' })
    const { state: redecided, signals } = deckTransition(state, { type: 'decide', decision: 'interested' })
    expect(redecided.decisions['fx-rec-001']).toBe('interested')
    expect(signals[0]).toMatchObject({ action: 'interested', recommendationId: 'fx-rec-001' })
  })
})

describe('MATCHA deck machine — details', () => {
  it('opening details preserves deck position and emits details_opened once', () => {
    const opened = deckTransition(fresh(), { type: 'open_details' })
    expect(opened.state.cursor).toBe(0)
    expect(opened.state.detailsFor).toBe('fx-rec-001')
    expect(opened.signals[0]).toMatchObject({ action: 'details_opened' })

    const reopened = deckTransition(opened.state, { type: 'open_details' })
    expect(reopened.state).toBe(opened.state)
    expect(reopened.signals).toHaveLength(0)
  })

  it('closing details returns to the same card', () => {
    const state = apply(fresh(), { type: 'open_details' }, { type: 'close_details' })
    expect(state.detailsFor).toBeNull()
    expect(state.cursor).toBe(0)
    expect(state.announcement).toContain('Details closed.')
  })

  it('deciding from the details view closes details and advances', () => {
    const state = apply(fresh(), { type: 'open_details' }, { type: 'decide', decision: 'interested' })
    expect(state.detailsFor).toBeNull()
    expect(state.cursor).toBe(1)
  })
})

describe('MATCHA deck machine — queues and summaries', () => {
  it('interested queue collects interested and priority; passed history collects passes', () => {
    const state = apply(
      fresh(),
      { type: 'decide', decision: 'interested' },
      { type: 'decide', decision: 'passed' },
      { type: 'decide', decision: 'priority' },
    )
    expect(interestedQueue(state).map((r) => r.recommendationId)).toEqual(['fx-rec-001', 'fx-rec-003'])
    expect(passedHistory(state).map((r) => r.recommendationId)).toEqual(['fx-rec-002'])
  })

  it('match summary counts confirmed fits and items needing review without percentages', () => {
    expect(matchSummaryText(FIXTURE_RECOMMENDATIONS[0])).toBe('3 confirmed fits · 1 item needs review')
    expect(matchSummaryText(FIXTURE_RECOMMENDATIONS[3])).toBe('2 confirmed fits · 1 item needs review')
    expect(matchSummaryText(FIXTURE_RECOMMENDATIONS[0])).not.toMatch(/%/)
  })

  it('describeCard announces position, identity, and explainable summary', () => {
    const text = describeCard(FIXTURE_RECOMMENDATIONS, 0)
    expect(text).toBe(
      'Opportunity 1 of 6. Hospitalist at Sample Health System. Strong match. 3 confirmed fits · 1 item needs review.',
    )
  })

  it('viewed signal carries the opportunity version without changing state', () => {
    const initial = fresh()
    const { state, signals } = deckTransition(initial, { type: 'card_viewed' })
    expect(state).toBe(initial)
    expect(signals[0]).toMatchObject({ action: 'viewed', opportunityVersion: 'fx-v1' })
  })
})

describe('MATCHA deck fixtures — visibly test-only', () => {
  it('every fixture is flagged and named as sample data', () => {
    expect(FIXTURE_RECOMMENDATIONS.length).toBeGreaterThanOrEqual(5)
    for (const rec of FIXTURE_RECOMMENDATIONS) {
      expect(rec.isFixture).toBe(true)
      expect(rec.opportunity.employerName).toMatch(/Sample/)
      expect(rec.recommendationId).toMatch(/^fx-/)
      expect(rec.opportunity.opportunityId).toMatch(/^fx-/)
      expect(rec.actions.canApply).toBe(false)
    }
  })

  it('fixture explanations never fabricate certainty — unknowns stay labeled', () => {
    for (const rec of FIXTURE_RECOMMENDATIONS) {
      for (const reason of rec.explanation.unknown) {
        expect(reason.kind).toBe('unknown')
      }
      for (const reason of rec.explanation.confirmed) {
        expect(reason.origin).toBeTruthy()
      }
    }
  })
})

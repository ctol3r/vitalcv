/**
 * PR J2 — the shared decision vocabulary and current-state derivation.
 *
 * The deck and the board are two surfaces over ONE append-only log, so these
 * tests pin the property that makes that safe: a role decided on one surface
 * reads correctly on the other, telemetry never decides anything, and neither
 * lens can ever emit a word its surface cannot render.
 */
import { describe, expect, it } from 'vitest'

import {
  BOARD_DECISION_ACTIONS,
  DECK_DECISION_ACTIONS,
  TELEMETRY_ACTIONS,
  boardStatusFor,
  boardStatuses,
  deckDecisionFor,
  deckDecisions,
  isDecisionAction,
  isSignalAction,
  latestDecisions,
  shouldAudit,
  type SignalRow,
} from '../lib/matcha/opportunitySignals'

/** Rows newest-first, as every caller orders them. */
function log(...rows: Array<[string, string]>): SignalRow[] {
  return rows.map(([opportunityId, action]) => ({ opportunityId, action }))
}

describe('signal vocabulary', () => {
  it('accepts every board, deck, telemetry, and funnel action', () => {
    for (const action of [...BOARD_DECISION_ACTIONS, ...DECK_DECISION_ACTIONS, ...TELEMETRY_ACTIONS]) {
      expect(isSignalAction(action)).toBe(true)
    }
    expect(isSignalAction('application_started')).toBe(true)
    expect(isSignalAction('application_submitted')).toBe(true)
  })

  it('rejects unknown actions rather than letting them into the log', () => {
    for (const bad of ['swiped', 'liked', '', 'INTERESTED', null, undefined, 7, {}]) {
      expect(isSignalAction(bad)).toBe(false)
    }
  })

  it('telemetry is never a decision', () => {
    for (const action of TELEMETRY_ACTIONS) {
      expect(isDecisionAction(action)).toBe(false)
    }
  })

  it('decisions are audited; telemetry is not', () => {
    expect(shouldAudit('interested')).toBe(true)
    expect(shouldAudit('passed')).toBe(true)
    expect(shouldAudit('priority')).toBe(true)
    expect(shouldAudit('restored')).toBe(true)
    expect(shouldAudit('application_submitted')).toBe(true)
    expect(shouldAudit('viewed')).toBe(false)
    expect(shouldAudit('details_opened')).toBe(false)
  })
})

describe('latestDecisions — collapsing the append-only log', () => {
  it('takes the newest decision and ignores older ones', () => {
    const rows = log(['opp-1', 'passed'], ['opp-1', 'interested'])
    expect(latestDecisions(rows)).toEqual({ 'opp-1': 'passed' })
  })

  it('retains a clearing action — "un-saved" and "never touched" are different facts', () => {
    expect(latestDecisions(log(['opp-1', 'restored'], ['opp-1', 'interested']))).toEqual({
      'opp-1': 'restored',
    })
    expect(latestDecisions(log(['opp-1', 'cleared'], ['opp-1', 'saved']))).toEqual({
      'opp-1': 'cleared',
    })
  })

  it('a decision after a clear is live again', () => {
    const rows = log(['opp-1', 'priority'], ['opp-1', 'restored'], ['opp-1', 'passed'])
    expect(latestDecisions(rows)).toEqual({ 'opp-1': 'priority' })
  })

  it('telemetry never decides and never shadows an older decision', () => {
    const rows = log(['opp-1', 'viewed'], ['opp-1', 'details_opened'], ['opp-1', 'interested'])
    expect(latestDecisions(rows)).toEqual({ 'opp-1': 'interested' })
  })

  it('a telemetry-only opportunity has no decision at all', () => {
    expect(latestDecisions(log(['opp-1', 'viewed']))).toEqual({})
  })

  it('unknown actions in the log are ignored, not guessed at', () => {
    const rows = log(['opp-1', 'some_future_action'], ['opp-1', 'interested'])
    expect(latestDecisions(rows)).toEqual({ 'opp-1': 'interested' })
  })

  it('tracks opportunities independently', () => {
    const rows = log(['opp-2', 'passed'], ['opp-1', 'interested'], ['opp-3', 'viewed'])
    expect(latestDecisions(rows)).toEqual({ 'opp-1': 'interested', 'opp-2': 'passed' })
  })
})

describe('lenses — one decision, read by each surface', () => {
  it('the board sees deck interest as a save and a pass as a decline', () => {
    expect(boardStatusFor('interested')).toBe('saved')
    expect(boardStatusFor('priority')).toBe('saved')
    expect(boardStatusFor('passed')).toBe('declined')
  })

  it('the deck sees a board save or connect as interested, a decline as passed', () => {
    expect(deckDecisionFor('saved')).toBe('interested')
    expect(deckDecisionFor('connected')).toBe('interested')
    expect(deckDecisionFor('declined')).toBe('passed')
  })

  it('priority survives the deck lens — the board has no word for it', () => {
    expect(deckDecisionFor('priority')).toBe('priority')
    expect(boardStatusFor('priority')).toBe('saved')
  })

  it('the board lens NEVER emits a word the board cannot render', () => {
    const renderable = ['saved', 'connected', 'declined', 'cleared']
    for (const action of [...BOARD_DECISION_ACTIONS, ...DECK_DECISION_ACTIONS]) {
      for (const status of Object.values(boardStatuses(log(['opp-1', action])))) {
        expect(renderable).toContain(status)
      }
    }
  })

  it('the deck lens never emits a word the deck cannot render', () => {
    const renderable = ['interested', 'priority', 'passed']
    for (const action of [...BOARD_DECISION_ACTIONS, ...DECK_DECISION_ACTIONS]) {
      const decision = deckDecisionFor(action)
      if (decision !== null) expect(renderable).toContain(decision)
    }
  })

  it('clearing actions resolve to no status on either lens', () => {
    expect(boardStatusFor('cleared')).toBeNull()
    expect(boardStatusFor('restored')).toBeNull()
    expect(deckDecisionFor('cleared')).toBeNull()
    expect(deckDecisionFor('restored')).toBeNull()
  })
})

describe('cross-surface continuity — the reason there is one log', () => {
  it('a role saved on the board is already interested in the deck', () => {
    expect(deckDecisions(log(['opp-1', 'saved']))).toEqual({ 'opp-1': 'interested' })
  })

  it('a role swiped interested in the deck shows as saved on the board', () => {
    expect(boardStatuses(log(['opp-1', 'interested']))).toEqual({ 'opp-1': 'saved' })
  })

  it('a deck pass shows as declined on the board', () => {
    expect(boardStatuses(log(['opp-1', 'passed']))).toEqual({ 'opp-1': 'declined' })
  })

  it('undoing a deck decision clears it on the board too', () => {
    // 'cleared', not omitted: the board client deletes its local entry on this
    // value, which is how un-saving reaches the clinician's other devices.
    expect(boardStatuses(log(['opp-1', 'restored'], ['opp-1', 'passed']))).toEqual({
      'opp-1': 'cleared',
    })
  })

  it('an undone deck decision is undecided again, so the deck may re-show it', () => {
    expect(deckDecisions(log(['opp-1', 'restored'], ['opp-1', 'passed']))).toEqual({})
  })

  it('clearing on the board still instructs other devices to drop the entry (regression)', () => {
    // The board's mergeServerActions deletes a local entry when the server
    // says 'cleared'. Omitting cleared opportunities would strand a stale
    // "saved" on every other device forever.
    expect(boardStatuses(log(['opp-1', 'cleared'], ['opp-1', 'saved']))).toEqual({
      'opp-1': 'cleared',
    })
  })

  it('deck telemetry never appears in the board state', () => {
    const rows = log(['opp-1', 'viewed'], ['opp-2', 'details_opened'])
    expect(boardStatuses(rows)).toEqual({})
  })

  it('the board never receives a bucket it has no label for (regression)', () => {
    // Before J2 the board cast `action` straight through, so a deck row would
    // have produced statusCounts['interested'] → NaN and BUCKET_LABEL → undefined.
    const rows = log(['opp-1', 'interested'], ['opp-2', 'priority'], ['opp-3', 'viewed'])
    for (const status of Object.values(boardStatuses(rows))) {
      expect(['saved', 'connected', 'declined']).toContain(status)
    }
  })
})

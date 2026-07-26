/**
 * MATCHA Deck state machine — a pure transition function.
 *
 * All deck behavior that must be exactly right lives here, framework-free:
 * decision handling, one-step undo restoring the exact card and state,
 * idempotency (a card already decided cannot be decided again without an
 * undo), details open/close preserving deck position, and screen-reader
 * announcement text. Animation and persistence live outside.
 *
 * deckTransition returns the next state plus the signals produced by this
 * transition, exactly once per user intent — a no-op transition returns the
 * same state reference and an empty signal list, so replayed events (e.g. a
 * stale animation callback) can never emit duplicate signals.
 */

import type { DeckDecision, DeckRecommendation, DeckSignal } from './types'

export interface DeckHistoryEntry {
  cursor: number
  recommendationId: string
  decision: DeckDecision
}

export interface DeckState {
  recommendations: DeckRecommendation[]
  /** Index of the active card. cursor === recommendations.length ⇒ end of deck. */
  cursor: number
  /** Decision by recommendationId. Only one live decision per card. */
  decisions: Record<string, DeckDecision>
  /** Undo stack, most recent last. Undo is one-step but repeatable. */
  history: DeckHistoryEntry[]
  /** recommendationId whose details are expanded, or null. */
  detailsFor: string | null
  /** Screen-reader announcement; seq bumps so identical text re-announces. */
  announcement: string
  announcementSeq: number
}

export type DeckEvent =
  | { type: 'decide'; decision: DeckDecision }
  | { type: 'undo' }
  | { type: 'open_details' }
  | { type: 'close_details' }
  | { type: 'card_viewed' }

export interface DeckTransitionResult {
  state: DeckState
  signals: DeckSignal[]
}

export function createDeckState(recommendations: DeckRecommendation[]): DeckState {
  return {
    recommendations,
    cursor: 0,
    decisions: {},
    history: [],
    detailsFor: null,
    announcement:
      recommendations.length > 0
        ? describeCard(recommendations, 0)
        : 'No opportunities to review right now.',
    announcementSeq: 0,
  }
}

export function activeRecommendation(state: DeckState): DeckRecommendation | null {
  return state.recommendations[state.cursor] ?? null
}

export function isDeckExhausted(state: DeckState): boolean {
  return state.cursor >= state.recommendations.length
}

export function interestedQueue(state: DeckState): DeckRecommendation[] {
  return state.recommendations.filter((r) => {
    const decision = state.decisions[r.recommendationId]
    return decision === 'interested' || decision === 'priority'
  })
}

export function passedHistory(state: DeckState): DeckRecommendation[] {
  return state.recommendations.filter((r) => state.decisions[r.recommendationId] === 'passed')
}

const OVERALL_LABEL_TEXT: Record<DeckRecommendation['explanation']['overallLabel'], string> = {
  strong: 'Strong match',
  promising: 'Promising match',
  possible: 'Possible match',
  limited: 'Limited match',
}

export function overallLabelText(rec: DeckRecommendation): string {
  return OVERALL_LABEL_TEXT[rec.explanation.overallLabel]
}

export function matchSummaryText(rec: DeckRecommendation): string {
  const confirmed = rec.explanation.confirmed.length
  const review = rec.explanation.needsReview.length + rec.explanation.blockers.length
  const parts: string[] = []
  parts.push(`${confirmed} confirmed ${confirmed === 1 ? 'fit' : 'fits'}`)
  if (review > 0) parts.push(`${review} ${review === 1 ? 'item needs' : 'items need'} review`)
  return parts.join(' · ')
}

export function describeCard(recommendations: DeckRecommendation[], cursor: number): string {
  const rec = recommendations[cursor]
  if (!rec) return 'You are caught up. No more opportunities in this deck.'
  const { opportunity } = rec
  const position = `Opportunity ${cursor + 1} of ${recommendations.length}.`
  const identity = `${opportunity.title} at ${opportunity.employerName}.`
  return `${position} ${identity} ${overallLabelText(rec)}. ${matchSummaryText(rec)}.`
}

const DECISION_ANNOUNCEMENT: Record<DeckDecision, string> = {
  interested: 'Saved as Interested.',
  priority: 'Saved as Priority.',
  passed: 'Passed.',
}

function withAnnouncement(state: DeckState, text: string): DeckState {
  return { ...state, announcement: text, announcementSeq: state.announcementSeq + 1 }
}

function noop(state: DeckState): DeckTransitionResult {
  return { state, signals: [] }
}

export function deckTransition(state: DeckState, event: DeckEvent): DeckTransitionResult {
  switch (event.type) {
    case 'decide': {
      const rec = activeRecommendation(state)
      // No active card, or the card was already decided (e.g. a duplicate
      // commit fired during the exit animation): ignore, emit nothing.
      if (!rec || state.decisions[rec.recommendationId]) return noop(state)
      if (
        (event.decision === 'interested' || event.decision === 'priority') &&
        !rec.actions.canExpressInterest
      ) {
        return {
          state: withAnnouncement(state, 'Interest is not available for this listing.'),
          signals: [],
        }
      }
      const nextCursor = state.cursor + 1
      const nextText =
        nextCursor >= state.recommendations.length
          ? `${DECISION_ANNOUNCEMENT[event.decision]} You are caught up.`
          : `${DECISION_ANNOUNCEMENT[event.decision]} Next opportunity loaded. ${describeCard(state.recommendations, nextCursor)}`
      return {
        state: withAnnouncement(
          {
            ...state,
            cursor: nextCursor,
            decisions: { ...state.decisions, [rec.recommendationId]: event.decision },
            history: [
              ...state.history,
              { cursor: state.cursor, recommendationId: rec.recommendationId, decision: event.decision },
            ],
            detailsFor: null,
          },
          nextText,
        ),
        signals: [signal(event.decision, rec)],
      }
    }
    case 'undo': {
      const last = state.history[state.history.length - 1]
      if (!last) return noop(state)
      const decisions = { ...state.decisions }
      delete decisions[last.recommendationId]
      const restored = state.recommendations[last.cursor]
      return {
        state: withAnnouncement(
          {
            ...state,
            cursor: last.cursor,
            decisions,
            history: state.history.slice(0, -1),
            detailsFor: null,
          },
          `Undo complete. ${restored ? describeCard(state.recommendations, last.cursor) : ''}`.trim(),
        ),
        signals: restored ? [signal('restored', restored)] : [],
      }
    }
    case 'open_details': {
      const rec = activeRecommendation(state)
      if (!rec || state.detailsFor === rec.recommendationId) return noop(state)
      return {
        state: withAnnouncement(
          { ...state, detailsFor: rec.recommendationId },
          `Details expanded for ${rec.opportunity.title} at ${rec.opportunity.employerName}.`,
        ),
        signals: [signal('details_opened', rec)],
      }
    }
    case 'close_details': {
      if (!state.detailsFor) return noop(state)
      return {
        state: withAnnouncement(
          { ...state, detailsFor: null },
          `Details closed. ${describeCard(state.recommendations, state.cursor)}`,
        ),
        signals: [],
      }
    }
    case 'card_viewed': {
      const rec = activeRecommendation(state)
      if (!rec) return noop(state)
      return { state, signals: [signal('viewed', rec)] }
    }
    default:
      return noop(state)
  }
}

function signal(action: DeckSignal['action'], rec: DeckRecommendation): DeckSignal {
  return {
    action,
    recommendationId: rec.recommendationId,
    opportunityId: rec.opportunity.opportunityId,
    opportunityVersion: rec.opportunityVersion,
  }
}

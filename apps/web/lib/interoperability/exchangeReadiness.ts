/**
 * Exchange Readiness taxonomy for institutional trust-evidence
 * handoff. Seven closed canonical states; every state maps onto the
 * existing degradation grammar from
 * `apps/web/lib/trust/degradation.ts`.
 *
 * Semantics (binding):
 *  - Readiness describes the institutional workflow stage of an
 *    evidence handoff, NOT the credential's underlying truth value.
 *  - `institution_confirmed` does NOT imply VitalCV-side acceptance;
 *    the receiving institution owns the confirmation.
 *  - `exchange_interrupted` is a hard-interruption state; it never
 *    softens silently into a "continuity gap" without operator action.
 */

import {
  type DegradationState,
  type DegradationVisual,
  visualForDegradation,
} from '@/lib/trust/degradation';

export type ExchangeReadinessState =
  | 'replay_generated'
  | 'awaiting_review'
  | 'cross_check_available'
  | 'continuity_gap'
  | 'institution_confirmed'
  | 'operator_followup_required'
  | 'exchange_interrupted';

export interface ExchangeReadinessDescriptor {
  readonly state: ExchangeReadinessState;
  /** Plain-English headline rendered on the readiness chip. */
  readonly headline: string;
  /** Operationally precise detail line; never marketing copy. */
  readonly detail: string;
  /**
   * Canonical degradation state this readiness reuses. Drives the
   * border / continuity / hard-interruption visual treatment.
   */
  readonly degradation: DegradationState;
  /** Who owns the next operational step. */
  readonly ownedBy: 'originating_institution' | 'receiving_institution' | 'vitalcv' | 'shared';
  /** Whether this is a terminal state for the handoff. */
  readonly terminal: boolean;
}

const DESCRIPTORS: Record<ExchangeReadinessState, ExchangeReadinessDescriptor> = {
  replay_generated: {
    state: 'replay_generated',
    headline: 'Replay generated',
    detail:
      'Originating institution produced a replay bundle for the cohort window. Bundle is portable but not yet under review.',
    degradation: 'fresh',
    ownedBy: 'originating_institution',
    terminal: false,
  },
  awaiting_review: {
    state: 'awaiting_review',
    headline: 'Awaiting institution review',
    detail:
      'Bundle delivered to the receiving institution. Review is institution-owned and not yet started.',
    degradation: 'pending_human_review',
    ownedBy: 'receiving_institution',
    terminal: false,
  },
  cross_check_available: {
    state: 'cross_check_available',
    headline: 'Cross-check available',
    detail:
      'Source references are populated and replay references are anchored. Receiving institution MAY initiate an independent cross-check.',
    degradation: 'fresh',
    ownedBy: 'receiving_institution',
    terminal: false,
  },
  continuity_gap: {
    state: 'continuity_gap',
    headline: 'Continuity gap',
    detail:
      'At least one lane in the bundle has a recorded gap. Continuity is not currently established end-to-end.',
    degradation: 'interrupted',
    ownedBy: 'shared',
    terminal: false,
  },
  institution_confirmed: {
    state: 'institution_confirmed',
    headline: 'Institution-confirmed',
    detail:
      'Receiving institution has independently reviewed the bundle and recorded its confirmation. This does not imply VitalCV-side acceptance.',
    degradation: 'fresh',
    ownedBy: 'receiving_institution',
    terminal: true,
  },
  operator_followup_required: {
    state: 'operator_followup_required',
    headline: 'Operator follow-up required',
    detail:
      'Bundle requires human-reviewed disposition before the exchange can advance.',
    degradation: 'pending_human_review',
    ownedBy: 'vitalcv',
    terminal: false,
  },
  exchange_interrupted: {
    state: 'exchange_interrupted',
    headline: 'Exchange interrupted',
    detail:
      'Hard interruption -- continuity cannot be restored without a new replay bundle or an institution-owned recovery step.',
    degradation: 'continuity_mismatch',
    ownedBy: 'shared',
    terminal: true,
  },
};

export function describeExchangeReadiness(
  state: ExchangeReadinessState,
): ExchangeReadinessDescriptor {
  return DESCRIPTORS[state];
}

export function listExchangeReadinessStates(): readonly ExchangeReadinessState[] {
  return [
    'replay_generated',
    'awaiting_review',
    'cross_check_available',
    'continuity_gap',
    'institution_confirmed',
    'operator_followup_required',
    'exchange_interrupted',
  ];
}

/**
 * Convenience: returns the visual grammar token (continuous / dashed
 * / hard_interruption / manual_lane / pending_anchor) the UI should
 * render for a given readiness state. Reuses canonical mapping.
 */
export function visualForExchangeReadiness(
  state: ExchangeReadinessState,
): DegradationVisual {
  return visualForDegradation(describeExchangeReadiness(state).degradation);
}

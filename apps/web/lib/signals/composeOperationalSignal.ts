/**
 * Translates the operator dashboard snapshot (and similar substrate
 * signals) into the user-facing operational signal vocabulary. Pure
 * function: no fetch, no I/O. Used by /ops and /holder to emit a
 * single PrimaryOperationalSignal at the top of the page.
 *
 * Mapping rules:
 *   - any critical alert         -> attention_needed
 *   - any warning alert          -> requires_followup
 *   - doctrine honesty < 7/7     -> requires_followup
 *   - degraded total > 0         -> requires_followup
 *   - last verified recently     -> recently_reviewed
 *   - everything else healthy    -> confirmed
 *   - missing fields             -> pending
 */
import type { OperationalSignalState } from '@/components/signals/PrimaryOperationalSignal';
import type { QuietStatusEntry } from '@/components/signals/QuietStatusStrip';
import type { AttentionItem } from '@/components/signals/AttentionRequiredPanel';

export interface OperationalSignalInputs {
  readonly criticalAlerts: number;
  readonly warningAlerts: number;
  readonly doctrineHonestyScore: number;
  readonly doctrineHonestyTotal: number;
  readonly degradedTotal: number;
  readonly verifierContinuityOperational: boolean;
  readonly issuanceComplete: boolean;
  readonly identityResolves: boolean;
}

export interface OperationalSignalResult {
  readonly state: OperationalSignalState;
  readonly headline: string;
  readonly summary: string;
  readonly stripEntries: readonly QuietStatusEntry[];
  readonly attentionItems: readonly AttentionItem[];
}

export function composeOperationalSignal(
  inputs: OperationalSignalInputs,
): OperationalSignalResult {
  const attentionItems: AttentionItem[] = [];
  let state: OperationalSignalState = 'confirmed';

  if (inputs.criticalAlerts > 0) {
    state = 'attention_needed';
    attentionItems.push({
      id: 'critical-alert',
      what: `${inputs.criticalAlerts} critical alert${inputs.criticalAlerts === 1 ? '' : 's'} present`,
      nextStep: 'Open the operator detail section to read the alert text.',
    });
  } else if (inputs.warningAlerts > 0) {
    state = 'requires_followup';
    attentionItems.push({
      id: 'warning-alert',
      what: `${inputs.warningAlerts} warning${inputs.warningAlerts === 1 ? '' : 's'} pending`,
      nextStep: 'Open the operator detail section to read the warning text.',
    });
  } else if (
    inputs.doctrineHonestyTotal > 0 &&
    inputs.doctrineHonestyScore < inputs.doctrineHonestyTotal
  ) {
    state = 'requires_followup';
    attentionItems.push({
      id: 'doctrine-honesty',
      what: 'One or more operational invariants is partial.',
      nextStep:
        'Open the operator detail section to inspect which invariant requires follow-up.',
    });
  } else if (inputs.degradedTotal > 0) {
    state = 'requires_followup';
    attentionItems.push({
      id: 'degraded-sources',
      what: `${inputs.degradedTotal} source${inputs.degradedTotal === 1 ? ' is' : 's are'} in a degraded state.`,
      nextStep:
        'Open the operator detail section to see which sources are degraded.',
    });
  } else if (!inputs.identityResolves) {
    state = 'pending';
  } else {
    state = 'confirmed';
  }

  // Note: the compositor never emits 'recently_reviewed'. That state
  // is reserved for surfaces that know they were recently reviewed
  // (e.g. /holder uses it as a literal prop). The substrate-derived
  // signal here resolves to one of the other four states.
  let headline: string;
  let summary: string;
  switch (state) {
    case 'confirmed':
      headline = 'Operations are confirmed on the current substrate.';
      summary =
        'No attention items, no degraded sources, no warnings. Open the operator detail section to inspect the underlying substrate.';
      break;
    case 'pending':
      headline = 'Operations are still resolving.';
      summary =
        'Resolution is in flight. Operator detail will populate once the substrate completes its first read.';
      break;
    case 'requires_followup':
      headline = 'One or more items require follow-up.';
      summary =
        'See the attention section below for what needs follow-up. The operator detail section preserves the underlying technical surface.';
      break;
    case 'attention_needed':
      headline = 'One or more items require attention.';
      summary =
        'See the attention section below for what needs follow-up. The operator detail section preserves the underlying technical surface.';
      break;
  }

  const stripEntries: QuietStatusEntry[] = [
    {
      id: 'identity',
      axis: 'Identity',
      state: inputs.identityResolves ? 'confirmed' : 'pending',
    },
    {
      id: 'verifier',
      axis: 'Verifier continuity',
      state: inputs.verifierContinuityOperational ? 'confirmed' : 'pending',
    },
    {
      id: 'issuance',
      axis: 'Issuance',
      state: inputs.issuanceComplete ? 'confirmed' : 'pending',
    },
    {
      id: 'sources',
      axis: 'Source health',
      state: inputs.degradedTotal === 0 ? 'confirmed' : 'requires_followup',
    },
    {
      id: 'invariants',
      axis: 'Invariants',
      state:
        inputs.doctrineHonestyTotal === 0 ||
        inputs.doctrineHonestyScore === inputs.doctrineHonestyTotal
          ? 'confirmed'
          : 'requires_followup',
    },
    {
      id: 'alerts',
      axis: 'Alerts',
      state:
        inputs.criticalAlerts > 0
          ? 'attention_needed'
          : inputs.warningAlerts > 0
            ? 'requires_followup'
            : 'confirmed',
    },
  ];

  return { state, headline, summary, stripEntries, attentionItems };
}

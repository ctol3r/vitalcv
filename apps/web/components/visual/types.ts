/**
 * VitalCV visual-system shared types.
 *
 * Truth states are the canonical eight from zenlike-ui-doctrine §6
 * (with the prototype's per-state token naming). The TruthChip
 * component enforces "never bare" — every state must carry a source
 * label so the wrong rendering is a TypeScript error.
 */

export type TruthState =
  | 'source-backed'      // primary source agrees; healthy
  | 'pending-source'     // queued or retrying
  | 'source-unavailable' // 5xx / outage — system fault, not clinician
  | 'self-reported'      // clinician-asserted, not yet source-backed
  | 'review-needed'      // institution-gated; outside VitalCV's read scope
  | 'sanction'           // adverse — surfaced verbatim
  | 'contradicted'       // two sources disagree
  | 'not-asserted';      // no source has been asked; gray, not red

export const TRUTH_STATE_LABEL: Record<TruthState, string> = {
  'source-backed': 'Source-backed',
  'pending-source': 'Pending source',
  'source-unavailable': 'Source unavailable',
  'self-reported': 'Self-reported',
  'review-needed': 'Institution must review',
  sanction: 'Sanction recorded',
  contradicted: 'Sources disagree',
  'not-asserted': 'Not asserted',
};

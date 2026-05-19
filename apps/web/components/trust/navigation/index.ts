/**
 * Canonical provenance navigation primitives.
 *
 * Builds on the Stacked Provenance Ledger (PR #385) by adding the
 * navigation-layer primitives that every pane in every surface must
 * share. The navigation contract is in
 * `apps/web/lib/trust/navigation-contract.ts`.
 */

export { ProvenancePaneHeader } from './ProvenancePaneHeader';
export type { ProvenancePaneHeaderProps } from './ProvenancePaneHeader';

export { ProvenancePaneMeta } from './ProvenancePaneMeta';
export type { ProvenancePaneMetaProps } from './ProvenancePaneMeta';

export { ProvenanceChronology } from './ProvenanceChronology';
export type {
  ProvenanceChronologyInput,
  ProvenanceChronologyProps,
} from './ProvenanceChronology';

export { ProvenanceBinding } from './ProvenanceBinding';
export type { ProvenanceBindingProps } from './ProvenanceBinding';

export { ProvenanceTrail } from './ProvenanceTrail';
export type { ProvenanceTrailProps } from './ProvenanceTrail';

export { ReplayRunStamp } from './ReplayRunStamp';
export type { ReplayRunStampProps } from './ReplayRunStamp';

export { EntityBindingSummary } from './EntityBindingSummary';
export type { EntityBindingSummaryProps } from './EntityBindingSummary';

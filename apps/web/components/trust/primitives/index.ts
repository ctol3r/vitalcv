/**
 * Canonical institutional trust primitives.
 *
 * Source archive: `Dropbox/vitalcv (7)/`. Forensic map:
 * `docs/design/institutional-trust-primitive-map.md`.
 *
 * Reading order (binding):
 *   OBJECT → OWNERSHIP → checked_at → CHANNEL → REPLAY → run_id
 */

export { LineageHeader } from './LineageHeader';
export type { LineageHeaderProps } from './LineageHeader';

export { LineageRow } from './LineageRow';
export type { LineageRowProps } from './LineageRow';

export { TrustReceipt } from './TrustReceipt';
export type { TrustReceiptProps } from './TrustReceipt';

export { ReplayTimeline } from './ReplayTimeline';
export type { ReplayNode, ReplayTimelineProps } from './ReplayTimeline';

export { DegradedStatePanel } from './DegradedStatePanel';
export type { DegradedStatePanelProps } from './DegradedStatePanel';

export { FailureTaxonomyBadge } from './FailureTaxonomyBadge';
export type { FailureTaxonomyBadgeProps } from './FailureTaxonomyBadge';

export { OwnershipStateBadge } from './OwnershipStateBadge';
export type { OwnershipStateBadgeProps } from './OwnershipStateBadge';

export { TierBadge } from './TierBadge';
export type { TierBadgeProps } from './TierBadge';

export { CheckedAtStamp } from './CheckedAtStamp';
export type { CheckedAtStampProps } from './CheckedAtStamp';

export { HumanReviewLane } from './HumanReviewLane';
export type { HumanReviewLaneProps } from './HumanReviewLane';

export { RevocationStateBanner } from './RevocationStateBanner';
export type { RevocationStateBannerProps } from './RevocationStateBanner';

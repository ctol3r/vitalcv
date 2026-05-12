/**
 * Canonical trust primitives (Lane B).
 *
 * Single import point for every institutional trust surface. Adoption
 * lands in Lane C; this barrel exists so adopters can use one import:
 *
 *   import {
 *     TrustHeader, ReplayLineage, TierBadge, OwnershipState,
 *     DegradedStateBanner, IssuerAttribution, CheckedAtStamp,
 *     RunIdentity, TrustStateBand,
 *   } from '@/components/trust';
 *
 * Mandatory institutional render order (enforced by `<TrustHeader>`):
 *   OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
 *
 * Degraded-state taxonomy (rendered by `<DegradedStateBanner>`):
 *   A = source unreachable
 *   B = anonymous restriction
 *   C = infrastructure outage
 *   D = no adverse findings   ← renders as SUCCESS, not warning
 *   E = issuer unavailable
 */
export { CheckedAtStamp, type CheckedAtStampProps, type CheckedAtFormat } from './CheckedAtStamp';
export { RunIdentity, type RunIdentityProps } from './RunIdentity';
export {
  TierBadge,
  type TierBadgeProps,
  type TierBadgeKind,
  type TierBadgeSize,
  type TierValue,
  type TierSpecialState,
} from './TierBadge';
export {
  TrustStateBand,
  type TrustStateBandProps,
  type TrustStateBandValue,
} from './TrustStateBand';
export {
  OwnershipState,
  type OwnershipStateProps,
  type OwnershipStateValue,
} from './OwnershipState';
export {
  DegradedStateBanner,
  type DegradedStateBannerProps,
  type DegradedStateCode,
} from './DegradedStateBanner';
export {
  IssuerAttribution,
  type IssuerAttributionProps,
  type IssuerContinuity,
} from './IssuerAttribution';
export {
  ReplayLineage,
  type ReplayLineageProps,
  type ReplayLineagePriorCheck,
  type ReplayLineageGap,
} from './ReplayLineage';
export {
  TrustHeader,
  type TrustHeaderProps,
  type TrustHeaderVariant,
  type TrustHeaderObject,
  type TrustHeaderOwnership,
  type TrustHeaderReplay,
} from './TrustHeader';
export {
  RecentNpis,
  type RecentNpisProps,
} from './RecentNpis';

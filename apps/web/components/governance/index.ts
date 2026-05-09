/**
 * Shared governance UI primitives.
 *
 * Per W2-PR19A target 6: shared governance UI primitives derived ONLY from
 * @vitalcv/governance-runtime registry; fail-closed; degraded-aware;
 * ambiguity-visible.
 */

export { IntegrityBadge, type IntegrityBadgeProps } from "./IntegrityBadge";
export { TrustClassBadge, type TrustClassBadgeProps } from "./TrustClassBadge";
export { ReplayWarning, type ReplayWarningProps } from "./ReplayWarning";
export { UnknownStateBanner, type UnknownStateBannerProps } from "./UnknownStateBanner";
export { OverrideBanner, type OverrideBannerProps } from "./OverrideBanner";
export {
  InstitutionalMemoryPanel,
  type InstitutionalMemoryPanelProps,
} from "./InstitutionalMemoryPanel";
export {
  LedgerIntegrityBanner,
  type LedgerIntegrityBannerProps,
} from "./LedgerIntegrityBanner";
export {
  ReplaySurvivabilityPanel,
  type ReplaySurvivabilityPanelProps,
} from "./ReplaySurvivabilityPanel";
export { IncidentBanner, type IncidentBannerProps } from "./IncidentBanner";

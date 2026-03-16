/**
 * intelligence-ops/primitives — backward-compat re-exports from VDS.
 *
 * All product UI primitives now live in @/components/vds/primitives.
 * This file re-exports under the old names so existing surface files
 * continue to compile without changes.
 *
 * NEW CODE SHOULD IMPORT DIRECTLY FROM @/components/vds/primitives.
 */

export {
  // Types
  type BadgeTone,

  // Tone helpers
  severityTone,
  riskScoreColor,
  trustScoreColor,

  // Components (aliased to old names)
  VBadge as OpsBadge,
  VCard as OpsCard,
  VCardSkeleton as OpsCardSkeleton,
  VBanner as SurfaceBanner,
  VEmptyState as SurfaceEmptyState,
  VErrorState as SurfaceErrorState,
  VTimestamp as TimestampPair,
  VBackLink as BackLink,
  VEntityLink as EntityLink,
  VBadgeLink as BadgeLink,
  VPaginationControls as PaginationControls,
  ConfidenceMeter,
} from '@/components/vds/primitives';

/**
 * @vitalcv/web · components/vds/confidence
 *
 * Categorical confidence vocabulary primitives, plus the canonical doctrine.
 *
 * Sibling primitives (NOT re-exported here; import directly):
 *   - components/ui/ConfidenceMeter.tsx (numeric 0-1 score)
 *   - components/ui/confidence-score.tsx (score display)
 *
 * Use this module's primitives for evidence-grade rendering on passport,
 * employer, dossier, file detail, inbox, and any surface where a value's
 * provenance is the question. Use the scored primitives for AI-derived
 * inference confidence (intelligence / risk surfaces).
 */

// Doctrine — the law.
export {
  CONFIDENCE_TIER_META,
  CONFIDENCE_TIER_ORDER,
  CONFIDENCE_TIER_SHORT,
  confidenceDoctrineNarrative,
  isConfidenceTier,
  type ConfidenceTier,
} from './doctrine';

// Re-export the canonical badge from the design system so callers can do
// `import { ConfidenceTierBadge, ConfidenceLegend } from '@/components/vds/confidence'`.
export {
  ConfidenceTierBadge,
  type ConfidenceTierBadgeProps,
} from '@/design-system/components/ConfidenceTierBadge';

// v2 additions live here.
export {
  ConfidenceLegend,
  type ConfidenceLegendProps,
} from './ConfidenceLegend';

export {
  ConfidenceFieldHelp,
  type ConfidenceFieldHelpProps,
} from './ConfidenceFieldHelp';

export {
  UnknownFieldExplainer,
  type UnknownFieldExplainerProps,
} from './UnknownFieldExplainer';

// Resolver lives under lib/ to keep components free of business logic.
// Re-exported here for convenience.
export {
  KNOWN_PRIMARY_SOURCES,
  resolveConfidenceTier,
  useConfidenceTier,
  type ConfidenceFieldMetadata,
  type FieldRecallKind,
} from '@/lib/confidence/tier-resolver';

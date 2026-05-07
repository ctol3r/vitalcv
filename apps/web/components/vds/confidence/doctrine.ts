/**
 * Confidence Doctrine v2 — single source of truth for the categorical
 * field-level confidence vocabulary.
 *
 * Decision tree:
 *   if value is from a primary-source registry the system queried directly → verified
 *   else if value is AI-derived from a clinician-supplied document or third-party feed → inferred
 *   else if data is not on file → unknown   (neutral signal, NOT negative)
 *   else if two authoritative sources disagree → contradicted
 *
 * There are exactly four tiers. A 5th tier is a recall-scope problem, not a
 * doctrine change. The tier name `Verified` rendered inside ConfidenceTierBadge
 * is the tier label, not a pipeline status. Pipeline lane state uses `Checked`.
 *
 * Sibling primitives:
 *   - components/ui/ConfidenceMeter.tsx  — numeric 0-1 score variant
 *   - components/ui/confidence-score.tsx — score display
 *   - design-system/components/ConfidenceTierBadge.tsx — categorical badge
 *
 * The categorical model (this file) applies to evidence-grade rendering
 * (passport / employer / dossier). The scored model applies to AI-derived
 * inference confidence (intelligence / risk surfaces). Both ship; do not
 * collapse them.
 */

import {
  CONFIDENCE_TIER_META,
  type ConfidenceTier,
} from '@/design-system/components/ConfidenceTierBadge';

export const CONFIDENCE_TIER_ORDER: readonly ConfidenceTier[] = [
  'verified',
  'inferred',
  'unknown',
  'contradicted',
] as const;

/**
 * Plain-English narrative form of the decision tree above.
 *
 * Bundled at module load — help components MUST NOT fetch this at runtime.
 * Surfaces, docs pages, and Wave 37's reconciliation drawer read this string
 * verbatim. Treat as authoritative.
 */
export const confidenceDoctrineNarrative =
  'If the value is from a primary-source registry the system queried directly, it is verified. ' +
  'Otherwise, if the value is AI-derived from a clinician-supplied document or third-party feed, it is inferred. ' +
  'Otherwise, if data is not on file, it is unknown — this is a neutral signal, not a negative one. ' +
  'Otherwise, if two authoritative sources disagree, it is contradicted and requires human reconciliation.';

/**
 * Short per-tier hooks. Use these as inline footnotes; descriptions on
 * `CONFIDENCE_TIER_META` are longer and live in tooltips/popovers.
 */
export const CONFIDENCE_TIER_SHORT: Record<ConfidenceTier, string> = {
  verified: 'Primary-source registry.',
  inferred: 'AI-derived from clinician-supplied document.',
  unknown: 'Data not on file. Neutral signal.',
  contradicted: 'Authoritative sources disagree.',
};

/**
 * Asserts a runtime value is a valid tier. Use at adapter / API boundaries
 * where you parse JSON that claims to carry a tier.
 */
export function isConfidenceTier(value: unknown): value is ConfidenceTier {
  return (
    value === 'verified' ||
    value === 'inferred' ||
    value === 'unknown' ||
    value === 'contradicted'
  );
}

export { CONFIDENCE_TIER_META };
export type { ConfidenceTier };

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TruthStateLegend } from '@/design-system/components/TruthStateLegend';

/**
 * PassportTruthStateBanner — the calm degraded-state header for the Passport
 * surface, plus the canonical 5-row TruthStateLegend, plus the
 * institution-review boundary panel.
 *
 * Mount this near the top of `apps/web/app/passport/page.tsx` (above the
 * active SSE-stream UI). It is intentionally additive — it does not replace
 * any existing chip or row rendering; it sits as a calm chrome layer so the
 * unauthenticated visitor sees the vocabulary key + the system-condition
 * disclosure + the review boundary before they scroll into source rows.
 *
 * Truth-contract guarantees (enforced by `apps/web/__tests__/passport-
 * truth-state-banner.test.tsx`):
 *
 *  - The degraded header surfaces only when the call site says the system
 *    is in a degraded condition. **It never claims a finding about the
 *    clinician.** The literal copy is the contract.
 *  - The institution-review panel makes the boundary explicit:
 *    "This view is a reviewer-ready head start, not a final credentialing
 *    decision."
 *  - No bare "Verified", no "automatically verified", no "guaranteed",
 *    no "complete credentialing", no "HIPAA / SOC2 / NCQA" claims.
 *  - No skeleton-style placeholders. Terminal degraded state renders this
 *    calm surface directly; nothing pretends to keep loading.
 */

export interface PassportTruthStateBannerProps {
  /**
   * When true, render the "Source temporarily unavailable" header above the
   * legend. Use only when the system has classified the read as a system
   * condition (e.g. no NPPES payload returned, lane connectivity gated).
   * Default `false` — most active Passport renders do not need it.
   */
  degraded?: boolean;
  /**
   * Optional override for the degraded header headline. Caller is
   * responsible for copy review.
   */
  degradedHeadline?: string;
  /**
   * Optional override for the degraded explanatory copy. Caller is
   * responsible for copy review.
   */
  degradedSubcopy?: string;
  /**
   * When true (default), render the institution-review boundary panel
   * below the legend. Set to `false` only when the parent already surfaces
   * the boundary copy elsewhere on the page.
   */
  showInstitutionReviewPanel?: boolean;
  /**
   * Optional override for the institution-review boundary copy. Caller
   * is responsible for copy review.
   */
  institutionReviewCopy?: string;
  /**
   * Optional className for the outer wrapper.
   */
  className?: string;
}

export const DEFAULT_DEGRADED_HEADLINE = 'Source temporarily unavailable.';
export const DEFAULT_DEGRADED_SUBCOPY =
  'This is a system condition, not a finding about the clinician.';
export const DEFAULT_INSTITUTION_REVIEW_COPY =
  'This view is a reviewer-ready head start, not a final credentialing decision.';

/**
 * The calm Passport truth-state banner. Composes:
 *   1. Optional degraded-system header (only when `degraded` is true).
 *   2. The 5-row TruthStateLegend (canonical Passport vocabulary).
 *   3. The institution-review boundary panel.
 */
export function PassportTruthStateBanner({
  degraded = false,
  degradedHeadline = DEFAULT_DEGRADED_HEADLINE,
  degradedSubcopy = DEFAULT_DEGRADED_SUBCOPY,
  showInstitutionReviewPanel = true,
  institutionReviewCopy = DEFAULT_INSTITUTION_REVIEW_COPY,
  className,
}: PassportTruthStateBannerProps) {
  return (
    <section
      aria-label="Passport truth-state context"
      data-passport-truth-state-banner=""
      className={cn('flex flex-col gap-6', className)}
    >
      {degraded && (
        <div
          role="status"
          data-passport-degraded-header=""
          className="rounded-none border border-border bg-card px-4 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            System condition
          </p>
          <p className="mt-2 text-sm text-foreground/80">
            <strong className="font-medium">{degradedHeadline}</strong>{' '}
            {degradedSubcopy}
          </p>
        </div>
      )}

      <div
        data-passport-truth-state-legend=""
        className="rounded-none border border-border bg-card px-4 py-4"
      >
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          What these tags mean
        </p>
        <TruthStateLegend rows="passport" layout="stack" />
      </div>

      {showInstitutionReviewPanel && (
        <div
          data-passport-institution-review=""
          className="rounded-none border border-border bg-card px-4 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Institution review
          </p>
          <p className="mt-2 text-sm text-foreground/80">{institutionReviewCopy}</p>
        </div>
      )}
    </section>
  );
}

'use client';

/**
 * OpportunityApplyCta — Wave K. Gates the real Apply-with-VitalCV share flow on
 * the engine's own hard gates:
 *   - hard blockers (or an INELIGIBLE band) → an honest "review what's blocking"
 *     affordance pointing at the full breakdown, never a broken apply button;
 *   - otherwise → the real ApplyWithVitalCV modal (POST /api/apply/share,
 *     audit-first, revocable), prefilled with this opportunity's employer.
 *
 * The gate reflects credential eligibility from the clinician's trust state —
 * it is the engine's output, not a promise about hiring outcomes.
 */

import { ApplyWithVitalCV } from '@/components/apply/ApplyWithVitalCV';
import type {
  IntelligenceExplanation,
  IntelligenceOpportunity,
} from './OpportunityIntelligenceCard';

export interface ApplyCtaOpportunity extends IntelligenceOpportunity {
  organizationId?: string;
  employerSlug?: string;
}

export function hardGateCount(explanation?: IntelligenceExplanation): number {
  if (!explanation) return 0;
  const hard = (explanation.blockers ?? []).filter((b) => b.severity === 'hard').length;
  if (hard > 0) return hard;
  return explanation.matchBand === 'INELIGIBLE'
    ? Math.max(explanation.missingCredentials?.length ?? 0, 1)
    : 0;
}

export interface OpportunityApplyCtaProps {
  npi: string | null | undefined;
  opportunity: ApplyCtaOpportunity;
  explanation?: IntelligenceExplanation;
  /** Where the blocked state's "review" affordance points (the detail breakdown). */
  detailHref?: string;
  onShareComplete?: () => void;
}

export function OpportunityApplyCta({
  npi,
  opportunity,
  explanation,
  detailHref,
  onShareComplete,
}: OpportunityApplyCtaProps) {
  if (!npi) return null;

  const gates = hardGateCount(explanation);
  if (gates > 0) {
    const label = `${gates} gating requirement${gates === 1 ? '' : 's'} to resolve before you can apply`;
    return (
      <div
        data-testid="apply-blocked"
        style={{
          marginTop: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid color-mix(in srgb, var(--vt-risk-medium, #A05C00) 30%, transparent)',
          background: 'color-mix(in srgb, var(--vt-risk-medium, #A05C00) 8%, transparent)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vt-risk-medium, #A05C00)' }}>
          {label}
        </span>
        {detailHref ? (
          <a
            href={detailHref}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--vt-accent, #0A7B7F)',
              textDecoration: 'none',
            }}
          >
            See what&rsquo;s needed →
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <ApplyWithVitalCV
        npi={npi}
        initialOrgContext={{
          name: opportunity.organization ?? '',
          organization_id: opportunity.organizationId ?? opportunity.employerSlug ?? '',
          purpose_of_use: 'Employment consideration',
        }}
        onShareComplete={onShareComplete ? () => onShareComplete() : undefined}
      />
    </div>
  );
}

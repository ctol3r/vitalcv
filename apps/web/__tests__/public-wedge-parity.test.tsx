import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrustLabel } from '@/components/ui/trust-label';
import {
  PUBLIC_WEDGE_ROUTE_TARGETS,
  PUBLIC_WEDGE_SURFACE_STATES,
  buildEmployerReviewHref,
  buildPassportEntityHref,
  buildPassportLookupHref,
  getPublicWedgeSurfaceStateLabel,
  isPublicWedgeStrongOutcome,
  resolvePublicWedgeSurfaceStateFromAccordionStatus,
  resolvePublicWedgeSurfaceStateFromCoverage,
  resolvePublicWedgeSurfaceStateFromTruth,
} from '@/lib/trust/public-wedge-parity';
import {
  createCanonicalSourceCoverage,
  type CanonicalTruth,
} from '../../../packages/trust-state';

function buildTruth(
  truth: Partial<CanonicalTruth>,
): Pick<CanonicalTruth, 'status' | 'coverage'> {
  return {
    status: truth.status ?? 'PENDING',
    coverage: truth.coverage ?? createCanonicalSourceCoverage({
      sourceId: 'NPPES_API',
      state: 'pending',
      reason: 'Source not checked yet',
    }),
  };
}

describe('public wedge parity helpers', () => {
  it('keeps homepage, passport, and review routes on one shared helper contract', () => {
    expect(buildPassportLookupHref('1234567890')).toBe(
      `${PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry}?npi=1234567890`,
    );
    expect(buildPassportLookupHref(null)).toBe(PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry);
    expect(buildPassportEntityHref('entity_123')).toBe('/passport/entity_123');
    expect(buildEmployerReviewHref('entity_123', {
      contextId: 'ctx_abc123',
      from: 'Ada Lovelace',
    })).toBe('/review/entity_123?contextId=ctx_abc123&from=Ada+Lovelace');
  });

  it('maps canonical truth back into the shared public wedge status contract', () => {
    const checkedTruth = buildTruth({
      status: 'VERIFIED',
      coverage: createCanonicalSourceCoverage({
        sourceId: 'NPPES_API',
        state: 'checked',
        reason: 'Identity checked',
      }),
    });
    const staleTruth = buildTruth({
      status: 'PENDING',
      coverage: createCanonicalSourceCoverage({
        sourceId: 'OIG_LEIE',
        state: 'stale',
        reason: 'OIG evidence stale',
      }),
    });
    const contextualTruth = buildTruth({
      status: 'NOT DECISION-GRADE',
      coverage: createCanonicalSourceCoverage({
        sourceId: 'PECOS_PUBLIC',
        state: 'notDecisionGrade',
        reason: 'Quarterly snapshot is contextual only',
      }),
    });

    expect(resolvePublicWedgeSurfaceStateFromTruth(checkedTruth)).toBe('checked');
    expect(resolvePublicWedgeSurfaceStateFromTruth(staleTruth)).toBe('stale');
    expect(resolvePublicWedgeSurfaceStateFromTruth(contextualTruth)).toBe('preview_only');
  });

  it('keeps coverage, accordion, and strong-outcome semantics on the same contract', () => {
    expect(resolvePublicWedgeSurfaceStateFromCoverage('reviewRequired')).toBe('review_required');
    expect(resolvePublicWedgeSurfaceStateFromCoverage('notDecisionGrade')).toBe('preview_only');
    expect(resolvePublicWedgeSurfaceStateFromAccordionStatus('stale')).toBe('stale');
    expect(resolvePublicWedgeSurfaceStateFromAccordionStatus('access_required')).toBe('access_required');
    expect(isPublicWedgeStrongOutcome('checked')).toBe(true);
    expect(isPublicWedgeStrongOutcome('review_required')).toBe(false);
    expect(isPublicWedgeStrongOutcome('preview_only')).toBe(false);
  });

  it('keeps shared wedge state labels explicit across homepage, passport, review, and request surfaces', () => {
    expect(
      PUBLIC_WEDGE_SURFACE_STATES.map((state) => [state, getPublicWedgeSurfaceStateLabel(state)]),
    ).toEqual([
      ['checked', 'Checked'],
      ['pending', 'Pending'],
      ['stale', 'Stale'],
      ['access_required', 'Access required'],
      ['unavailable', 'Unavailable'],
      ['review_required', 'Review required'],
      ['preview_only', 'Preview only'],
    ]);
  });

  it('renders unsupported source states without escalating them into strong trust badges', () => {
    const contextualTruth = buildTruth({
      status: 'NOT DECISION-GRADE',
      coverage: createCanonicalSourceCoverage({
        sourceId: 'PECOS_PUBLIC',
        state: 'notDecisionGrade',
        reason: 'Quarterly snapshot is contextual only',
      }),
    });

    const markup = renderToStaticMarkup(
      <TrustLabel
        status={resolvePublicWedgeSurfaceStateFromTruth(contextualTruth)}
        label="Eligibility"
        source="CMS PECOS"
        note="Quarterly snapshot is contextual only"
      />,
    );

    expect(markup).toContain('Preview only');
    expect(markup).not.toContain('Confirmed');
    expect(markup).not.toContain('Verified');
  });
});

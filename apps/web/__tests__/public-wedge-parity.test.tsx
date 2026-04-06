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
  resolvePublicWedgeSurfaceStateFromDisplayLabel,
  resolvePublicWedgeSurfaceStateFromPreviewStageStatus,
  resolvePublicWedgeSurfaceStateFromTruth,
} from '@/lib/trust/public-wedge-parity';
import {
  CANONICAL_SOURCE_COVERAGE_STATES,
  LAUNCH_SPINE_SOURCE_IDS,
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
      status: 'NOT_DECISION_GRADE',
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
    expect(resolvePublicWedgeSurfaceStateFromPreviewStageStatus('loading')).toBe('pending');
    expect(resolvePublicWedgeSurfaceStateFromPreviewStageStatus('ok')).toBe('checked');
    expect(resolvePublicWedgeSurfaceStateFromDisplayLabel('Source-backed')).toBe('checked');
    expect(resolvePublicWedgeSurfaceStateFromDisplayLabel('Excluded')).toBe('review_required');
    expect(resolvePublicWedgeSurfaceStateFromDisplayLabel('Unknown text')).toBe('pending');
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

  it('CANONICAL_SOURCE_COVERAGE_STATES core 4 states are represented in PUBLIC_WEDGE_SURFACE_STATES', () => {
    // The web surface maps camelCase states to snake_case labels.
    // This test ensures the parity contract holds for the core lane states.
    const coreCanonical = ['checked', 'pending', 'stale', 'accessRequired'] as const;
    const surfaceEquivalents = ['checked', 'pending', 'stale', 'access_required'] as const;

    for (const state of coreCanonical) {
      expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain(state);
    }
    for (const state of surfaceEquivalents) {
      expect(PUBLIC_WEDGE_SURFACE_STATES).toContain(state);
    }
  });

  it('LAUNCH_SPINE_SOURCE_IDS covers the pilot ingest set', () => {
    expect(LAUNCH_SPINE_SOURCE_IDS).toEqual(
      expect.arrayContaining(['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD']),
    );
  });

  it('employer entry route target resolves to /review', () => {
    expect(PUBLIC_WEDGE_ROUTE_TARGETS.reviewEntry).toBe('/review');
  });

  it('renders unsupported source states without escalating them into strong trust badges', () => {
    const contextualTruth = buildTruth({
      status: 'NOT_DECISION_GRADE',
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

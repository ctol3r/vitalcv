import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PassportSourceCoveragePanel,
  PASSPORT_SOURCE_COVERAGE_COPY,
  PASSPORT_SOURCE_COVERAGE_TITLE,
} from '../components/trust/PassportSourceCoveragePanel';
import { SourceCoverageTag } from '../components/trust/SourceCoverageTag';
import {
  findPassportSourceCoverageCheck,
  findPassportSourceCoverageChecks,
  normalizePassportSourceCoverageState,
  sourceCoverageBadgeLabel,
  sourceCoveragePosture,
  type PassportSourceCoverageReport,
} from '../lib/trust/source-coverage';
import { mapSourceCoverageStateToTrustStatus } from '../lib/trust/status-language';

describe('trust source coverage contract', () => {
  it('normalizes canonical source coverage states without dropping aliases', () => {
    expect(normalizePassportSourceCoverageState('access-required')).toBe('accessRequired');
    expect(normalizePassportSourceCoverageState('review_required')).toBe('reviewRequired');
    expect(normalizePassportSourceCoverageState('not checked')).toBe('notChecked');
    expect(normalizePassportSourceCoverageState('notDecisionGrade')).toBe('notDecisionGrade');
    expect(normalizePassportSourceCoverageState('CHECKED')).toBe('live');
    expect(normalizePassportSourceCoverageState('demo')).toBe('mock');
    expect(normalizePassportSourceCoverageState('bogus')).toBeNull();
  });

  it('keeps degraded-state meaning aligned across posture, tag copy, and trust status', () => {
    expect(sourceCoveragePosture('stale')).toBe('degraded');
    expect(sourceCoveragePosture('reviewRequired')).toBe('degraded');
    expect(sourceCoverageBadgeLabel({ state: 'stale', decisionGrade: false })).toBe('Stale');
    expect(sourceCoverageBadgeLabel({ state: 'reviewRequired', decisionGrade: false })).toBe('Review required');
    expect(mapSourceCoverageStateToTrustStatus('stale')).toBe('stale');
    expect(mapSourceCoverageStateToTrustStatus('reviewRequired')).toBe('review_required');
  });

  it('renders stale and review-required coverage instead of collapsing them', () => {
    const staleMarkup = renderToStaticMarkup(
      <SourceCoverageTag
        source="STATE_BOARD"
        status="stale"
        decisionGrade={false}
        lastChecked="2026-03-20T00:00:00.000Z"
      />,
    );
    const reviewMarkup = renderToStaticMarkup(
      <SourceCoverageTag
        source="OIG_LEIE"
        status="reviewRequired"
        decisionGrade={false}
      />,
    );

    expect(staleMarkup).toContain('STATE_BOARD');
    expect(staleMarkup).toContain('Stale');
    expect(reviewMarkup).toContain('Review required');
  });

  it('renders shared passport and review source coverage copy from one presenter', () => {
    const markup = renderToStaticMarkup(
      <PassportSourceCoveragePanel
        checks={[
          {
            sourceId: 'NPPES_API',
            state: 'live',
            reason: 'identity checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
            artifactId: null,
            sourceUrl: null,
            rawArtifactRef: null,
            checksum: null,
            parserVersion: null,
            freshnessWindowHours: null,
            proof: null,
          },
        ]}
      />,
    );

    expect(markup).toContain(PASSPORT_SOURCE_COVERAGE_TITLE);
    expect(markup).toContain('NPPES_API');
    expect(markup).toContain(PASSPORT_SOURCE_COVERAGE_COPY);
  });

  it('finds canonical coverage checks by source alias from the passport report', () => {
    const report: PassportSourceCoverageReport = {
      checks: [
        {
          sourceId: 'NPPES_API',
          state: 'live',
          reason: 'identity checked',
          checkedAt: '2026-03-20T00:00:00.000Z',
        },
        {
          sourceId: 'OIG_LEIE',
          state: 'reviewRequired',
          reason: 'possible match',
          checkedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
      summary: {
        live: ['NPPES_API'],
        gated: [],
        partial: [],
        stale: [],
        notDecisionGrade: [],
        notChecked: [],
        unavailable: [],
        accessRequired: [],
        reviewRequired: ['OIG_LEIE'],
        mock: [],
      },
    };

    expect(findPassportSourceCoverageCheck(report, ['NPI Registry', 'NPPES'])?.state).toBe('live');
    expect(findPassportSourceCoverageCheck(report, ['OIG', 'LEIE'])?.state).toBe('reviewRequired');
  });

  it('preserves parser and freshness metadata when normalizing coverage checks', () => {
    const report: PassportSourceCoverageReport = {
      checks: [
        {
          sourceId: 'PECOS_PUBLIC',
          state: 'live',
          reason: 'quarterly enrollment checked',
          parserVersion: 'v1.2.0',
          freshnessWindowHours: 2160,
        },
      ],
      summary: {
        live: ['PECOS_PUBLIC'],
        gated: [],
        partial: [],
        stale: [],
        notDecisionGrade: [],
        notChecked: [],
        unavailable: [],
        accessRequired: [],
        reviewRequired: [],
        mock: [],
      },
    };

    expect(findPassportSourceCoverageCheck(report, ['PECOS'])?.parserVersion).toBe('v1.2.0');
    expect(findPassportSourceCoverageCheck(report, ['PECOS'])?.freshnessWindowHours).toBe(2160);
  });

  it('keeps homepage, passport, and review source aliases on the same canonical report', () => {
    const report: PassportSourceCoverageReport = {
      checks: [
        { sourceId: 'NPPES_API', state: 'live', reason: 'identity checked' },
        { sourceId: 'OIG_LEIE', state: 'live', reason: 'exclusion checked' },
        { sourceId: 'PECOS_PUBLIC', state: 'notDecisionGrade', reason: 'quarterly informational dataset' },
        { sourceId: 'STATE_BOARD', state: 'accessRequired', reason: 'institutional access required' },
      ],
      summary: {
        live: ['NPPES_API', 'OIG_LEIE'],
        gated: [],
        partial: [],
        stale: [],
        notDecisionGrade: ['PECOS_PUBLIC'],
        notChecked: [],
        unavailable: [],
        accessRequired: ['STATE_BOARD'],
        reviewRequired: [],
        mock: [],
      },
    };

    expect(findPassportSourceCoverageCheck(report, ['CMS NPPES', 'NPPES', 'NPI Registry'])?.sourceId).toBe('NPPES_API');
    expect(findPassportSourceCoverageCheck(report, ['OIG / LEIE', 'OIG LEIE'])?.sourceId).toBe('OIG_LEIE');
    expect(findPassportSourceCoverageCheck(report, ['CMS PECOS', 'PECOS'])?.state).toBe('notDecisionGrade');
    expect(findPassportSourceCoverageCheck(report, ['State Boards', 'FSMB', 'Nursys'])?.state).toBe('accessRequired');
    expect(findPassportSourceCoverageChecks(report, ['State Boards', 'FSMB', 'Nursys'])).toHaveLength(1);
  });
});

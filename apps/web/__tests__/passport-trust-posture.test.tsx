import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PassportTrustPosture } from '@/components/passport/PassportTrustPosture';
import type { PassportData } from '@/lib/trust/passport-contract';

describe('PassportTrustPosture', () => {
  it('renders band, dimensions, safe-to-rely claims, blockers, and explanation states', () => {
    const posture: PassportData['trustPosture'] = {
      band: 'L1',
      bandLabel: 'Partial trust',
      score: 61,
      dimensions: [
        {
          id: 'identity',
          label: 'Identity',
          state: 'current',
          detail: 'Identity is confirmed in CMS NPPES and is safe to rely on now.',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          id: 'safety',
          label: 'Safety',
          state: 'review_required',
          detail: 'OIG/LEIE returned a possible match and requires manual review.',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          id: 'authority',
          label: 'Authority',
          state: 'gated',
          detail: 'Licensure verification requires institutional source access.',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          id: 'eligibility',
          label: 'Eligibility',
          state: 'blocked',
          detail: 'CMS PECOS does not show an enrolled provider record, which blocks readiness.',
          checkedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      freshness: {
        state: 'stale',
        label: 'Stale sources present',
        items: [
          {
            id: 'identity',
            label: 'Identity',
            source: 'CMS NPPES',
            state: 'current',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Current attached check',
          },
          {
            id: 'safety',
            label: 'Safety',
            source: 'OIG LEIE',
            state: 'partial',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Possible match requires review',
          },
          {
            id: 'authority',
            label: 'Authority',
            source: 'State Board',
            state: 'partial',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Institutional access required',
          },
          {
            id: 'eligibility',
            label: 'Eligibility',
            source: 'CMS PECOS',
            state: 'stale',
            checkedAt: '2026-03-01T00:00:00.000Z',
            note: 'Stale quarterly release',
          },
        ],
      },
      safeToRelyOnNow: [
        'Identity confirmed via CMS NPPES.',
      ],
      missingItems: [
        'Board certification is not available yet.',
      ],
      gatedItems: [
        'Licensure verification requires institutional source access.',
      ],
      reviewRequiredItems: [
        'OIG/LEIE returned a possible match and requires manual review.',
      ],
      staleItems: [
        'PECOS evidence is stale and should be refreshed.',
      ],
      blockers: [
        'Medicare enrollment not found — submit PECOS enrollment (45–60 days)',
      ],
    };

    const markup = renderToStaticMarkup(<PassportTrustPosture posture={posture} />);

    expect(markup).toContain('Trust posture');
    expect(markup).toContain('Partial trust');
    expect(markup).toContain('61');
    expect(markup).toContain('Identity');
    expect(markup).toContain('Review required');
    expect(markup).toContain('Access required');
    expect(markup).toContain('Blocked');
    expect(markup).toContain('Review recommended');
    expect(markup).toContain('Identity confirmed via CMS NPPES.');
    expect(markup).toContain('Blockers impacting readiness');
    expect(markup).toContain('Medicare enrollment not found');
    expect(markup).toContain('Missing or unresolved');
    expect(markup).toContain('Board certification is not available yet.');
    expect(markup).toContain('PECOS evidence is stale and should be refreshed.');
  });

  it('renders fallback copy when there are no current claims or unresolved items', () => {
    const posture: PassportData['trustPosture'] = {
      band: 'L0',
      bandLabel: 'Insufficient trust',
      score: 0,
      dimensions: [
        {
          id: 'identity',
          label: 'Identity',
          state: 'missing',
          detail: 'CMS NPPES identity has not been confirmed yet.',
        },
        {
          id: 'safety',
          label: 'Safety',
          state: 'missing',
          detail: 'OIG/LEIE screening has not been confirmed yet.',
        },
        {
          id: 'authority',
          label: 'Authority',
          state: 'missing',
          detail: 'Live state licensure proof is not available yet.',
        },
        {
          id: 'eligibility',
          label: 'Eligibility',
          state: 'missing',
          detail: 'PECOS enrollment has not been confirmed yet.',
        },
      ],
      freshness: {
        state: 'partial',
        label: 'Partial source coverage',
        items: [],
      },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    };

    const markup = renderToStaticMarkup(<PassportTrustPosture posture={posture} />);

    expect(markup).toContain('Withheld');
    expect(markup).toContain('Score appears once source-backed claims attach');
    expect(markup).toContain('No current source-backed claims are available yet.');
    expect(markup).toContain('No missing, stale, gated, or review-required items are currently limiting this passport.');
  });
});

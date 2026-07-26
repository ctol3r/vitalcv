/**
 * vital-evidence.test.tsx — Wave 0A part 2 primitives.
 * EvidenceRow, ProofContinuityRail (lanes + aggregate tray), OfflineBanner,
 * EmptyState, SkeletonStack.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { EvidenceRow } from '@/components/vital/EvidenceRow';
import { ProofContinuityRail, type ProofLane } from '@/components/vital/ProofContinuityRail';
import { OfflineBanner } from '@/components/vital/OfflineBanner';
import { EmptyState } from '@/components/vital/EmptyState';
import { SkeletonStack } from '@/components/vital/SkeletonStack';

describe('vital/EvidenceRow', () => {
  it('renders claim, value, state chip, source, freshness, and limitation', () => {
    const html = renderToStaticMarkup(
      <EvidenceRow
        data={{
          claim: 'Federal exclusions',
          value: 'No matching LEIE record returned',
          state: 'checked',
          source: 'OIG / LEIE',
          checkedAt: 'Jul 15, 2026',
          limitation: 'Final employer clearance or credentialing approval.',
        }}
      />,
    );
    expect(html).toContain('Federal exclusions');
    expect(html).toContain('No matching LEIE record returned');
    expect(html).toContain('Checked');
    expect(html).toContain('OIG / LEIE');
    expect(html).toContain('Does not mean:');
    expect(html).toContain('data-ts');
  });
});

describe('vital/ProofContinuityRail', () => {
  const lanes: ProofLane[] = [
    { id: 'nppes', label: 'NPPES', state: 'source_backed' },
    { id: 'oig', label: 'OIG / LEIE', state: 'checked' },
    { id: 'pecos', label: 'PECOS', state: 'needs_review' },
    { id: 'state', label: 'State board', state: 'access_required' },
    { id: 'state2', label: 'State board 2', state: 'access_required' },
    { id: 'training', label: 'Training', state: 'unavailable' },
  ];

  it('renders every lane label', () => {
    const html = renderToStaticMarkup(<ProofContinuityRail lanes={lanes} />);
    for (const l of lanes) expect(html).toContain(l.label);
  });

  it('aggregate tray counts by state (2 access-required)', () => {
    const html = renderToStaticMarkup(<ProofContinuityRail lanes={lanes} />);
    // The tray shows "2" next to "Access required".
    expect(html).toMatch(/2<\/span>\s*<span[^>]*>Access required/);
    expect(html).toContain('data-proof-rail');
  });
});

describe('vital/OfflineBanner', () => {
  it('renders the honest freshness message when forced offline', () => {
    const html = renderToStaticMarkup(<OfflineBanner forceOffline />);
    expect(html).toContain('Freshness timestamps remain unchanged');
    expect(html).toContain('data-offline-banner');
  });

  it('renders nothing by default (SSR — assumed online)', () => {
    expect(renderToStaticMarkup(<OfflineBanner />)).toBe('');
  });
});

describe('vital/EmptyState + SkeletonStack', () => {
  it('EmptyState states what/why and one action', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No applications yet" why="You have not applied to any roles." action={{ label: 'Find roles', href: '/explore' }} />,
    );
    expect(html).toContain('No applications yet');
    expect(html).toContain('You have not applied to any roles.');
    expect(html).toContain('Find roles');
    expect(html).toContain('data-empty-state');
  });

  it('SkeletonStack renders the requested number of shape-matched rows', () => {
    const html = renderToStaticMarkup(<SkeletonStack rows={3} />);
    expect(html).toContain('data-skeleton-stack');
    expect(html).toContain('aria-busy="true"');
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

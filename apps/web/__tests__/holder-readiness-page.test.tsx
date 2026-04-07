import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import ClinicianReadinessSurface from '../components/mobile/ClinicianReadinessSurface';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';
import { vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    redirect: vi.fn(), usePathname: () => '/holder/readiness',
    useSearchParams: () => new URLSearchParams(),
  };
});

vi.mock('../components/mobile/ClinicianSupportCard', () => ({
  ClinicianSupportCard: () => null,
}));

function buildSampleData(): ClinicianMobileData {
  return {
    signedIn: true,
    workspace: {
      personProfile: {
        npi: '1234567890',
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'ICU',
        stateOfPractice: 'OR',
        completeness: 90,
      },
    },
    trustState: {
      npi: '1234567890',
      readinessLevel: 'L3',
      readinessScore: 91,
      readinessStatus: 'Ready to credential - all evidence verified',
      trustBand: 'L3',
      trustScore: 91,
      gapSummary: [],
      computedAt: '2026-03-20T10:30:00.000Z',
      cached: false,
    },
    applications: [],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-03-20T10:30:00.000Z',
    profileCompleteness: {
      score: 90,
      dimensions: {
        npiVerified: true,
        resumeUploaded: true,
        linksAdded: true,
        workAuthProvided: true,
        credentialsImported: true,
      },
    },
    trustHistory: [
      {
        id: 'history_1',
        npi: '1234567890',
        readinessLevel: 'L3',
        readinessScore: 91,
        readinessStatus: 'Ready to credential - all evidence verified',
        trustBand: 'L3',
        trustScore: 91,
        gapSummary: [],
        computedAt: '2026-03-20T10:30:00.000Z',
        cached: false,
        deltaScore: 6,
        deltaBand: 'up',
        previousLevel: 'L2',
        previousScore: 85,
        newGaps: [],
        resolvedGaps: ['DEA registration not verified'],
        reason: 'Resolved dea registration not verified',
      },
      {
        id: 'history_2',
        npi: '1234567890',
        readinessLevel: 'L2',
        readinessScore: 85,
        readinessStatus: 'Mostly ready - minor gaps remain',
        trustBand: 'L2',
        trustScore: 85,
        gapSummary: ['DEA registration not verified'],
        computedAt: '2026-03-18T10:30:00.000Z',
        cached: false,
        deltaScore: null,
        deltaBand: null,
        previousLevel: null,
        previousScore: null,
        newGaps: [],
        resolvedGaps: [],
        reason: 'DEA registration not verified',
      },
    ],
    notifications: [],
    blockers: [],
    activeApplications: [],
    availableOpportunities: [],
    recommendedAction: {
      kind: 'apply_now',
      title: 'View matched opportunities',
      description: 'Use your live readiness state to move immediately.',
      href: '/holder/opportunities',
      ctaLabel: 'View opportunities',
    },
  };
}

describe('/holder/readiness page', () => {
  it('renders the provider-backed readiness history snapshot', () => {
    const markup = renderToStaticMarkup(
      <ClinicianMobileProvider initialData={buildSampleData()}>
        <ClinicianReadinessSurface />
      </ClinicianMobileProvider>,
    );

    expect(markup).toContain('Readiness');
    expect(markup).toContain('Ready to move');
    expect(markup).toContain('Ready to credential');
    expect(markup).toContain('91/100');
    expect(markup).toContain('View opportunities');
    expect(markup).toContain('Resolved dea registration not verified');
    expect(markup).toContain('History');
    expect(markup).toContain('What changed because of VitalCV');
    expect(markup).toContain('Blockers resolved');
    expect(markup).toContain('Readiness delta');
  });
});

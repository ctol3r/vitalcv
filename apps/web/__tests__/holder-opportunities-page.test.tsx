import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import ClinicianOpportunitiesSurface from '../components/mobile/ClinicianOpportunitiesSurface';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    redirect: vi.fn(),
    usePathname: () => '/holder/opportunities',
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

vi.mock('../components/explore/ApplyModal', () => ({
  default: () => null,
}));

vi.mock('../components/mobile/ClinicianSupportCard', () => ({
  ClinicianSupportCard: ({ primaryLabel }: { primaryLabel: string }) => <div>{primaryLabel}</div>,
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
        completeness: 88,
      },
    },
    trustState: {
      npi: '1234567890',
      readinessLevel: 'L2',
      readinessScore: 88,
      readinessStatus: 'Mostly ready - one blocker left',
      trustBand: 'L2',
      trustScore: 88,
      gapSummary: ['DEA registration not verified'],
      computedAt: '2026-04-08T09:00:00.000Z',
      cached: false,
    },
    applications: [],
    opportunities: [
      {
        id: 'opp_1',
        organizationId: 'org_1',
        organizationName: 'Providence',
        organizationSlug: 'providence',
        title: 'Travel ICU Physician',
        specialty: 'ICU',
        hiringType: 'contract',
        state: 'OR',
        payRange: '$4,200/week',
        requirementLevel: 'L2',
        description: 'Live role',
        remote: false,
        status: 'ACTIVE',
        createdAt: '2026-04-08T09:00:00.000Z',
        application: null,
        match: {
          opportunityId: 'opp_1',
          band: 'CLEAR',
          score: 91,
          blockers: [],
          fitReasons: ['ICU specialty', 'Oregon license'],
        },
      },
    ],
    missingForHigherMatches: [],
    refreshedAt: '2026-04-08T09:00:00.000Z',
    profileCompleteness: null,
    trustHistory: [],
    notifications: [],
    blockers: [],
    activeApplications: [],
    availableOpportunities: [
      {
        id: 'opp_1',
        organizationId: 'org_1',
        organizationName: 'Providence',
        organizationSlug: 'providence',
        title: 'Travel ICU Physician',
        specialty: 'ICU',
        hiringType: 'contract',
        state: 'OR',
        payRange: '$4,200/week',
        requirementLevel: 'L2',
        description: 'Live role',
        remote: false,
        status: 'ACTIVE',
        createdAt: '2026-04-08T09:00:00.000Z',
        application: null,
        match: {
          opportunityId: 'opp_1',
          band: 'CLEAR',
          score: 91,
          blockers: [],
          fitReasons: ['ICU specialty', 'Oregon license'],
        },
      },
    ],
    recommendedAction: {
      kind: 'apply_now',
      title: 'Explore matched roles',
      description: 'Your current record is strong enough to start applying.',
      href: '/holder/opportunities?apply=opp_1',
      ctaLabel: 'Start application',
    },
  };
}

describe('/holder/opportunities page', () => {
  it('keeps the holder route tied back to passport and readiness context', () => {
    const markup = renderToStaticMarkup(
      <ClinicianMobileProvider initialData={buildSampleData()}>
        <ClinicianOpportunitiesSurface />
      </ClinicianMobileProvider>,
    );

    expect(markup).toContain('Explore matched roles');
    expect(markup).toContain('carry your latest readiness and passport into apply');
    expect(markup).toContain('Live opportunity feed');
    expect(markup).toContain('Apply now');
    expect(markup).toContain('Review passport');
  });
});

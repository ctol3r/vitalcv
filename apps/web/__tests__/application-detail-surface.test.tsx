import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import ClinicianApplicationDetailSurface from '../components/mobile/ClinicianApplicationDetailSurface';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    redirect: vi.fn(), usePathname: () => '/holder/applications/app_1',
    useSearchParams: () => new URLSearchParams(),
  };
});

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
        completeness: 92,
      },
    },
    trustState: null,
    applications: [],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-03-20T10:30:00.000Z',
    profileCompleteness: null,
    trustHistory: [],
    notifications: [
      {
        id: 'notification_1',
        type: 'application_status_changed',
        occurredAt: '2026-03-20T10:45:00.000Z',
        title: 'Application in review',
        body: 'Providence is reviewing your verified profile.',
        href: '/holder/applications/app_1',
        ctaLabel: 'View application',
        relatedBlockerId: null,
        relatedApplicationId: 'app_1',
        relatedOpportunityId: 'opp_1',
      },
    ],
    blockers: [],
    activeApplications: [
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'REVIEWED',
        createdAt: '2026-03-19T08:00:00.000Z',
        updatedAt: '2026-03-20T10:45:00.000Z',
        reviewedAt: '2026-03-20T10:45:00.000Z',
        reviewNote: 'Providence is reviewing your verified profile.',
        employer: { organizationId: 'org_1', name: 'Providence' },
        opportunity: {
          id: 'opp_1',
          organizationId: 'org_1',
          organizationName: 'Providence',
          title: 'Travel ICU Nurse',
          specialty: 'ICU',
          hiringType: 'contract',
          state: 'OR',
          payRange: '$3,600/week',
          status: 'ACTIVE',
        },
        provider: null,
        readiness: {
          readinessScore: 91,
          readinessLevel: 'L3',
          readinessStatus: 'Ready to credential',
          gapSummary: [],
          keyCredentials: ['Oregon license'],
          trustSignals: ['NPI identity verified'],
        },
        latestRecommendation: {
          actionType: 'CONTINUE_REVIEW',
          label: 'Continue review',
          explanation: 'No extra action is required right now.',
        },
        timeline: [
          {
            stage: 'PENDING',
            occurredAt: '2026-03-19T08:00:00.000Z',
            description: 'Application submitted.',
          },
          {
            stage: 'REVIEWED',
            occurredAt: '2026-03-20T10:45:00.000Z',
            description: 'Providence is reviewing your verified profile.',
          },
        ],
        systemBehavesAutonomously: false,
      },
    ],
    availableOpportunities: [],
    recommendedAction: {
      kind: 'view_application',
      title: 'View your application',
      description: 'Travel ICU Nurse is active and every update will land in one place.',
      href: '/holder/applications/app_1',
      ctaLabel: 'View application',
    },
  };
}

describe('ClinicianApplicationDetailSurface', () => {
  it('renders clear progress and next-step messaging', () => {
    const markup = renderToStaticMarkup(
      <ClinicianMobileProvider initialData={buildSampleData()}>
        <ClinicianApplicationDetailSurface applicationId="app_1" />
      </ClinicianMobileProvider>,
    );

    expect(markup).toContain('Why you were ready enough to submit');
    expect(markup).toContain('What happens now');
    expect(markup).toContain('Status progression');
    expect(markup).toContain('View role details');
    expect(markup).toContain('Submitted');
  });
});

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import ClinicianBlockerDetailSurface from '../components/mobile/ClinicianBlockerDetailSurface';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    usePathname: () => '/holder/blockers/missing_credential%3Aapp_1%3Aopp_1%3Astate-license-evidence-missing',
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
        completeness: 88,
      },
    },
    trustState: null,
    applications: [],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-03-20T10:30:00.000Z',
    profileCompleteness: null,
    trustHistory: [],
    notifications: [],
    blockers: [
      {
        id: 'missing_credential:app_1:opp_1:state-license-evidence-missing',
        type: 'missing_credential',
        title: 'Credential evidence missing',
        label: 'State license evidence missing',
        detail: 'State license evidence missing',
        explanation: 'Upload the current state license so this application can keep moving.',
        href: '/holder/blockers/missing_credential%3Aapp_1%3Aopp_1%3Astate-license-evidence-missing',
        nextActionLabel: 'Upload evidence',
        nextActionHref: '/holder/blockers/missing_credential%3Aapp_1%3Aopp_1%3Astate-license-evidence-missing',
        occurredAt: '2026-03-20T10:30:00.000Z',
        relatedApplicationId: 'app_1',
        relatedOpportunityId: 'opp_1',
        priority: 10,
      },
    ],
    activeApplications: [
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'REVIEWED',
        createdAt: '2026-03-19T08:00:00.000Z',
        updatedAt: '2026-03-20T10:30:00.000Z',
        reviewedAt: '2026-03-20T10:30:00.000Z',
        reviewNote: 'Waiting for updated state license.',
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
          readinessScore: 84,
          readinessLevel: 'L2',
          readinessStatus: 'Mostly ready - missing evidence',
          gapSummary: ['State license evidence missing'],
          keyCredentials: ['Oregon license'],
          trustSignals: ['NPI identity verified'],
        },
        latestRecommendation: {
          actionType: 'UPLOAD_EVIDENCE',
          label: 'Upload updated evidence',
          explanation: 'Resolve the missing document to keep review moving.',
        },
        timeline: [],
        systemBehavesAutonomously: false,
      },
    ],
    availableOpportunities: [],
    recommendedAction: {
      kind: 'resolve_gap',
      title: 'Resolve what is left',
      description: 'State license evidence missing',
      href: '/holder/blockers/missing_credential%3Aapp_1%3Aopp_1%3Astate-license-evidence-missing',
      ctaLabel: 'Resolve blocker',
    },
  };
}

describe('ClinicianBlockerDetailSurface', () => {
  it('shows the payoff and upload path for a blocker', () => {
    const markup = renderToStaticMarkup(
      <ClinicianMobileProvider initialData={buildSampleData()}>
        <ClinicianBlockerDetailSurface blockerId="missing_credential:app_1:opp_1:state-license-evidence-missing" />
      </ClinicianMobileProvider>,
    );

    expect(markup).toContain('Why this is worth doing now');
    expect(markup).toContain('Upload what clears this blocker');
    expect(markup).toContain('Related application');
    expect(markup).toContain('What happens after upload');
  });
});

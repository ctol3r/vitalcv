import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClinicianApplicationsSurface from '../components/mobile/ClinicianApplicationsSurface';
import ClinicianHomeSurface from '../components/mobile/ClinicianHomeSurface';
import ClinicianOpportunitiesSurface from '../components/mobile/ClinicianOpportunitiesSurface';
import ClinicianUpdatesSurface from '../components/mobile/ClinicianUpdatesSurface';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

type MockContext = ReturnType<typeof createMockContext>;

const mockState = vi.hoisted(() => ({
  context: null as MockContext | null,
}));

vi.mock('@/components/mobile/ClinicianMobileProvider', () => ({
  useClinicianMobile: () => {
    if (!mockState.context) {
      throw new Error('Mock mobile context not initialized.');
    }

    return mockState.context;
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/holder/opportunities',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock('@/components/explore/ApplyModal', () => ({
  default: () => null,
}));

vi.mock('@/components/mobile/ClinicianSupportCard', () => ({
  ClinicianSupportCard: () => null,
}));

function buildData(overrides: Partial<ClinicianMobileData> = {}): ClinicianMobileData {
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
    trustState: {
      npi: '1234567890',
      readinessLevel: 'L2',
      readinessScore: 88,
      readinessStatus: 'Mostly ready - minor gaps remain',
      trustBand: 'L2',
      trustScore: 88,
      gapSummary: ['DEA registration not verified'],
      computedAt: '2026-04-08T11:45:00.000Z',
      cached: false,
    },
    applications: [],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-04-08T11:45:00.000Z',
    profileCompleteness: {
      score: 92,
      dimensions: {
        npiVerified: true,
        resumeUploaded: true,
        linksAdded: true,
        workAuthProvided: true,
        credentialsImported: true,
      },
    },
    trustHistory: [],
    notifications: [],
    blockers: [],
    activeApplications: [],
    availableOpportunities: [],
    recommendedAction: {
      kind: 'view_passport',
      title: 'Review your readiness',
      description: 'Keep your verified identity ready to share.',
      href: '/holder',
      ctaLabel: 'Open passport',
    },
    ...overrides,
  };
}

function createMockContext(data: ClinicianMobileData) {
  return {
    data,
    visibleNotifications: data.notifications,
    unreadNotifications: data.notifications,
    selectedOpportunityId: null,
    previousVisitAt: '2026-04-08T11:00:00.000Z',
    resumePath: null,
    dismissedNotificationIds: [],
    readNotificationIds: [],
    isRefreshing: false,
    isOffline: false,
    refreshError: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshTrustState: vi.fn().mockResolvedValue(undefined),
    selectOpportunity: vi.fn(),
    dismissNotification: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    clearDismissedNotifications: vi.fn(),
    applySubmitted: vi.fn(),
  };
}

describe('mobile utility surfaces', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
    mockState.context = null;
    vi.stubGlobal('React', React);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the most recent recorded change as the next clear action on return visits', () => {
    const data = buildData({
      notifications: [
        {
          id: 'notification_1',
          type: 'application_status_changed',
          occurredAt: '2026-04-08T11:30:00.000Z',
          title: 'Application reviewed',
          body: 'Providence moved your application into review.',
          href: '/holder/applications/app_1',
          ctaLabel: 'Open application',
          relatedBlockerId: null,
          relatedApplicationId: 'app_1',
          relatedOpportunityId: 'opp_1',
        },
      ],
    });

    mockState.context = createMockContext(data);
    const markup = renderToStaticMarkup(<ClinicianHomeSurface />);

    expect(markup).toContain('Latest change');
    expect(markup).toContain('Application reviewed');
    expect(markup).toContain('Providence moved your application into review.');
    expect(markup).toContain('Open application');
  });

  it('keeps the applications surface actionable when no applications are live yet', () => {
    const data = buildData({
      availableOpportunities: [
        {
          id: 'opp_2',
          organizationId: 'org_2',
          organizationName: 'Legacy Health',
          organizationSlug: 'legacy-health',
          title: 'ICU Float Nurse',
          specialty: 'ICU',
          hiringType: 'contract',
          state: 'OR',
          payRange: '$3,800/week',
          requirementLevel: 'L2',
          description: 'Live role',
          remote: false,
          status: 'ACTIVE',
          createdAt: '2026-04-08T11:15:00.000Z',
          application: null,
          match: {
            opportunityId: 'opp_2',
            band: 'CLEAR',
            score: 92,
            blockers: [],
            fitReasons: ['ICU specialty'],
          },
        },
      ],
    });

    mockState.context = createMockContext(data);
    const markup = renderToStaticMarkup(<ClinicianApplicationsSurface />);

    expect(markup).toContain('Next recorded step: ICU Float Nurse');
    expect(markup).toContain('No application is in motion yet');
    expect(markup).toContain('Apply now');
    expect(markup).toContain('Apply to best match');
  });

  it('avoids a dead-end in opportunities when no stronger matches are live but an application is already moving', () => {
    const data = buildData({
      activeApplications: [
        {
          id: 'app_1',
          opportunityId: 'opp_1',
          status: 'REVIEWED',
          createdAt: '2026-04-08T10:00:00.000Z',
          updatedAt: '2026-04-08T11:20:00.000Z',
          reviewedAt: '2026-04-08T11:20:00.000Z',
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
            readinessScore: 88,
            readinessLevel: 'L2',
            readinessStatus: 'Mostly ready - minor gaps remain',
            gapSummary: [],
            keyCredentials: ['Oregon license'],
            trustSignals: ['NPI identity verified'],
          },
          latestRecommendation: {
            actionType: 'CONTINUE_REVIEW',
            label: 'Continue review',
            explanation: 'Providence is reviewing your verified profile.',
          },
          timeline: [],
          systemBehavesAutonomously: false,
        },
      ],
      opportunities: [],
      availableOpportunities: [],
    });

    mockState.context = createMockContext(data);
    const markup = renderToStaticMarkup(<ClinicianOpportunitiesSurface />);

    expect(markup).toContain('Keep current roles moving');
    expect(markup).toContain('No stronger live match is available right now');
    expect(markup).toContain('View application');
    expect(markup).toContain('No new role matches available right now');
  });

  it('keeps updates anchored to the latest recorded change when the workspace state is aging', () => {
    const data = buildData({
      refreshedAt: '2026-04-08T08:15:00.000Z',
      notifications: [
        {
          id: 'notification_2',
          type: 'trust_state_changed',
          occurredAt: '2026-04-08T11:40:00.000Z',
          title: 'License evidence verified',
          body: 'Your readiness moved forward after license evidence was accepted.',
          href: '/holder/readiness',
          ctaLabel: 'Open readiness',
          relatedBlockerId: null,
          relatedApplicationId: null,
          relatedOpportunityId: null,
        },
      ],
    });

    mockState.context = createMockContext(data);
    const markup = renderToStaticMarkup(<ClinicianUpdatesSurface />);

    expect(markup).toContain('State continuity');
    expect(markup).toContain('License evidence verified');
    expect(markup).toContain('Your readiness moved forward after license evidence was accepted.');
    expect(markup).toContain('Open readiness');
  });
});

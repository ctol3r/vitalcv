import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import ClinicianHomeSurface from '../components/mobile/ClinicianHomeSurface';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    redirect: vi.fn(), usePathname: () => '/holder/home',
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

// CareerCompass now falls back to the Clerk account first name for the
// greeting; render signed-out here so the fixture's profile name drives it.
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
}));

vi.mock('../components/explore/ApplyModal', () => ({
  default: () => null,
}));

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
        completeness: 84,
      },
    },
    trustState: {
      npi: '1234567890',
      readinessLevel: 'L2',
      readinessScore: 84,
      readinessStatus: 'Mostly ready - minor gaps remain',
      trustBand: 'L2',
      trustScore: 84,
      gapSummary: ['DEA registration not verified'],
      computedAt: '2026-03-20T10:30:00.000Z',
      cached: false,
    },
    applications: [
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'REVIEWED',
        createdAt: '2026-03-19T08:00:00.000Z',
        updatedAt: '2026-03-19T10:00:00.000Z',
        reviewedAt: '2026-03-19T10:00:00.000Z',
        reviewNote: 'Employer review is active.',
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
          readinessStatus: 'Mostly ready - minor gaps remain',
          gapSummary: ['DEA registration not verified'],
          keyCredentials: ['License'],
          trustSignals: ['NPI identity verified'],
        },
        latestRecommendation: {
          actionType: 'CONTINUE_REVIEW',
          label: 'Continue review',
          explanation: 'Employer review is active.',
        },
        timeline: [
          {
            stage: 'REVIEWED',
            occurredAt: '2026-03-19T10:00:00.000Z',
            description: 'Employer review is active.',
          },
        ],
        systemBehavesAutonomously: false,
      },
    ],
    opportunities: [
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
        createdAt: '2026-03-18T10:00:00.000Z',
        application: null,
        match: {
          opportunityId: 'opp_2',
          band: 'CLEAR',
          score: 92,
          blockers: [],
          fitReasons: ['ICU specialty', 'Oregon license'],
        },
      },
    ],
    missingForHigherMatches: ['DEA registration'],
    refreshedAt: '2026-03-20T10:30:00.000Z',
    profileCompleteness: {
      score: 84,
      dimensions: {
        npiVerified: true,
        resumeUploaded: true,
        linksAdded: true,
        workAuthProvided: true,
        credentialsImported: false,
      },
    },
    trustHistory: [],
    notifications: [
      {
        id: 'notification_1',
        type: 'application_status_changed',
        occurredAt: '2026-03-19T10:00:00.000Z',
        title: 'Application reviewed',
        body: 'Travel ICU Nurse is now in review.',
        href: '/holder/applications',
        ctaLabel: 'Open updates',
        relatedBlockerId: 'unresolved_verification:global:global:dea-registration-not-verified',
        relatedApplicationId: 'app_1',
        relatedOpportunityId: 'opp_1',
      },
    ],
    blockers: [
      {
        id: 'unresolved_verification:global:global:dea-registration-not-verified',
        type: 'unresolved_verification',
        title: 'Verification still unresolved',
        label: 'DEA registration not verified',
        detail: 'DEA registration not verified',
        explanation: 'This item is still preventing a fully clear readiness state.',
        href: '/holder/blockers/unresolved_verification%3Aglobal%3Aglobal%3Adea-registration-not-verified',
        nextActionLabel: 'Upload evidence',
        nextActionHref: '/holder/blockers/unresolved_verification%3Aglobal%3Aglobal%3Adea-registration-not-verified',
        occurredAt: '2026-03-20T10:30:00.000Z',
        relatedApplicationId: null,
        relatedOpportunityId: null,
        priority: 15,
      },
      {
        id: 'missing_credential:global:global:import-credential-evidence',
        type: 'missing_credential',
        title: 'Credential evidence missing',
        label: 'Import credential evidence',
        detail: 'Your readiness needs credential evidence attached.',
        explanation: 'Upload a supporting credential or document.',
        href: '/holder/blockers/missing_credential%3Aglobal%3Aglobal%3Aimport-credential-evidence',
        nextActionLabel: 'Upload evidence',
        nextActionHref: '/holder/blockers/missing_credential%3Aglobal%3Aglobal%3Aimport-credential-evidence',
        occurredAt: '2026-03-20T10:30:00.000Z',
        relatedApplicationId: null,
        relatedOpportunityId: null,
        priority: 20,
      },
    ],
    activeApplications: [
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'REVIEWED',
        createdAt: '2026-03-19T08:00:00.000Z',
        updatedAt: '2026-03-19T10:00:00.000Z',
        reviewedAt: '2026-03-19T10:00:00.000Z',
        reviewNote: 'Employer review is active.',
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
          readinessStatus: 'Mostly ready - minor gaps remain',
          gapSummary: ['DEA registration not verified'],
          keyCredentials: ['License'],
          trustSignals: ['NPI identity verified'],
        },
        latestRecommendation: {
          actionType: 'CONTINUE_REVIEW',
          label: 'Continue review',
          explanation: 'Employer review is active.',
        },
        timeline: [
          {
            stage: 'REVIEWED',
            occurredAt: '2026-03-19T10:00:00.000Z',
            description: 'Employer review is active.',
          },
        ],
        systemBehavesAutonomously: false,
      },
    ],
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
        createdAt: '2026-03-18T10:00:00.000Z',
        application: null,
        match: {
          opportunityId: 'opp_2',
          band: 'CLEAR',
          score: 92,
          blockers: [],
          fitReasons: ['ICU specialty', 'Oregon license'],
        },
      },
    ],
    recommendedAction: {
      kind: 'resolve_gap',
      title: 'Resolve your top blocker',
      description: 'DEA registration not verified',
      href: '/holder/blockers/unresolved_verification%3Aglobal%3Aglobal%3Adea-registration-not-verified',
      ctaLabel: 'Upload evidence',
    },
  };
}

describe('/holder/home page (A3 hierarchy)', () => {
  const markup = renderToStaticMarkup(
    <ClinicianMobileProvider initialData={buildSampleData()}>
      <ClinicianHomeSurface />
    </ClinicianMobileProvider>,
  );

  it('renders identity and sharing', () => {
    expect(markup).toContain('Your VitalCV profile');
    expect(markup).toContain('Ada Lovelace');
    expect(markup).toContain('NPI 1234567890');
    expect(markup).toContain('Share / prove');
    expect(markup).toContain('href="/verify/1234567890"');
  });

  it('keeps the strict section order: status → next action → ledger → waiting → application/role', () => {
    const order = [
      'Since your last visit',
      'Resolve your top blocker', // the one next action (from recommendedAction)
      'What happened in your workspace',
      '>Waiting<',
      'Opportunities available',
      'More in your workspace',
    ].map((needle) => markup.indexOf(needle));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('renders the work ledger from recorded events with the controller preserved', () => {
    expect(markup).toContain('Employer decides');
    expect(markup).toContain('Application reviewed');
    expect(markup).toContain('Needs you');
  });

  it('shows no metric that was not computed and explained — the widget era stays retired', () => {
    expect(markup).not.toContain('Proof of progress');
    expect(markup).not.toContain('Momentum');
    expect(markup).not.toContain('Other actions');
    expect(markup).not.toContain('Measured outcomes in your workspace');
    expect(markup).not.toContain('EVIDENCE · LIVE READ');
    expect(markup).not.toContain('vh-monitor');
    expect(markup).not.toMatch(/\d+\/100/);
    expect(markup).not.toMatch(/\d+% complete/);
    expect(markup).not.toContain('profile checks complete');
  });

  it('keeps demoted destinations reachable as quiet contextual links', () => {
    for (const href of ['/holder/readiness', '/holder/scoreboard', '/holder/timeline', '/holder/settings']) {
      expect(markup).toContain(`href="${href}"`);
    }
  });
});

describe('/holder/home page (unlinked clinician)', () => {
  it('renders honest empty states — no fabricated activity, score, or progress', () => {
    const data = buildSampleData();
    data.workspace = null;
    data.trustState = null;
    data.notifications = [];
    data.blockers = [];
    data.activeApplications = [];
    data.availableOpportunities = [];
    data.trustHistory = [];
    data.recommendedAction = null;
    data.profileCompleteness = null;

    const markup = renderToStaticMarkup(
      <ClinicianMobileProvider initialData={data}>
        <ClinicianHomeSurface />
      </ClinicianMobileProvider>,
    );

    expect(markup).toContain('Add your NPI to build your source-backed readiness.');
    expect(markup).toContain('Connect your NPI and recorded work will land here as it happens.');
    expect(markup).toContain('Nothing is waiting on you right now.');
    expect(markup).not.toMatch(/\d+\/100/);
    expect(markup).not.toContain('Analysis in progress');
  });
});

jest.mock('../../trust/trustStateEngine', () => ({
  getCachedTrustState: jest.fn(),
}));

import type { PrismaClient } from '@prisma/client';
import { getCachedTrustState } from '../../trust/trustStateEngine';
import {
  buildHiringTimeline,
  extractHiringAutomationMetadata,
  generateHiringAutomationActions,
  recommendationPreviewFromMetadata,
} from '../hiringAutomationService';

const getCachedTrustStateMock = getCachedTrustState as jest.MockedFunction<typeof getCachedTrustState>;

function makeTrustState(input: {
  npi: string;
  readinessScore: number;
  readinessLevel?: 'L0' | 'L1' | 'L2' | 'L3';
  gapSummary?: string[];
  identityVerified?: boolean;
  licensureStatus?: 'verified' | 'pending' | 'expired' | 'unknown';
  exclusionClear?: boolean;
  facts?: Array<{
    factType: string;
    source: string;
    status: string;
    details?: string;
  }>;
}) {
  return {
    npi: input.npi,
    identityVerified: input.identityVerified ?? true,
    licensureStatus: input.licensureStatus ?? 'verified',
    exclusionClear: input.exclusionClear ?? true,
    exclusionStatus: undefined,
    credentialCount: (input.facts ?? []).length,
    readiness_level: input.readinessLevel ?? 'L3',
    readiness_status: 'Ready for employer review',
    readiness_score: input.readinessScore,
    gap_summary: input.gapSummary ?? [],
    methodology_version: 'test',
    computed_at: '2026-03-19T12:00:00.000Z',
    trustBand: input.readinessLevel ?? 'L3',
    trustScore: input.readinessScore,
    facts: (input.facts ?? []).map((fact) => ({
      factType: fact.factType,
      source: fact.source,
      status: fact.status,
      details: fact.details,
    })),
    gaps: input.gapSummary ?? [],
    computedAt: '2026-03-19T12:00:00.000Z',
  };
}

function makeApplication(input: {
  id: string;
  npi: string;
  organizationId?: string;
  title?: string;
  automationRules?: Record<string, unknown>;
  requirements?: Array<{ label: string; level: string }>;
  status?: 'PENDING' | 'REVIEWED';
}) {
  return {
    id: input.id,
    opportunityId: `${input.id}-opp`,
    npi: input.npi,
    status: input.status ?? 'PENDING',
    opportunity: {
      id: `${input.id}-opp`,
      title: input.title ?? 'Cardiology Opening',
      organizationId: input.organizationId ?? 'org-1',
      organization: {
        name: 'General Hospital',
        organizationProfile: {
          requirements: {
            requirements: input.requirements ?? [{ label: 'CA License', level: 'L2' }],
            automationRules: {
              enabled: true,
              minReadinessScore: 60,
              requiredCredentials: ['CA License'],
              readyToInterviewThreshold: 85,
              autoAcceptThreshold: null,
              notifyEmployer: true,
              notifyClinician: true,
              ...input.automationRules,
            },
          },
        },
      },
    },
  };
}

function makePrisma(input: {
  applications: unknown[];
  findings?: unknown[];
  webhookEmployerIds?: string[];
}): PrismaClient {
  return {
    application: {
      findMany: jest.fn().mockResolvedValue(input.applications),
    },
    employerWebhookConfig: {
      findMany: jest.fn().mockResolvedValue(
        (input.webhookEmployerIds ?? []).map((employerId) => ({ employerId })),
      ),
    },
    investigatorFinding: {
      findMany: jest.fn().mockResolvedValue(input.findings ?? []),
    },
    outboxEvent: {
      upsert: jest.fn(),
    },
  } as unknown as PrismaClient;
}

describe('hiringAutomationService', () => {
  beforeEach(() => {
    getCachedTrustStateMock.mockReset();
  });

  it('generates ready, credential-request, risk, and continue-review actions from employer rules', async () => {
    const applications = [
      makeApplication({ id: 'app-ready', npi: '1234567890' }),
      makeApplication({
        id: 'app-missing',
        npi: '1234567891',
        requirements: [{ label: 'Board Certification', level: 'L2' }],
        automationRules: { requiredCredentials: ['Board Certification'] },
      }),
      makeApplication({ id: 'app-risk', npi: '1234567892' }),
      makeApplication({
        id: 'app-review',
        npi: '1234567893',
        automationRules: { readyToInterviewThreshold: 90 },
      }),
    ];

    const prisma = makePrisma({
      applications,
      webhookEmployerIds: ['org-1'],
      findings: [{
        findingId: 'finding-risk',
        title: 'Active sanction signal',
        summary: 'An active high-risk finding blocks employer progression.',
        severity: 'critical',
        status: 'new',
        storylineKey: 'risk:1234567892',
        entityIds: ['1234567892'],
      }],
    });

    getCachedTrustStateMock.mockImplementation(async (npi: string) => {
      switch (npi) {
        case '1234567890':
          return makeTrustState({
            npi,
            readinessScore: 92,
            facts: [{ factType: 'license', source: 'license_registry', status: 'verified', details: 'CA license active' }],
          }) as never;
        case '1234567891':
          return makeTrustState({
            npi,
            readinessScore: 76,
            gapSummary: ['Board certification missing'],
            facts: [{ factType: 'license', source: 'license_registry', status: 'verified', details: 'CA license active' }],
          }) as never;
        case '1234567892':
          return makeTrustState({
            npi,
            readinessScore: 90,
            facts: [{ factType: 'license', source: 'license_registry', status: 'verified', details: 'CA license active' }],
          }) as never;
        default:
          return makeTrustState({
            npi,
            readinessScore: 74,
            readinessLevel: 'L2',
            facts: [{ factType: 'license', source: 'license_registry', status: 'verified', details: 'CA license active' }],
          }) as never;
      }
    });

    const actions = await generateHiringAutomationActions('2026-03-19T12:00:00.000Z', prisma);
    const byApplicationId = new Map(
      actions.map((action) => {
        const metadata = extractHiringAutomationMetadata(action.metadata);
        return [metadata?.applicationId ?? action.actionId, action] as const;
      }),
    );

    expect(byApplicationId.get('app-ready')?.actionType).toBe('READY_TO_INTERVIEW');
    expect(byApplicationId.get('app-missing')?.actionType).toBe('REQUEST_CREDENTIAL');
    expect(byApplicationId.get('app-risk')?.actionType).toBe('RISK_ESCALATED');
    expect(byApplicationId.get('app-review')?.actionType).toBe('CONTINUE_REVIEW');

    const readyMetadata = extractHiringAutomationMetadata(byApplicationId.get('app-ready')?.metadata);
    expect(readyMetadata?.workflowEffects.webhookQueued).toBe(true);

    const missingMetadata = extractHiringAutomationMetadata(byApplicationId.get('app-missing')?.metadata);
    expect(missingMetadata?.workflowEffects.missingCredentials).toEqual(['Board Certification']);
    expect(missingMetadata?.workflowEffects.clinicianRequest).toBe(true);
  });

  it('stores auto-accept as preview metadata without changing the generated action type', async () => {
    const prisma = makePrisma({
      applications: [
        makeApplication({
          id: 'app-preview',
          npi: '1234567894',
          automationRules: {
            autoAcceptThreshold: 90,
          },
        }),
      ],
    });

    getCachedTrustStateMock.mockResolvedValue(
      makeTrustState({
        npi: '1234567894',
        readinessScore: 96,
        facts: [{ factType: 'license', source: 'license_registry', status: 'verified', details: 'CA license active' }],
      }) as never,
    );

    const [action] = await generateHiringAutomationActions('2026-03-19T12:00:00.000Z', prisma);
    const metadata = extractHiringAutomationMetadata(action?.metadata);

    expect(action?.actionType).toBe('READY_TO_INTERVIEW');
    expect(metadata?.previewActionType).toBe('ACCEPT_RECOMMENDED');
    expect(metadata?.previewRecommendationLabel).toBe('Recommend acceptance');
  });

  it('builds recommendation previews and accepted timelines from automation metadata', () => {
    const preview = recommendationPreviewFromMetadata({
      autoGenerated: true,
      applicationId: 'app-1',
      opportunityId: 'opp-1',
      organizationId: 'org-1',
      organizationName: 'General Hospital',
      providerNpi: '1234567890',
      providerLabel: 'Ada Lovelace',
      recommendationLabel: 'Move to interview',
      recommendationConfidence: 0.92,
      workflowEffects: {
        queueDestination: 'interview_queue',
        missingCredentials: [],
        employerNotification: true,
        clinicianRequest: false,
        webhookEligible: true,
        webhookQueued: true,
      },
      previewActionType: 'ACCEPT_RECOMMENDED',
      previewRecommendationLabel: 'Recommend acceptance',
      previewRecommendationConfidence: 0.95,
    }, 'READY_TO_INTERVIEW', 'Provider is ready for interview.', '2026-03-19T12:00:00.000Z');

    const timeline = buildHiringTimeline({
      status: 'ACCEPTED',
      createdAt: '2026-03-18T12:00:00.000Z',
      reviewedAt: '2026-03-19T12:00:00.000Z',
      updatedAt: '2026-03-19T12:30:00.000Z',
      latestRecommendation: preview,
      acceptedAt: '2026-03-19T13:00:00.000Z',
    });

    expect(preview?.previewDecision?.actionType).toBe('ACCEPT_RECOMMENDED');
    expect(timeline.map((event) => event.stage)).toEqual(['applied', 'verified', 'reviewed', 'accepted']);
    expect(timeline.at(-1)?.occurredAt).toBe('2026-03-19T13:00:00.000Z');
  });
});

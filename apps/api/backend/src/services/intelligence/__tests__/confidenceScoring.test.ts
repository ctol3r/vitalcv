jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    learningEvent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../entity/passportService', () => ({
  buildPassportByNpi: jest.fn(),
}));

jest.mock('../../registry/trustRegistry', () => ({
  getIssuer: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { buildPassportByNpi } from '../../entity/passportService';
import { getIssuer } from '../../registry/trustRegistry';
import { deriveLearningSignal } from '../confidenceScoring';

const prismaMock = prisma as unknown as {
  learningEvent: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
};

const buildPassportByNpiMock = buildPassportByNpi as jest.MockedFunction<typeof buildPassportByNpi>;
const getIssuerMock = getIssuer as jest.MockedFunction<typeof getIssuer>;

function buildPassport(overrides?: Partial<Awaited<ReturnType<typeof buildPassportByNpi>>>): NonNullable<Awaited<ReturnType<typeof buildPassportByNpi>>> {
  return {
    entityId: 'entity-1',
    clinicianNpi: '1234567890',
    identity: { entityId: 'entity-1', displayName: 'Dr. Test', npi: '1234567890', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE' },
    authority: { credentials: [], summary: { active: 1, expired: 0, stale: 0, missing: [] } },
    training: { records: [], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      licensureStatus: 'verified',
      deaStatus: 'registered',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: null,
      negativeFindings: [],
    },
    readiness: { status: 'READY', score: 88, readiness_score: 88, level: 'L3', blockers: [], gaps: [], nextActions: [], estimatedStartDays: 5 },
    sources: { checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD'], lastFetch: {} },
    trustPosture: {
      band: 'L3',
      bandLabel: 'READY',
      score: 88,
      dimensions: [],
      freshness: { state: 'current', label: 'Current', items: [] },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    },
    sourceCoverage: {
      checks: [
        { sourceId: 'NPPES_API', state: 'checked', reason: 'ok', freshness: { status: 'current', checkedAt: null, observedAt: null, expiresAt: null, freshnessWindowHours: 24 } },
        { sourceId: 'OIG_LEIE', state: 'checked', reason: 'ok', freshness: { status: 'current', checkedAt: null, observedAt: null, expiresAt: null, freshnessWindowHours: 24 } },
        { sourceId: 'PECOS_PUBLIC', state: 'checked', reason: 'ok', freshness: { status: 'current', checkedAt: null, observedAt: null, expiresAt: null, freshnessWindowHours: 24 } },
        { sourceId: 'STATE_BOARD', state: 'checked', reason: 'ok', freshness: { status: 'current', checkedAt: null, observedAt: null, expiresAt: null, freshnessWindowHours: 24 } },
      ],
      summary: {
        checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD'],
        stale: [],
        pending: [],
        gated: [],
        unavailable: [],
        accessRequired: [],
        reviewRequired: [],
        notDecisionGrade: [],
        previewOnly: [],
      },
    },
    truth: {
      identity: { kind: 'verification', status: 'VERIFIED', satisfied: true, decisionGrade: true, coverage: { sourceId: 'NPPES_API', state: 'checked', reason: 'ok' } },
      safety: { kind: 'clearance', status: 'CLEAR', satisfied: true, decisionGrade: true, coverage: { sourceId: 'OIG_LEIE', state: 'checked', reason: 'ok' } },
      authority: { kind: 'verification', status: 'VERIFIED', satisfied: true, decisionGrade: true, coverage: { sourceId: 'STATE_BOARD', state: 'checked', reason: 'ok' } },
      eligibility: { kind: 'enrollment', status: 'ENROLLED', satisfied: true, decisionGrade: true, coverage: { sourceId: 'PECOS_PUBLIC', state: 'checked', reason: 'ok' } },
    },
    lastCheckedAt: '2026-04-14T00:00:00.000Z',
    decision: {
      decision: 'PROCEED',
      confidence: 0.9,
      rationale: [],
      blockers: [],
      next_actions: [],
    },
    ...overrides,
  } as NonNullable<Awaited<ReturnType<typeof buildPassportByNpi>>>;
}

describe('deriveLearningSignal', () => {
  beforeEach(() => {
    prismaMock.learningEvent.findFirst.mockReset();
    prismaMock.learningEvent.findMany.mockReset();
    buildPassportByNpiMock.mockReset();
    getIssuerMock.mockReset();
    getIssuerMock.mockReturnValue({
      issuerId: 'issuer',
      issuerName: 'Issuer',
      publicKey: '',
      trustLevel: 'AUTHORITATIVE',
      status: 'ACTIVE',
      registeredAt: '2026-01-01T00:00:00.000Z',
      trustScore: 95,
    });
  });

  it('returns LOW confidence when the historical sample is too small', async () => {
    buildPassportByNpiMock.mockResolvedValue(buildPassport());
    prismaMock.learningEvent.findFirst.mockResolvedValue({
      metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [] },
    });
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [], outcome: 'START_ACTIVATED', timeToStartDays: 4 } },
    ]);

    const signal = await deriveLearningSignal('1234567890');

    expect(signal.confidenceBand).toBe('LOW');
    expect(signal.recommendedActionBias).toBe('REVIEW');
    expect(signal.lowSample).toBe(true);
  });

  it('downgrades confidence when critical source freshness is stale', async () => {
    buildPassportByNpiMock.mockResolvedValue(buildPassport({
      sourceCoverage: {
        checks: [
          { sourceId: 'NPPES_API', state: 'checked', reason: 'ok', freshness: { status: 'current', checkedAt: null, observedAt: null, expiresAt: null, freshnessWindowHours: 24 } },
          { sourceId: 'OIG_LEIE', state: 'stale', reason: 'stale', freshness: { status: 'stale', checkedAt: null, observedAt: null, expiresAt: null, freshnessWindowHours: 24 } },
          { sourceId: 'PECOS_PUBLIC', state: 'checked', reason: 'ok', freshness: { status: 'current', checkedAt: null, observedAt: null, expiresAt: null, freshnessWindowHours: 24 } },
          { sourceId: 'STATE_BOARD', state: 'checked', reason: 'ok', freshness: { status: 'current', checkedAt: null, observedAt: null, expiresAt: null, freshnessWindowHours: 24 } },
        ],
        summary: {
          checked: ['NPPES_API', 'PECOS_PUBLIC', 'STATE_BOARD'],
          stale: ['OIG_LEIE'],
          pending: [],
          gated: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: [],
          notDecisionGrade: [],
          previewOnly: [],
        },
      },
    }));
    prismaMock.learningEvent.findFirst.mockResolvedValue({
      metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [] },
    });
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [], outcome: 'START_ACTIVATED', timeToStartDays: 4 } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [], outcome: 'START_ACTIVATED', timeToStartDays: 5 } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [], outcome: 'START_ACTIVATED', timeToStartDays: 3 } },
    ]);

    const signal = await deriveLearningSignal('1234567890');

    expect(signal.confidenceBand).toBe('MEDIUM');
    expect(signal.freshnessScore).toBeLessThan(0.85);
  });

  it('drops to MEDIUM or LOW when outcomes conflict', async () => {
    buildPassportByNpiMock.mockResolvedValue(buildPassport());
    prismaMock.learningEvent.findFirst.mockResolvedValue({
      metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: ['STATE_LICENSE'] },
    });
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: ['STATE_LICENSE'], outcome: 'START_ACTIVATED', timeToStartDays: 4 } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: ['STATE_LICENSE'], outcome: 'DRIFT_OCCURRED' } },
      { eventType: 'EMPLOYER_REJECTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: ['STATE_LICENSE'], outcome: 'FAILURE' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: ['STATE_LICENSE'], outcome: 'START_ACTIVATED', timeToStartDays: 6 } },
    ]);

    const signal = await deriveLearningSignal('1234567890');

    expect(['MEDIUM', 'LOW']).toContain(signal.confidenceBand);
    expect(signal.varianceScore).not.toBeNull();
    expect(signal.varianceScore).toBeLessThan(0.35);
  });

  it('ignores malformed learning rows instead of throwing', async () => {
    buildPassportByNpiMock.mockResolvedValue(buildPassport());
    prismaMock.learningEvent.findFirst.mockResolvedValue({
      metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [] },
    });
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: 'not-an-object' },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [], outcome: 'START_ACTIVATED', timeToStartDays: 5 } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [], outcome: 'START_ACTIVATED', timeToStartDays: 4 } },
      { eventType: 'EMPLOYER_REJECTED', metadata: { role: 'Hospitalist', orgType: 'CREDENTIALING', readinessLevel: 'L3', missingLanes: [], outcome: 'FAILURE' } },
    ]);

    const signal = await deriveLearningSignal('1234567890');

    expect(signal.expectedOutcome.sampleSize).toBe(3);
    expect(signal.reason).toBeTruthy();
  });
});

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    learningEvent: { findMany: jest.fn() },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../confidenceScoring', () => ({
  deriveLearningSignal: jest.fn(async () => ({
    recommendedActionBias: 'REVERIFY',
    riskLevel: 'MEDIUM',
    expectedOutcome: {
      successRate: null,
      failureRate: null,
      avgTimeToStartDays: null,
      sampleSize: 0,
    },
    confidenceBand: 'MEDIUM',
    confidenceScore: 0.5,
    evidenceCompleteness: 1,
    freshnessScore: 1,
    issuerTrustScore: 0.9,
    historicalSuccessRate: null,
    varianceScore: null,
    lowSample: true,
    reason: 'neutral mock signal',
  })),
}));

import prisma from '../../../graphql/prisma_client';
import { deriveNextBestAction } from '../nextBestAction';
import { deriveLearningSignal } from '../confidenceScoring';

const prismaMock = prisma as unknown as {
  learningEvent: { findMany: jest.Mock };
};
const deriveLearningSignalMock = deriveLearningSignal as jest.MockedFunction<typeof deriveLearningSignal>;
const DEFAULT_SIGNAL = {
  recommendedActionBias: 'REVERIFY',
  riskLevel: 'MEDIUM',
  expectedOutcome: {
    successRate: null,
    failureRate: null,
    avgTimeToStartDays: null,
    sampleSize: 0,
  },
  confidenceBand: 'MEDIUM',
  confidenceScore: 0.5,
  evidenceCompleteness: 1,
  freshnessScore: 1,
  issuerTrustScore: 0.9,
  historicalSuccessRate: null,
  varianceScore: null,
  lowSample: true,
  reason: 'neutral mock signal',
} as const;

describe('deriveNextBestAction', () => {
  beforeEach(() => {
    prismaMock.learningEvent.findMany.mockReset();
    deriveLearningSignalMock.mockReset();
    deriveLearningSignalMock.mockResolvedValue({ ...DEFAULT_SIGNAL });
  });

  it('returns the safe default when no learning rows exist', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([]);
    deriveLearningSignalMock.mockResolvedValue({
      recommendedActionBias: 'REVIEW',
      riskLevel: 'HIGH',
      expectedOutcome: {
        successRate: null,
        failureRate: null,
        avgTimeToStartDays: null,
        sampleSize: 0,
      },
      confidenceBand: 'LOW',
      confidenceScore: 0.2,
      evidenceCompleteness: 0,
      freshnessScore: 0,
      issuerTrustScore: 0,
      historicalSuccessRate: null,
      varianceScore: null,
      lowSample: true,
      reason: 'low sample',
    });
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('REVIEW_MANUALLY');
    expect(nba.evidenceCount).toBe(0);
    expect(nba.confidence).toBeGreaterThan(0);
    expect(nba.confidenceBand).toBe('LOW');
  });

  it('returns the safe default and logs warn when prisma throws', async () => {
    prismaMock.learningEvent.findMany.mockRejectedValue(new Error('db'));
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('REVIEW_MANUALLY');
  });

  it('escalates when 2+ drift outcomes dominate', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'DRIFT_OCCURRED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'DRIFT_OCCURRED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
    ]);
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('ESCALATE');
    expect(nba.evidenceCount).toBe(3);
    expect(nba.confidence).toBeGreaterThan(0);
  });

  it('reverifies when EMPLOYER_REQUESTED_INFO dominates accepts', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_REQUESTED_INFO', metadata: {} },
      { eventType: 'EMPLOYER_REQUESTED_INFO', metadata: {} },
      { eventType: 'EMPLOYER_REQUESTED_INFO', metadata: {} },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: {} },
    ]);
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('REVERIFY');
  });

  it('proceeds when accepts + activations dominate', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'PENDING' } },
    ]);
    deriveLearningSignalMock.mockResolvedValue({
      recommendedActionBias: 'PROCEED',
      riskLevel: 'LOW',
      expectedOutcome: {
        successRate: 0.8,
        failureRate: 0.2,
        avgTimeToStartDays: 4,
        sampleSize: 5,
      },
      confidenceBand: 'HIGH',
      confidenceScore: 0.9,
      evidenceCompleteness: 1,
      freshnessScore: 1,
      issuerTrustScore: 0.95,
      historicalSuccessRate: 0.8,
      varianceScore: 0.6,
      lowSample: false,
      reason: 'strong signal',
    });
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('PROCEED');
    expect(nba.evidenceCount).toBe(3);
    expect(nba.confidenceBand).toBe('HIGH');
  });

  it('falls back to REVIEW_MANUALLY when history is mixed without dominance', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: {} },
      { eventType: 'EMPLOYER_REJECTED', metadata: {} },
    ]);
    deriveLearningSignalMock.mockResolvedValue({
      ...DEFAULT_SIGNAL,
      recommendedActionBias: 'REVIEW',
      confidenceBand: 'LOW',
      confidenceScore: 0.2,
      riskLevel: 'HIGH',
      reason: 'mixed recent outcomes',
    });
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('REVIEW_MANUALLY');
    expect(nba.evidenceCount).toBe(2);
  });

  it('safe default when clinicianNpi is empty', async () => {
    const nba = await deriveNextBestAction('');
    expect(nba.action).toBe('REVIEW_MANUALLY');
    expect(prismaMock.learningEvent.findMany).not.toHaveBeenCalled();
  });

  it('downgrades a proceed recommendation to manual review when confidence is low', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'PENDING' } },
    ]);
    deriveLearningSignalMock.mockResolvedValue({
      recommendedActionBias: 'REVIEW',
      riskLevel: 'HIGH',
      expectedOutcome: {
        successRate: 0.4,
        failureRate: 0.6,
        avgTimeToStartDays: null,
        sampleSize: 4,
      },
      confidenceBand: 'LOW',
      confidenceScore: 0.2,
      evidenceCompleteness: 0.5,
      freshnessScore: 0.4,
      issuerTrustScore: 0.7,
      historicalSuccessRate: 0.4,
      varianceScore: 0.2,
      lowSample: false,
      reason: 'stale and mixed',
    });

    const nba = await deriveNextBestAction('1234567890');

    expect(nba.action).toBe('REVIEW_MANUALLY');
    expect(nba.riskLevel).toBe('HIGH');
  });

  it('keeps the same truth recommendation while shifting emphasis by actor type', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'PENDING' } },
    ]);
    deriveLearningSignalMock.mockResolvedValue({
      recommendedActionBias: 'PROCEED',
      riskLevel: 'MEDIUM',
      expectedOutcome: {
        successRate: 0.75,
        failureRate: 0.25,
        avgTimeToStartDays: 6,
        sampleSize: 8,
      },
      confidenceBand: 'HIGH',
      confidenceScore: 0.88,
      evidenceCompleteness: 1,
      freshnessScore: 1,
      issuerTrustScore: 0.95,
      historicalSuccessRate: 0.75,
      varianceScore: 0.55,
      lowSample: false,
      reason: 'strong recent outcomes',
    });

    const passport = {
      decision: {
        decision: 'PROCEED_WITH_CAUTION',
        confidence: 86,
        rationale: ['State board confirms an active license.'],
        blockers: ['PECOS confirmation is due for refresh.'],
        next_actions: ['Refresh PECOS confirmation.'],
      },
      readiness: {
        blockers: ['PECOS confirmation is due for refresh.'],
        nextActions: [
          {
            id: 'refresh-pecos',
            title: 'Refresh PECOS confirmation',
            detail: 'Run a fresh PECOS check before sharing this profile.',
            priority: 'HIGH',
          },
        ],
      },
    } as any;

    const clinician = await deriveNextBestAction('1234567890', {
      actorType: 'clinician',
      passport,
    });
    const employer = await deriveNextBestAction('1234567890', {
      actorType: 'employer',
      passport,
    });

    expect(clinician.action).toBe(employer.action);
    expect(clinician.confidence).toBe(employer.confidence);
    expect(clinician.evidenceCount).toBe(employer.evidenceCount);
    expect(clinician.summary).toContain('Improve readiness');
    expect(clinician.blockers).toContain('PECOS confirmation is due for refresh.');
    expect(employer.summary).toContain('Decision: Proceed with caution');
    expect(employer.summary).toContain('Risk: Moderate');
    expect(employer.summary).toContain('Next action: Refresh PECOS confirmation.');
    expect(employer.highlights).toContain('State board confirms an active license.');
  });
});

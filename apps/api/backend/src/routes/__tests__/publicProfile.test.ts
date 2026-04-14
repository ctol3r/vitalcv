import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    auditEvent: {
      findMany: jest.fn(),
    },
    trustAlertRecord: {
      aggregate: jest.fn(),
    },
    actionLog: {
      findMany: jest.fn(),
    },
    acceptance: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/publicSafety', () => ({
  publicApiRateLimit: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../services/intelligence/graphRagEvaluator', () => ({
  ReadinessEvaluator: jest.fn().mockImplementation(() => ({
    evaluateCandidate: jest.fn().mockResolvedValue({
      isEligible: true,
      missingRequirements: [],
      reasoningTrace: ['ready'],
    }),
  })),
}));

jest.mock('../../services/passport/npiPassportContract', () => ({
  buildPassportDataByNpi: jest.fn(),
}));

jest.mock('../../services/predictions/predictionEngineService', () => ({
  getPredictionSummaryForEntity: jest.fn().mockResolvedValue({
    available: true,
    total: 1,
    updatedAt: '2026-03-04T00:00:00.000Z',
    topPrediction: {
      id: 'pred_provider_1234567890',
      type: 'TRUST_RISK_ACCELERATION',
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: 'Provider 1234567890',
      state: 'watch',
      score: 0.71,
      confidence: 0.82,
      explanation: 'Forecast: Trust risk acceleration is Watch.',
      signals: [
        {
          label: 'trust_score_velocity',
          value: 6,
          direction: 'UP',
          source: 'TRUST_SCORE_HISTORY',
        },
      ],
      createdAt: '2026-03-04T00:00:00.000Z',
      updatedAt: '2026-03-04T00:00:00.000Z',
      forecast: true,
      insufficientSignal: false,
      summary: 'Trust risk acceleration is Watch because trust score velocity is elevated.',
      predictionId: 'pred_provider_1234567890',
      predictionType: 'TRUST_RISK_ACCELERATION',
      probability: 0.71,
      targetEntity: {
        entityType: 'provider',
        entityId: '1234567890',
        entityLabel: 'Provider 1234567890',
      },
      timeHorizon: '45d',
      evidenceSignals: [
        {
          label: 'trust_score_velocity',
          value: 6,
          direction: 'UP',
          source: 'TRUST_SCORE_HISTORY',
        },
      ],
      metadata: {
        state: 'watch',
      },
    },
    predictions: [],
    byType: [{ key: 'TRUST_RISK_ACCELERATION', count: 1 }],
    byState: [{ key: 'watch', count: 1 }],
  }),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { registerPublicProfileRoutes } from '../publicProfile';
import { buildPassportDataByNpi } from '../../services/passport/npiPassportContract';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  auditEvent: {
    findMany: jest.Mock;
  };
  trustAlertRecord: {
    aggregate: jest.Mock;
  };
  actionLog: {
    findMany: jest.Mock;
  };
  acceptance: {
    findMany: jest.Mock;
  };
};

const buildPassportDataByNpiMock = buildPassportDataByNpi as jest.MockedFunction<typeof buildPassportDataByNpi>;

function fakePassportData(): Awaited<ReturnType<typeof buildPassportDataByNpi>> {
  return {
    entityId: '1234567890',
    npi: '1234567890',
    credentials: [],
    identity: {
      entityId: '1234567890',
      displayName: 'Clinician 1234567890',
      npi: '1234567890',
      specialty: 'Cardiology',
      entityType: 'PERSON',
      status: 'ACTIVE',
    },
    authority: { credentials: [], summary: { active: 0, expired: 0, stale: 0, missing: [] } },
    training: { records: [], hasDegree: false, degreeVerified: false, hasResidency: false, fellowshipCount: 0 },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-01T00:00:00.000Z',
      exclusionConfidenceLabel: 'HIGH',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS (public)',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentSourceLatency: 'Quarterly snapshot',
      enrollmentNote: '',
      enrollmentObservedAt: '2026-03-01T00:00:00.000Z',
      enrollmentDataVersion: '',
      enrollmentStatusLabel: 'Enrolled',
      enrollmentFreshnessLabel: 'Current',
      enrollmentConfidenceLabel: 'HIGH',
      negativeFindings: [],
    },
    readiness: {
      status: 'READY',
      score: 88,
      readiness_score: 88,
      level: 'L3',
      blockers: [],
      gaps: [],
      nextActions: [],
      estimatedStartDays: 3,
    },
    sources: { checked: [], lastFetch: {} },
    sourceCoverage: { checks: [], summary: { checked: 0, pending: 0, reviewRequired: 0, stale: 0 } as never },
    truth: { identity: [], authority: [], standing: [], eligibility: [] } as never,
    trustPosture: {
      level: 'L3',
      label: 'Verified',
      summary: 'Verified across all dimensions.',
      dimensions: [],
      freshness: { state: 'current', label: 'Current', items: [] },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    },
    decisionPosture: {
      status: 'READY',
      headline: 'All decision-grade sources checked.',
      proven: [],
      missing: [],
      blockers: [],
      freshness: { state: 'current', label: 'Current', items: [] },
      nextAction: 'Accept as head start.',
    },
    decision: {
      decision: 'PROCEED',
      confidence: 88,
      rationale: ['All decision-grade sources checked.'],
      blockers: [],
      next_actions: ['Accept as head start.'],
    },
    lastCheckedAt: '2026-03-01T00:00:00.000Z',
  } as never;
}

function createApp() {
  const app = express();
  app.use(express.json());
  registerPublicProfileRoutes(app);
  return app;
}

describe('public profile routes', () => {
  beforeEach(() => {
    prismaMock.verificationArtifact.findFirst.mockReset();
    prismaMock.verificationArtifact.findMany.mockReset();
    prismaMock.auditEvent.findMany.mockReset();
    prismaMock.trustAlertRecord.aggregate.mockReset();
    prismaMock.actionLog.findMany.mockReset();
    prismaMock.actionLog.findMany.mockResolvedValue([]);
    prismaMock.acceptance.findMany.mockReset();
    prismaMock.acceptance.findMany.mockResolvedValue([]);
    buildPassportDataByNpiMock.mockReset();
    buildPassportDataByNpiMock.mockResolvedValue(fakePassportData());
  });

  it('returns a redacted public NPI profile with trust band, provenance, monitoring, and proof links', async () => {
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        id: 'artifact-1',
        source: 'NURSYS',
        status: 'ACTIVE',
        lifecycleState: 'active',
        statusListIndex: null,
        verifiedAt: new Date('2026-03-02T00:00:00.000Z'),
        expiresAt: new Date('2027-03-02T00:00:00.000Z'),
        checksum: 'checksum-1234567890',
        monitoring: true,
        rawPayload: {
          jurisdiction: 'CA',
          licenseNumber: 'A12345',
          specialty: 'Cardiology',
        },
        merkleRoot: 'merkle-root-1',
      },
    ]);
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        type: 'VERIFICATION_COMPLETED',
        hash: 'audit-hash-1',
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
      },
    ]);
    prismaMock.trustAlertRecord.aggregate.mockResolvedValue({
      _count: { _all: 1 },
      _max: { createdAt: new Date('2026-03-04T00:00:00.000Z') },
    });

    const response = await request(createApp())
      .get('/api/public/profile/npi/1234567890')
      .expect(200);

    expect(response.body.trustBand).toBe('L3');
    expect(response.body.readinessScore).toBe(88);
    expect(response.body.artifactSummaries[0]).toEqual(expect.objectContaining({
      issuer: 'NURSYS',
      monitoring: true,
    }));
    expect(response.body.issuerProvenance[0]).toEqual(expect.objectContaining({
      issuer: 'NURSYS',
      monitored: true,
    }));
    expect(response.body.monitoringSummary).toEqual(expect.objectContaining({
      monitoredArtifactCount: 1,
      totalArtifactCount: 1,
      activeAlertCount: 1,
    }));
    expect(response.body.proof).toEqual({
      jsonUrl: '/api/trust-proof/1234567890',
      pdfUrl: '/api/trust-proof/1234567890?format=pdf',
      auditBundleJson: '/api/artifact/bundle/1234567890',
      auditBundleDownload: '/api/artifact/bundle/1234567890/download',
    });
    expect(response.body.predictionSummary).toEqual(expect.objectContaining({
      available: true,
      total: 1,
      topPrediction: expect.objectContaining({
        type: 'TRUST_RISK_ACCELERATION',
        state: 'watch',
      }),
    }));
    expect(response.body).not.toHaveProperty('wallet');
    expect(JSON.stringify(response.body)).not.toContain('licenseNumber');
    expect(JSON.stringify(response.body)).not.toContain('A12345');

    // Canonical additive fields sourced from buildPassportDataByNpi
    expect(response.body.decision).toEqual(expect.objectContaining({
      decision: 'PROCEED',
      confidence: 88,
      blockers: [],
    }));
    expect(response.body).toHaveProperty('coverage');
    expect(response.body).toHaveProperty('claims');
    expect(response.body.limitations).toEqual({ blockers: [], gaps: [] });
    expect(response.body.actions).toEqual({ recent: [] });
    expect(response.body.reuse_signal).toEqual({
      accepted_count: 0,
      flagged_count: 0,
      request_data_count: 0,
      last_action: null,
      last_action_at: null,
    });
  });

  it('returns 404 when passport data is unavailable', async () => {
    buildPassportDataByNpiMock.mockResolvedValue(null);
    const response = await request(createApp())
      .get('/api/public/profile/npi/1234567890')
      .expect(404);
    expect(response.body.error).toBe('passport_not_found');
  });

  it('rejects invalid NPIs', async () => {
    const response = await request(createApp())
      .get('/api/public/profile/npi/not-an-npi')
      .expect(400);

    expect(response.body.error).toBe('invalid_npi');
  });
});

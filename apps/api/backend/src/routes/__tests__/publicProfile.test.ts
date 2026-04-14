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

jest.mock('../../services/trust/trustStateEngine', () => ({
  computeClinicianTrustState: jest.fn().mockResolvedValue({
    npi: '1234567890',
    identityVerified: true,
    licensureStatus: 'verified',
    exclusionClear: true,
    credentialCount: 1,
    readiness_level: 'L2',
    readiness_status: 'ready',
    readiness_score: 76,
    gap_summary: [],
    methodology_version: '243.1',
    computed_at: '2026-03-01T00:00:00.000Z',
    trustBand: 'L2',
    trustScore: 76,
    facts: [],
    gaps: [],
    computedAt: '2026-03-01T00:00:00.000Z',
  }),
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
};

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
  });

  it('returns a redacted public NPI profile with trust band, provenance, monitoring, and proof links', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      rawPayload: {
        npi: '1234567890',
        readiness_level: 'L3',
        readiness_score: 88,
        methodology_version: '243.1',
        computed_at: '2026-03-01T00:00:00.000Z',
      },
    });
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
  });

  it('rejects invalid NPIs', async () => {
    const response = await request(createApp())
      .get('/api/public/profile/npi/not-an-npi')
      .expect(400);

    expect(response.body.error).toBe('invalid_npi');
  });
});

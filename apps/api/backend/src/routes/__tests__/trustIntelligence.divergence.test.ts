import express from 'express';
import request from 'supertest';

const mockComputeTrustScoreV1 = jest.fn();
const mockBatchTrustScore = jest.fn();
const mockComputeTrustFreshness = jest.fn();
const mockDetectDivergence = jest.fn();
const mockBatchDivergenceScan = jest.fn();
const mockListDivergenceHistory = jest.fn();
const mockResolveDivergenceConflict = jest.fn();
const mockRecordFreshnessDecaySignals = jest.fn();
const mockRecordTrustScoreSnapshot = jest.fn();
const mockSyncDivergenceReport = jest.fn();
const mockLog = jest.fn();

jest.mock('../../services/trust/trustScoreV1', () => ({
  computeTrustScoreV1: mockComputeTrustScoreV1,
  batchTrustScore: mockBatchTrustScore,
  TRUST_SCORE_VERSION: 'trust-score-v1',
  DIMENSION_WEIGHTS: {
    sourceReliability: 25,
    evidenceFreshness: 20,
  },
}));

jest.mock('../../services/identity/freshnessModel', () => ({
  computeTrustFreshness: mockComputeTrustFreshness,
}));

jest.mock('../../services/identity/divergenceEngine', () => ({
  detectDivergence: mockDetectDivergence,
  batchDivergenceScan: mockBatchDivergenceScan,
  listDivergenceHistory: mockListDivergenceHistory,
  resolveDivergenceConflict: mockResolveDivergenceConflict,
}));

jest.mock('../../services/intelligence/intelligenceEngineService', () => ({
  recordFreshnessDecaySignals: mockRecordFreshnessDecaySignals,
  recordTrustScoreSnapshot: mockRecordTrustScoreSnapshot,
  syncDivergenceReport: mockSyncDivergenceReport,
}));

jest.mock('../../obs/logger', () => ({
  log: mockLog,
}));

import { registerTrustIntelligenceRoutes } from '../trustIntelligence';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerTrustIntelligenceRoutes(app);
  return app;
}

describe('trustIntelligence divergence routes', () => {
  beforeEach(() => {
    mockComputeTrustScoreV1.mockReset();
    mockBatchTrustScore.mockReset();
    mockComputeTrustFreshness.mockReset();
    mockDetectDivergence.mockReset();
    mockBatchDivergenceScan.mockReset();
    mockListDivergenceHistory.mockReset();
    mockResolveDivergenceConflict.mockReset();
    mockRecordFreshnessDecaySignals.mockReset();
    mockRecordTrustScoreSnapshot.mockReset();
    mockSyncDivergenceReport.mockReset();
    mockLog.mockReset();
  });

  it('returns the divergence report and syncs it into intelligence history', async () => {
    mockDetectDivergence.mockResolvedValue({
      npi: '1234567890',
      computedAt: '2026-04-01T12:00:00.000Z',
      conflicts: [
        {
          id: 'div_1',
          ruleId: 'NAME_MISMATCH',
          claimType: 'PERSONAL_IDENTITY',
          dimension: 'identity',
          severity: 'HIGH',
          description: 'Authoritative sources disagree on provider name.',
          sources: ['NPPES_API', 'STATE_BOARD'],
          values: ['NPPES_API: Ada Lovelace', 'STATE_BOARD: Ada Byron'],
          detectedAt: '2026-04-01T12:00:00.000Z',
          penalty: 15,
          basePenalty: 15,
          active: true,
          requiresReview: true,
          resolution: 'OPEN',
        },
      ],
      totalPenalty: 15,
      hasBlocking: true,
      summary: '1 active divergence. Active CRS penalty: -15.',
      rulesFired: ['NAME_MISMATCH'],
    });

    const app = buildApp();
    const response = await request(app).get('/api/trust/divergence/1234567890').expect(207);

    expect(response.body.schema).toBe('https://vitalcv.com/trust-divergence/v1');
    expect(response.body.totalPenalty).toBe(15);
    expect(mockSyncDivergenceReport).toHaveBeenCalledWith(expect.objectContaining({
      subjectType: 'NPI',
      subjectId: '1234567890',
      conflicts: [
        expect.objectContaining({
          id: 'div_1',
          ruleId: 'NAME_MISMATCH',
          active: true,
        }),
      ],
    }));
  });

  it('returns divergence history', async () => {
    mockListDivergenceHistory.mockResolvedValue({
      npi: '1234567890',
      count: 1,
      openCount: 0,
      resolvedCount: 1,
      computedAt: '2026-04-01T12:00:00.000Z',
      history: [
        {
          conflictId: 'div_1',
          ruleId: 'NAME_MISMATCH',
          claimType: 'PERSONAL_IDENTITY',
          severity: 'HIGH',
          status: 'RESOLVED',
          description: 'Authoritative sources disagree on provider name.',
          sources: ['NPPES_API', 'STATE_BOARD'],
          values: ['NPPES_API: Ada Lovelace', 'STATE_BOARD: Ada Byron'],
          firstDetectedAt: '2026-04-01T12:00:00.000Z',
          lastDetectedAt: '2026-04-01T12:10:00.000Z',
          resolvedAt: '2026-04-01T12:20:00.000Z',
          occurrenceCount: 1,
          resolutionNote: 'Resolved after source refresh.',
        },
      ],
    });

    const app = buildApp();
    const response = await request(app).get('/api/trust/divergence/1234567890/history').expect(200);

    expect(response.body.schema).toBe('https://vitalcv.com/trust-divergence-history/v1');
    expect(response.body.resolvedCount).toBe(1);
  });

  it('requires an actor header to resolve and returns the resolution payload when provided', async () => {
    mockResolveDivergenceConflict.mockResolvedValue({
      npi: '1234567890',
      conflictId: 'div_1',
      resolution: 'RESOLVED',
      resolvedAt: '2026-04-01T12:20:00.000Z',
      auditEventId: 'audit-1',
      note: 'Resolved after source refresh.',
    });

    const app = buildApp();

    await request(app)
      .post('/api/trust/divergence/1234567890/div_1/resolve')
      .send({ note: 'Resolved after source refresh.' })
      .expect(401);

    const response = await request(app)
      .post('/api/trust/divergence/1234567890/div_1/resolve')
      .set('x-clerk-user-id', 'user_123')
      .send({ note: 'Resolved after source refresh.' })
      .expect(200);

    expect(response.body.schema).toBe('https://vitalcv.com/trust-divergence-resolution/v1');
    expect(response.body.auditEventId).toBe('audit-1');
    expect(mockResolveDivergenceConflict).toHaveBeenCalledWith({
      npi: '1234567890',
      conflictId: 'div_1',
      resolvedBy: 'user_123',
      note: 'Resolved after source refresh.',
    });
  });
});

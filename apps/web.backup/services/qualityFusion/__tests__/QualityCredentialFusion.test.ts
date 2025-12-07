import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPrisma = {
  qualityCredentialFusion: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  upsertQualityCredentialFusion,
  getQualityCredentialFusion,
  listQualityCredentialFusions,
  projectFusionResult,
} from '../models/QualityCredentialFusion';
import { FusionEngineResult } from '../types';

describe('QualityCredentialFusion model helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serializes and persists normalized payloads', async () => {
    const now = new Date('2025-11-15T00:00:00Z');
    mockPrisma.qualityCredentialFusion.upsert.mockResolvedValue({
      clinicianId: 'clin-123',
      compositeScore: 95,
      contributingQualitySignals: [],
      contributingCredentialSignals: [],
      complianceFindings: [],
      recommendedActions: ['Escalate to MEC'],
      ruleMatches: [],
      lastCalculatedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    await upsertQualityCredentialFusion({
      clinicianId: 'clin-123',
      compositeScore: 140,
      qualitySignals: [
        {
          type: 'OPPE_FAILURE',
          severity: 'HIGH',
          recommendedActions: ['Escalate to MEC', 'Escalate to MEC'],
        },
      ],
      credentialSignals: [
        {
          type: 'BOARD_STATUS_DRIFT',
          severity: 'MODERATE',
        },
      ],
      recommendedActions: ['Escalate to MEC', 'Page CMO'],
    });

    expect(mockPrisma.qualityCredentialFusion.upsert).toHaveBeenCalledTimes(1);
    const args = mockPrisma.qualityCredentialFusion.upsert.mock.calls[0][0];
    expect(args.create.compositeScore).toBe(100);
    expect(args.create.recommendedActions).toEqual(['Escalate to MEC', 'Page CMO']);
    expect(args.create.contributingQualitySignals[0]).toMatchObject({
      type: 'OPPE_FAILURE',
      severity: 'HIGH',
      source: 'QUALITY',
    });
  });

  it('returns null when record missing', async () => {
    mockPrisma.qualityCredentialFusion.findUnique.mockResolvedValue(null);
    const record = await getQualityCredentialFusion('missing');
    expect(record).toBeNull();
  });

  it('lists records with capped limit', async () => {
    mockPrisma.qualityCredentialFusion.findMany.mockResolvedValue([
      {
        clinicianId: 'clin-1',
        compositeScore: 55,
        contributingQualitySignals: [],
        contributingCredentialSignals: [],
        complianceFindings: [],
        recommendedActions: [],
        ruleMatches: [],
        lastCalculatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const records = await listQualityCredentialFusions(1000);
    expect(records).toHaveLength(1);
    expect(mockPrisma.qualityCredentialFusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    );
  });

  it('projects fusion engine result into upsert payloads', () => {
    const fusionResult: FusionEngineResult = {
      clinicianId: 'clin-55',
      compositeScore: 72,
      contributingQualitySignals: [
        {
          id: 'q1',
          label: 'OPPE failure',
          type: 'OPPE_FAILURE',
          severity: 'HIGH',
          source: 'QUALITY',
          weight: 20,
        },
      ],
      contributingCredentialSignals: [],
      complianceFindings: [],
      recommendedActions: ['Escalate'],
      ruleMatches: [],
      breakdown: {
        qualityScore: 30,
        credentialScore: 10,
        complianceScore: 5,
        ruleScore: 12,
        baselineContribution: 15,
      },
      timestamp: new Date('2025-11-15T12:00:00Z'),
    };

    const projected = projectFusionResult(fusionResult);
    expect(projected.clinicianId).toBe('clin-55');
    expect(projected.qualitySignals).toHaveLength(1);
    expect(projected.lastCalculatedAt?.toISOString()).toBe(
      '2025-11-15T12:00:00.000Z'
    );
  });
});



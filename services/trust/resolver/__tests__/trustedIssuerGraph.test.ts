import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AccreditationStatus, TrustEntityType } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { TrustedIssuerGraph } from '../trustedIssuerGraph';

const mockPrisma = {
  trustRegistry: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

const now = new Date();

const registryRecord = {
  id: 'trust-1',
  entityId: 'ca-medical-board',
  entityType: TrustEntityType.STATE_BOARD,
  did: 'did:web:trust.vitalcv/states/ca-medical-board',
  publicKeys: ['did:key:z6MkTest'],
  jurisdiction: 'CA',
  accreditationStatus: AccreditationStatus.ACCREDITED,
  metadata: {
    displayName: 'Medical Board of California',
    metrics: {
      verificationAccuracy: 0.99,
      freshnessHours: 8,
      uptimePercentage: 99.8,
    },
  },
  createdAt: now,
  updatedAt: now,
};

describe('TrustedIssuerGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns registry-backed state board for license credentials', async () => {
    (mockPrisma.trustRegistry.findMany as jest.Mock).mockResolvedValue([registryRecord]);
    const graph = new TrustedIssuerGraph(mockPrisma);
    const anchors = await graph.resolve({ kind: 'LICENSE', state: 'CA' });

    expect(anchors).toHaveLength(1);
    expect(anchors[0].source).toBe('registry');
    expect(anchors[0].credentialKind).toBe('LICENSE');
    expect(anchors[0].tier).toBe('ANCHOR');
  });

  it('falls back to ABMS when registry lacks board certification entry', async () => {
    (mockPrisma.trustRegistry.findMany as jest.Mock).mockResolvedValue([]);
    const graph = new TrustedIssuerGraph(mockPrisma);
    const anchors = await graph.resolve({ kind: 'BOARD_CERT', board: 'ABMS' });

    expect(anchors).toHaveLength(1);
    expect(anchors[0].entityId).toBe('abms');
    expect(anchors[0].source).toBe('globalFallback');
  });

  it('returns sanctions verifier fallback for OIG checks', async () => {
    (mockPrisma.trustRegistry.findMany as jest.Mock).mockResolvedValue([]);
    const graph = new TrustedIssuerGraph(mockPrisma);
    const anchors = await graph.resolve({ kind: 'SANCTIONS', authority: 'OIG' });

    expect(anchors).toHaveLength(1);
    expect(anchors[0].entityId).toBe('hhs-oig');
    expect(anchors[0].credentialKind).toBe('SANCTIONS');
  });
});


import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AccreditationStatus, TrustEntityType } from '@prisma/client';
import { registerTrustEntity, listTrustRegistryEntries } from '../TrustRegistry';

const mockPrisma = {
  trustRegistry: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
} as any;

describe('TrustRegistry model helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers trust entity and computes trust score', async () => {
    const now = new Date();
    mockPrisma.trustRegistry.upsert.mockResolvedValue({
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
          freshnessHours: 6,
          uptimePercentage: 99.9,
        },
      },
      createdAt: now,
      updatedAt: now,
    });

    const entry = await registerTrustEntity(mockPrisma, {
      entityId: 'ca-medical-board',
      entityType: TrustEntityType.STATE_BOARD,
      did: 'did:web:trust.vitalcv/states/ca-medical-board',
      publicKeys: ['did:key:z6MkTest'],
      jurisdiction: 'CA',
      accreditationStatus: AccreditationStatus.ACCREDITED,
      displayName: 'Medical Board of California',
      metrics: {
        verificationAccuracy: 0.99,
        freshnessHours: 6,
        uptimePercentage: 99.9,
      },
    });

    expect(mockPrisma.trustRegistry.upsert).toHaveBeenCalled();
    expect(entry.displayName).toBe('Medical Board of California');
    expect(entry.trustScore).toBeGreaterThan(85);
    expect(entry.tier).toBe('ANCHOR');
  });

  it('lists trust entities with search filters applied in-memory', async () => {
    const now = new Date();
    mockPrisma.trustRegistry.findMany.mockResolvedValue([
      {
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
            freshnessHours: 6,
            uptimePercentage: 99.9,
          },
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'trust-2',
        entityId: 'aoa',
        entityType: TrustEntityType.ORG,
        did: 'did:web:trust.vitalcv/national/aoa',
        publicKeys: ['did:key:z6MkAOA'],
        jurisdiction: 'US',
        accreditationStatus: AccreditationStatus.ACCREDITED,
        metadata: {
          displayName: 'American Osteopathic Association',
          metrics: {
            verificationAccuracy: 0.95,
            freshnessHours: 24,
            uptimePercentage: 98,
          },
        },
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const entries = await listTrustRegistryEntries(mockPrisma, { search: 'osteopathic' });

    expect(entries).toHaveLength(1);
    expect(entries[0].entityId).toBe('aoa');
  });
});


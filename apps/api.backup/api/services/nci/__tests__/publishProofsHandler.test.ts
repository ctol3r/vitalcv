import { describe, expect, it, jest } from '@jest/globals';
import { JobQueueStatus, NCIVerifiableProofType } from '@prisma/client';
import type { JobQueueRecord } from '../../queue/models/JobQueue.js';
import { createPublishProofsHandler } from '../handlers/publishProofsHandler.js';

describe('publishProofsHandler', () => {
  it('builds proof bundle and records each proof type once', async () => {
    const mockPrisma = createPrismaMock();
    const recordProof = jest.fn().mockResolvedValue({ id: 'proof-record' });
    const registerNode = jest.fn().mockResolvedValue(undefined);
    const logTimeline = jest.fn().mockResolvedValue(undefined);

    const handler = createPublishProofsHandler({
      prisma: mockPrisma as any,
      proofRegistry: { recordProof } as any,
      nodeService: { registerNode } as any,
      timelineLogger: logTimeline,
    });

    const payload = {
      clinicianId: 'clin-1',
      proofTypes: [NCIVerifiableProofType.ISSUANCE, NCIVerifiableProofType.ISSUANCE, NCIVerifiableProofType.VERIFICATION],
    };

    await handler(buildJob({ type: 'NCI_PUBLISH_PROOFS', payload }));

    expect(registerNode).toHaveBeenCalledWith(
      expect.objectContaining({
        did: 'did:vital:123',
        nodeType: 'CLINICIAN',
      }),
    );

    expect(recordProof).toHaveBeenCalledTimes(2);
    expect(recordProof).toHaveBeenCalledWith(
      expect.objectContaining({
        proofType: NCIVerifiableProofType.ISSUANCE,
        issuedFor: 'clin-1',
        payload: expect.objectContaining({
          clinician: expect.objectContaining({ id: 'clin-1' }),
          licenses: expect.any(Array),
        }),
      }),
    );
    expect(logTimeline).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianId: 'clin-1',
        eventType: expect.any(String),
        metadata: expect.objectContaining({
          proofType: NCIVerifiableProofType.ISSUANCE,
        }),
      }),
    );
  });
});

function buildJob(overrides: Partial<JobQueueRecord>): JobQueueRecord {
  const now = new Date();
  return {
    id: 'job-test',
    type: 'NCI_PUBLISH_PROOFS',
    payload: {},
    status: JobQueueStatus.RUNNING,
    attempts: 1,
    maxAttempts: 5,
    lastError: null,
    startedAt: now,
    completedAt: null,
    lastRunAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as JobQueueRecord;
}

function createPrismaMock() {
  return {
    clinicianProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'clin-1',
        npi: '1234567890',
        state: 'CA',
        user: {
          did: 'did:vital:123',
          name: 'Test Clinician',
        },
      }),
    },
    stateLicenseVerification: {
      findMany: jest.fn().mockResolvedValue([
        {
          state: 'CA',
          licenseNumber: 'LIC-1',
          status: 'ACTIVE',
          expiryDate: new Date('2030-01-01'),
        },
      ]),
    },
    privilegeGranted: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'priv-1',
          orgId: 'org-1',
          privilegeSetId: 'CARDIO',
          status: 'ACTIVE',
          expiresAt: new Date('2030-01-01'),
        },
      ]),
    },
    credentialTimelineEvent: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'evt-1',
          eventType: 'LICENSE_VERIFIED',
          severity: 'INFO',
          timestamp: new Date('2025-01-01'),
        },
      ]),
    },
    privilegeSafetySignal: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'sig-1',
          signalType: 'QUALITY_RISK',
          severity: 'HIGH',
          detectedAt: new Date('2025-02-01'),
          summary: 'Quality risk detected',
        },
      ]),
    },
  };
}


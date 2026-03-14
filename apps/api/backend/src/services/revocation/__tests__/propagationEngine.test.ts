jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    decisionCapsule: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
    acceptance: {
      findMany: jest.fn(),
    },
    revocationOutboxEvent: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../../trust/trustStateEngine', () => ({
  refreshTrustState: jest.fn(),
}));

jest.mock('../../graph/bidirectional', () => ({
  propagateRevocation: jest.fn(),
}));

jest.mock('../authorityGraph', () => ({
  findDecisionCapsulesByCredential: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { propagateRevocation } from '../../graph/bidirectional';
import { refreshTrustState } from '../../trust/trustStateEngine';
import { findDecisionCapsulesByCredential } from '../authorityGraph';
import {
  propagateCredentialLifecycleChange,
  type RevocationPropagationTrigger,
} from '../propagationEngine';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  decisionCapsule: {
    update: jest.Mock;
    findUnique: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
  };
  acceptance: {
    findMany: jest.Mock;
  };
  revocationOutboxEvent: {
    upsert: jest.Mock;
  };
};

const refreshTrustStateMock = refreshTrustState as jest.Mock;
const propagateBidirectionalMock = propagateRevocation as jest.Mock;
const findDecisionCapsulesByCredentialMock = findDecisionCapsulesByCredential as jest.Mock;

function makeArtifact(status = 'ACTIVE', lifecycleState = 'active') {
  return {
    id: 'cred-1',
    npi: '1234567890',
    source: 'NURSYS',
    status,
    lifecycleState,
    organizationId: null,
    rawPayload: {},
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
  };
}

function makeCapsule(id: string, status: string) {
  return {
    id,
    subjectDid: 'did:vitalcv:clinician:1',
    subjectNpi: '1234567890',
    decisionType: 'HIRING',
    status,
    metadata: {
      trust_state_snapshot: {
        readiness_level: 'L3',
      },
    },
  };
}

function makeTrustState(readinessLevel: 'L0' | 'L1' | 'L2' | 'L3') {
  return {
    npi: '1234567890',
    identityVerified: true,
    licensureStatus: 'verified' as const,
    exclusionClear: true,
    credentialCount: 1,
    readiness_level: readinessLevel,
    readiness_status: 'Updated readiness state',
    readiness_score: readinessLevel === 'L3' ? 95 : 60,
    gap_summary: [],
    methodology_version: '243.1',
    computed_at: '2026-03-14T10:05:00.000Z',
    trustBand: readinessLevel,
    trustScore: readinessLevel === 'L3' ? 95 : 60,
    facts: [],
    gaps: [],
    computedAt: '2026-03-14T10:05:00.000Z',
  };
}

describe('propagationEngine', () => {
  beforeEach(() => {
    prismaMock.verificationArtifact.findUnique.mockReset();
    prismaMock.verificationArtifact.findFirst.mockReset();
    prismaMock.verificationArtifact.update.mockReset();
    prismaMock.decisionCapsule.update.mockReset();
    prismaMock.decisionCapsule.findUnique.mockReset();
    prismaMock.auditEvent.create.mockReset();
    prismaMock.acceptance.findMany.mockReset();
    prismaMock.revocationOutboxEvent.upsert.mockReset();
    refreshTrustStateMock.mockReset();
    propagateBidirectionalMock.mockReset();
    findDecisionCapsulesByCredentialMock.mockReset();

    prismaMock.verificationArtifact.findUnique.mockResolvedValue(makeArtifact());
    prismaMock.verificationArtifact.update.mockImplementation(async ({ data }: {
      data: Record<string, unknown>;
    }) => ({
      ...makeArtifact(
        String(data.status ?? 'ACTIVE'),
        String(data.lifecycleState ?? 'active'),
      ),
      rawPayload: data.rawPayload,
      revokedAt: data.revokedAt ?? null,
      revocationReason: data.revocationReason ?? null,
    }));
    prismaMock.decisionCapsule.update.mockResolvedValue({});
    prismaMock.decisionCapsule.findUnique.mockResolvedValue({
      metadata: {
        trust_state_snapshot: {
          readiness_level: 'L3',
        },
      },
    });
    prismaMock.auditEvent.create
      .mockResolvedValueOnce({ id: 'audit-1' })
      .mockResolvedValueOnce({ id: 'audit-2' })
      .mockResolvedValue({ id: 'audit-3' });
    prismaMock.acceptance.findMany.mockResolvedValue([
      { acceptanceId: 'acc-1', employerId: 'employer-1' },
      { acceptanceId: 'acc-2', employerId: 'employer-1' },
      { acceptanceId: 'acc-3', employerId: 'employer-2' },
    ]);
    prismaMock.revocationOutboxEvent.upsert.mockImplementation(async ({ create }: {
      create: { employerId: string };
    }) => ({
      id: `outbox-${create.employerId}`,
    }));
    refreshTrustStateMock.mockResolvedValue(makeTrustState('L1'));
    propagateBidirectionalMock.mockResolvedValue({
      totalFlagged: 3,
      flaggedAcceptances: ['acc-1', 'acc-3'],
      flaggedStarts: ['start-1'],
      traversalHash: 'traversal-1',
    });
  });

  function mockTrustSnapshots(previousBand: string | null, latestBand: string | null) {
    prismaMock.verificationArtifact.findFirst.mockReset();
    prismaMock.verificationArtifact.findFirst
      .mockResolvedValueOnce(previousBand ? {
        id: 'snapshot-prev',
        trustState: previousBand,
        rawPayload: {
          readiness_level: previousBand,
          computed_at: '2026-03-14T09:00:00.000Z',
        },
        verifiedAt: new Date('2026-03-14T09:00:00.000Z'),
      } : null)
      .mockResolvedValueOnce(latestBand ? {
        id: 'snapshot-next',
        trustState: latestBand,
        rawPayload: {
          readiness_level: latestBand,
          computed_at: '2026-03-14T10:05:00.000Z',
        },
        verifiedAt: new Date('2026-03-14T10:05:00.000Z'),
      } : null);
  }

  it('stages verification invalidation and dedupes outbox rows by employer', async () => {
    mockTrustSnapshots('L3', 'L1');
    findDecisionCapsulesByCredentialMock.mockResolvedValue([
      makeCapsule('cap-valid', 'VALID'),
      makeCapsule('cap-risk', 'AT_RISK'),
      makeCapsule('cap-invalid', 'INVALID'),
    ]);

    const occurredAt = new Date('2026-03-14T10:00:00.000Z');
    const result = await propagateCredentialLifecycleChange({
      credentialId: 'cred-1',
      trigger: 'verification.invalidated',
      occurredAt,
      reason: 'license suspended upstream',
    });

    expect(result.totalAffected).toBe(2);
    expect(result.invalidatedCount).toBe(1);
    expect(result.atRiskCount).toBe(1);
    expect(result.affectedCapsules).toEqual([
      expect.objectContaining({ capsuleId: 'cap-valid', previousStatus: 'VALID', newStatus: 'AT_RISK' }),
      expect.objectContaining({ capsuleId: 'cap-risk', previousStatus: 'AT_RISK', newStatus: 'INVALID' }),
    ]);
    expect(prismaMock.verificationArtifact.update).toHaveBeenCalledWith({
      where: { id: 'cred-1' },
      data: expect.objectContaining({
        status: 'INVALIDATED',
        trustState: 'needs_review',
        statusLastChecked: occurredAt,
      }),
      select: expect.any(Object),
    });
    expect(propagateBidirectionalMock).not.toHaveBeenCalled();
    expect(prismaMock.revocationOutboxEvent.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.revocationOutboxEvent.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        dedupeKey: 'verification.invalidated:cred-1:employer-1:2026-03-14T10:00:00.000Z',
      },
    }));
    expect(result.outbox.totalEnqueued).toBe(2);

    const statusUpdates = prismaMock.decisionCapsule.update.mock.calls
      .map(([call]) => call)
      .filter((call) => typeof call.data?.status === 'string');
    expect(statusUpdates).toEqual([
      expect.objectContaining({
        where: { id: 'cap-valid' },
        data: expect.objectContaining({ status: 'AT_RISK' }),
      }),
      expect.objectContaining({
        where: { id: 'cap-risk' },
        data: expect.objectContaining({ status: 'INVALID' }),
      }),
    ]);
  });

  it.each([
    ['credential.revoked', 'REVOKED', 'revoked'],
    ['credential.expired', 'EXPIRED', 'expired'],
  ] as const)(
    'invalidates dependent capsules for %s',
    async (
      trigger: RevocationPropagationTrigger,
      expectedStatus: string,
      expectedTrustState: string,
    ) => {
      mockTrustSnapshots('L2', 'L1');
      findDecisionCapsulesByCredentialMock.mockResolvedValue([
        makeCapsule('cap-valid', 'VALID'),
        makeCapsule('cap-risk', 'AT_RISK'),
      ]);

      const result = await propagateCredentialLifecycleChange({
        credentialId: 'cred-1',
        trigger,
        occurredAt: new Date('2026-03-14T11:00:00.000Z'),
        reason: `${trigger} detected`,
      });

      expect(result.totalAffected).toBe(2);
      expect(result.invalidatedCount).toBe(2);
      expect(result.atRiskCount).toBe(0);
      expect(result.affectedCapsules.every((capsule) => capsule.newStatus === 'INVALID')).toBe(true);
      expect(prismaMock.verificationArtifact.update).toHaveBeenCalledWith({
        where: { id: 'cred-1' },
        data: expect.objectContaining({
          status: expectedStatus,
          trustState: expectedTrustState,
        }),
        select: expect.any(Object),
      });
      expect(propagateBidirectionalMock).toHaveBeenCalledWith('cred-1');
      expect(result.bidirectionalFlagged).toBe(3);
      expect(result.bidirectionalAcceptancesFlagged).toBe(2);
      expect(result.bidirectionalStartsFlagged).toBe(1);
      expect(result.bidirectionalTraversalHash).toBe('traversal-1');
    },
  );

  it('is idempotent when replaying invalidation for already invalid capsules', async () => {
    mockTrustSnapshots('L1', 'L1');
    findDecisionCapsulesByCredentialMock.mockResolvedValue([
      makeCapsule('cap-invalid', 'INVALID'),
    ]);
    prismaMock.acceptance.findMany.mockResolvedValue([]);

    const result = await propagateCredentialLifecycleChange({
      credentialId: 'cred-1',
      trigger: 'verification.invalidated',
      occurredAt: new Date('2026-03-14T12:00:00.000Z'),
      reason: 'duplicate replay',
    });

    expect(result.totalAffected).toBe(0);
    expect(result.invalidatedCount).toBe(0);
    expect(result.atRiskCount).toBe(0);
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.revocationOutboxEvent.upsert).not.toHaveBeenCalled();
    expect(prismaMock.decisionCapsule.update).not.toHaveBeenCalled();
  });
});

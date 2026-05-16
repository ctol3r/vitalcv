/**
 * replayEngine — tenant isolation integration tests (W2-PR36A)
 *
 * Verifies the replay engine honors the multi-tenant boundary:
 *   - tenanted requester reading another tenant's capsule throws
 *   - relatedDecisions never includes cross-tenant timeline entries
 *   - prisma decisionCapsule.findMany is called with verifierOrgId scope
 *   - replay output exposes a TenantScope block with the boundary digest
 */

const mockGetCapsuleById = jest.fn();
const mockVerifyDecisionCapsuleReplay = jest.fn();
const mockVerificationArtifactFindMany = jest.fn();
const mockVerificationArtifactFindFirst = jest.fn();
const mockDecisionCapsuleFindMany = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findMany: mockVerificationArtifactFindMany,
      findFirst: mockVerificationArtifactFindFirst,
    },
    decisionCapsule: {
      findMany: mockDecisionCapsuleFindMany,
    },
  },
}));

jest.mock('../../decision/capsuleEngine', () => ({
  capsuleEngine: {
    getCapsuleById: mockGetCapsuleById,
    verifyDecisionCapsuleReplay: mockVerifyDecisionCapsuleReplay,
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { replayDecision, buildAuditBundle } from '../replayEngine';
import { TenantIsolationError } from '../../multi-tenant/tenantIsolation';

function baseCapsule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'capsule-tenant-A',
    subjectNpi: '1234567890',
    subjectDid: 'did:vitalcv:1234567890',
    decisionType: 'HIRING',
    decisionTimestamp: '2026-04-01T12:00:00.000Z',
    status: 'VALID',
    credentialIds: [],
    issuerIds: [],
    artifactHash: 'a'.repeat(64),
    methodology: 'decision_capsule.v262',
    methodologyVersion: 'decision_capsule.v262',
    verifierOrgId: 'tenant-A',
    decisionAction: 'APPROVE',
    triggerEvent: 'EMPLOYER_ACCEPTANCE',
    sourceReferenceId: 'accept-A',
    metadata: {},
    ...overrides,
  };
}

function baseReplayResult(overrides: Record<string, unknown> = {}) {
  return {
    capsuleId: 'capsule-tenant-A',
    valid: true,
    expectedArtifactHash: 'a'.repeat(64),
    actualArtifactHash: 'a'.repeat(64),
    expectedEvidenceSpineDigest: null,
    actualEvidenceSpineDigest: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetCapsuleById.mockReset();
  mockVerifyDecisionCapsuleReplay.mockReset();
  mockVerificationArtifactFindMany.mockReset();
  mockVerificationArtifactFindFirst.mockReset();
  mockDecisionCapsuleFindMany.mockReset();

  mockVerificationArtifactFindMany.mockResolvedValue([]);
  mockVerificationArtifactFindFirst.mockResolvedValue(null);
  mockDecisionCapsuleFindMany.mockResolvedValue([]);
  mockVerifyDecisionCapsuleReplay.mockResolvedValue(baseReplayResult());
});

describe('replayDecision — tenant scope', () => {
  it('OPEN verdict when no requester tenant supplied (back-compat)', async () => {
    mockGetCapsuleById.mockResolvedValue(baseCapsule());

    const replay = await replayDecision('capsule-tenant-A');

    expect(replay.tenantScope.isolationVerdict).toBe('OPEN');
    expect(replay.tenantScope.capsuleTenantId).toBe('tenant-A');
    expect(replay.tenantScope.requesterTenantId).toBeNull();
    expect(replay.tenantScope.boundaryDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ENFORCED verdict when requester tenant matches capsule tenant', async () => {
    mockGetCapsuleById.mockResolvedValue(baseCapsule());

    const replay = await replayDecision('capsule-tenant-A', {
      requesterTenantId: 'tenant-A',
    });
    expect(replay.tenantScope.isolationVerdict).toBe('ENFORCED');
    expect(replay.tenantScope.requesterTenantId).toBe('tenant-A');
  });

  it('throws CROSS_TENANT_REPLAY when requester tenant differs', async () => {
    mockGetCapsuleById.mockResolvedValue(baseCapsule());

    await expect(
      replayDecision('capsule-tenant-A', { requesterTenantId: 'tenant-B' }),
    ).rejects.toBeInstanceOf(TenantIsolationError);

    try {
      await replayDecision('capsule-tenant-A', { requesterTenantId: 'tenant-B' });
      throw new Error('expected throw');
    } catch (e) {
      expect((e as TenantIsolationError).violation).toBe('CROSS_TENANT_REPLAY');
    }
  });

  it('throws AMBIGUOUS_TENANT when requester is set but capsule has no anchor', async () => {
    mockGetCapsuleById.mockResolvedValue(baseCapsule({ verifierOrgId: null }));

    try {
      await replayDecision('capsule-tenant-A', { requesterTenantId: 'tenant-A' });
      throw new Error('expected throw');
    } catch (e) {
      expect((e as TenantIsolationError).violation).toBe('AMBIGUOUS_TENANT');
    }
  });

  it('relatedDecisions query is tenant-scoped — organizationId is in the where clause', async () => {
    mockGetCapsuleById.mockResolvedValue(baseCapsule());

    await replayDecision('capsule-tenant-A');

    expect(mockDecisionCapsuleFindMany).toHaveBeenCalledTimes(1);
    const call = mockDecisionCapsuleFindMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      subjectNpi: '1234567890',
      organizationId: 'tenant-A',
    });
  });

  it('post-filters relatedDecisions even if prisma returns cross-tenant rows', async () => {
    mockGetCapsuleById.mockResolvedValue(baseCapsule());
    // Simulate a query-layer regression: prisma returns mixed-tenant rows.
    mockDecisionCapsuleFindMany.mockResolvedValue([
      {
        id: 'related-A1', organizationId: 'tenant-A',
        decisionType: 'REVIEW', decisionTimestamp: new Date('2026-03-01'),
        status: 'VALID', metadata: {},
      },
      {
        id: 'related-B1', organizationId: 'tenant-B',
        decisionType: 'REVIEW', decisionTimestamp: new Date('2026-03-02'),
        status: 'VALID', metadata: {},
      },
      {
        id: 'related-NULL', organizationId: null,
        decisionType: 'REVIEW', decisionTimestamp: new Date('2026-03-03'),
        status: 'VALID', metadata: {},
      },
    ]);

    const replay = await replayDecision('capsule-tenant-A');
    const ids = replay.relatedDecisions.map(r => r.capsuleId);
    expect(ids).toContain('related-A1');
    expect(ids).not.toContain('related-B1');
    expect(ids).not.toContain('related-NULL');
  });
});

describe('buildAuditBundle — tenant scope', () => {
  it('passes organizationId into the prisma where clause when requester tenant is supplied', async () => {
    mockGetCapsuleById.mockResolvedValue(baseCapsule());
    mockDecisionCapsuleFindMany
      .mockResolvedValueOnce([{ id: 'capsule-tenant-A' }]) // initial bundle list
      .mockResolvedValue([]);                              // related-decisions per replay

    await buildAuditBundle('1234567890', { requesterTenantId: 'tenant-A' });

    const firstCall = mockDecisionCapsuleFindMany.mock.calls[0][0];
    expect(firstCall.where.subjectNpi).toBe('1234567890');
    expect(firstCall.where.organizationId).toBe('tenant-A');
  });

  it('omits organizationId scope when no requester tenant is supplied (back-compat)', async () => {
    mockGetCapsuleById.mockResolvedValue(baseCapsule());
    mockDecisionCapsuleFindMany
      .mockResolvedValueOnce([{ id: 'capsule-tenant-A' }])
      .mockResolvedValue([]);

    await buildAuditBundle('1234567890');

    const firstCall = mockDecisionCapsuleFindMany.mock.calls[0][0];
    expect(firstCall.where.subjectNpi).toBe('1234567890');
    expect(firstCall.where.organizationId).toBeUndefined();
  });

  it('CHAOS: query-layer leaks a cross-tenant capsule — replayDecision blocks it', async () => {
    // Query layer returns capsule from tenant-B; bundle was requested by tenant-A.
    mockDecisionCapsuleFindMany.mockResolvedValueOnce([
      { id: 'capsule-tenant-B' },
    ]).mockResolvedValue([]);
    mockGetCapsuleById.mockResolvedValue(baseCapsule({
      id: 'capsule-tenant-B', verifierOrgId: 'tenant-B',
    }));

    const bundle = await buildAuditBundle('1234567890', { requesterTenantId: 'tenant-A' });
    // Replay blocked by tenant scope assertion → bundle is empty (no leak).
    expect(bundle.replays).toHaveLength(0);
    expect(bundle.capsuleCount).toBe(0);
  });
});

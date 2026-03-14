import { sha256ForPayload } from '../../../utils/deterministic';

const mockApplicationFindUnique = jest.fn();
const mockAuditEventCreate = jest.fn();
const mockEnsureTrustStateBeforeCapsule = jest.fn();
const mockGetBindingByNpi = jest.fn();
const mockFindLatestTrustState = jest.fn();
const mockComputeTrustState = jest.fn();
const mockPersistDecisionCapsule = jest.fn();
const mockCreateAuthorityEdges = jest.fn();
const mockFindDecisionCapsuleById = jest.fn();
const mockFindDecisionCapsulesByNpi = jest.fn();
const mockGetCredentialEvidence = jest.fn();
const mockEnqueueDecisionCapsuleCreatedEvent = jest.fn();
const mockAppendAuditEvent = jest.fn();
const mockLog = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    application: {
      findUnique: mockApplicationFindUnique,
    },
    auditEvent: {
      create: mockAuditEventCreate,
    },
    decisionCapsule: {
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: mockLog,
}));

jest.mock('../../audit/auditLedger', () => ({
  appendAuditEvent: mockAppendAuditEvent,
}));

jest.mock('../../integrity/pipelineEnforcer', () => ({
  ensureTrustStateBeforeCapsule: mockEnsureTrustStateBeforeCapsule,
}));

jest.mock('../../identity/npiDidBinding', () => ({
  getBindingByNpi: mockGetBindingByNpi,
}));

jest.mock('../../trust-state', () => ({
  findLatestTrustState: mockFindLatestTrustState,
  computeTrustState: mockComputeTrustState,
}));

jest.mock('../../../../repositories/decisionCapsules.repo', () => ({
  createDecisionCapsule: mockPersistDecisionCapsule,
  createAuthorityEdges: mockCreateAuthorityEdges,
  findDecisionCapsuleById: mockFindDecisionCapsuleById,
  findDecisionCapsulesByNpi: mockFindDecisionCapsulesByNpi,
}));

jest.mock('../../../../repositories/auditBundles.repo', () => ({
  getCredentialEvidence: mockGetCredentialEvidence,
}));

jest.mock('../decisionOutbox', () => ({
  enqueueDecisionCapsuleCreatedEvent: mockEnqueueDecisionCapsuleCreatedEvent,
}));

import { capsuleEngine } from '../capsuleEngine';

describe('capsuleEngine', () => {
  const legacySnapshot = {
    readiness_level: 'L3',
    readiness_score: 91,
    readiness_status: 'READY',
    gap_summary: [],
    methodology_version: 'trust-state.v2',
    computed_at: '2026-03-14T12:00:00.000Z',
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-14T12:00:00.000Z'));

    mockApplicationFindUnique.mockReset();
    mockAuditEventCreate.mockReset();
    mockEnsureTrustStateBeforeCapsule.mockReset();
    mockGetBindingByNpi.mockReset();
    mockFindLatestTrustState.mockReset();
    mockComputeTrustState.mockReset();
    mockPersistDecisionCapsule.mockReset();
    mockCreateAuthorityEdges.mockReset();
    mockFindDecisionCapsuleById.mockReset();
    mockFindDecisionCapsulesByNpi.mockReset();
    mockGetCredentialEvidence.mockReset();
    mockEnqueueDecisionCapsuleCreatedEvent.mockReset();
    mockAppendAuditEvent.mockReset();
    mockLog.mockReset();

    mockEnsureTrustStateBeforeCapsule.mockResolvedValue(legacySnapshot);
    mockGetBindingByNpi.mockResolvedValue(null);
    mockFindLatestTrustState.mockResolvedValue(null);
    mockComputeTrustState.mockResolvedValue(null);
    mockGetCredentialEvidence.mockResolvedValue([
      {
        credentialId: 'cred-1',
        relatedCompatibilityArtifactId: 'compat-1',
        issuerId: 'issuer-1',
      },
    ]);
    mockAuditEventCreate.mockResolvedValue({});
    mockAppendAuditEvent.mockResolvedValue(undefined);
    mockCreateAuthorityEdges.mockResolvedValue(undefined);
    mockEnqueueDecisionCapsuleCreatedEvent.mockResolvedValue('outbox-1');
    mockPersistDecisionCapsule.mockImplementation(async (input) => ({
      idempotent: false,
      capsule: {
        id: 'capsule-1',
        subjectDid: input.subjectDid,
        subjectNpi: input.subjectNpi,
        decisionType: input.decisionType,
        decisionTimestamp: input.decisionTimestamp.toISOString(),
        credentialIds: input.credentialIds,
        issuerIds: input.issuerIds,
        artifactHash: input.artifactHash,
        methodology: input.methodology,
        status: input.status ?? 'VALID',
        metadata: input.metadata ?? {},
        createdAt: input.decisionTimestamp.toISOString(),
        updatedAt: input.decisionTimestamp.toISOString(),
      },
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('creates reviewer decision capsules for non-accepted actions and captures the replay payload', async () => {
    mockApplicationFindUnique.mockResolvedValue({
      id: 'app-1',
      npi: '1003000126',
      status: 'DECLINED',
      reviewNote: 'Insufficient evidence',
      opportunityId: 'opp-1',
      opportunity: {
        organizationId: 'org-1',
        organization: { name: 'Org One' },
      },
    });

    const capsule = await capsuleEngine.createDecisionFromApplication({
      applicationId: 'app-1',
      verifierClerkUserId: 'clerk-1',
      decisionType: 'HIRING',
      decisionAction: 'REJECT',
    });

    const persistInput = mockPersistDecisionCapsule.mock.calls[0][0];
    const metadata = persistInput.metadata as Record<string, unknown>;
    const payload = metadata.decision_capsule_payload as Record<string, unknown>;

    expect(capsule.decisionAction).toBe('REJECT');
    expect(persistInput).toEqual(expect.objectContaining({
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      decisionType: 'HIRING',
      decisionAction: 'REJECT',
      sourceReferenceId: 'app-1',
      triggerEvent: 'verifier_decision',
      credentialIds: ['cred-1'],
      issuerIds: ['issuer-1'],
    }));
    expect(metadata).toEqual(expect.objectContaining({
      verifierOrgId: 'org-1',
      decisionAction: 'REJECT',
      trustStateHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(payload).toEqual(expect.objectContaining({
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      trustStateHash: metadata.trustStateHash,
      verifierOrg: 'org-1',
      decisionType: 'HIRING',
      decisionAction: 'REJECT',
      credentialIds: ['cred-1'],
      artifactHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      decisionTimestamp: '2026-03-14T12:00:00.000Z',
    }));
    expect(mockCreateAuthorityEdges).toHaveBeenCalledWith(expect.objectContaining({
      capsuleId: 'capsule-1',
      decisionAction: 'REJECT',
      verifierOrgId: 'org-1',
    }));
    expect(mockEnqueueDecisionCapsuleCreatedEvent).toHaveBeenCalledWith(expect.objectContaining({
      capsuleId: 'capsule-1',
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      trustStateHash: metadata.trustStateHash,
      verifierOrg: 'org-1',
    }));
  });

  test('rejects incompatible application status and decision action combinations', async () => {
    mockApplicationFindUnique.mockResolvedValue({
      id: 'app-1',
      npi: '1003000126',
      status: 'REVIEWED',
      reviewNote: 'Need manual follow-up',
      opportunityId: 'opp-1',
      opportunity: {
        organizationId: 'org-1',
        organization: { name: 'Org One' },
      },
    });

    await expect(capsuleEngine.createDecisionFromApplication({
      applicationId: 'app-1',
      verifierClerkUserId: 'clerk-1',
      decisionType: 'HIRING',
      decisionAction: 'APPROVE',
    })).rejects.toThrow('status REVIEWED is incompatible with APPROVE');
  });

  test('verifies replay hashes deterministically', async () => {
    const replayPayload = {
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      trustStateHash: 'a'.repeat(64),
      verifierOrg: 'org-1',
      decisionType: 'HIRING',
      decisionAction: 'APPROVE',
      credentialIds: ['cred-1'],
      compatibilityCredentialIds: ['compat-1'],
      issuerIds: ['issuer-1'],
      status: 'VALID',
      triggerEvent: 'verifier_decision',
      sourceReferenceId: 'app-1',
      methodologyVersion: 'decision_capsule.v262',
      decisionTimestamp: '2026-03-14T12:00:00.000Z',
    };
    const artifactHash = sha256ForPayload(replayPayload);

    mockFindDecisionCapsuleById.mockResolvedValue({
      id: 'capsule-1',
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      decisionType: 'HIRING',
      decisionTimestamp: '2026-03-14T12:00:00.000Z',
      credentialIds: ['cred-1'],
      issuerIds: ['issuer-1'],
      artifactHash,
      methodology: 'decision_capsule.v262',
      status: 'VALID',
      metadata: {
        decision_capsule_payload: {
          ...replayPayload,
          artifactHash,
        },
      },
      createdAt: '2026-03-14T12:00:00.000Z',
      updatedAt: '2026-03-14T12:00:00.000Z',
    });

    await expect(capsuleEngine.verifyDecisionCapsuleReplay('capsule-1')).resolves.toEqual({
      capsuleId: 'capsule-1',
      valid: true,
      expectedArtifactHash: artifactHash,
      actualArtifactHash: artifactHash,
    });
  });
});

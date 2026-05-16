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

import { replayDecision } from '../replayEngine';

describe('replayDecision runtime cohesion metadata', () => {
  beforeEach(() => {
    mockGetCapsuleById.mockReset();
    mockVerifyDecisionCapsuleReplay.mockReset();
    mockVerificationArtifactFindMany.mockReset();
    mockVerificationArtifactFindFirst.mockReset();
    mockDecisionCapsuleFindMany.mockReset();

    mockGetCapsuleById.mockResolvedValue({
      id: 'capsule-1',
      subjectNpi: '1234567890',
      subjectDid: 'did:vitalcv:1234567890',
      decisionType: 'HIRING',
      decisionTimestamp: '2026-03-23T20:00:00.000Z',
      status: 'VALID',
      credentialIds: [],
      issuerIds: [],
      artifactHash: 'a'.repeat(64),
      methodology: 'decision_capsule.v262',
      methodologyVersion: 'decision_capsule.v262',
      verifierOrgId: 'org-1',
      decisionAction: 'APPROVE',
      triggerEvent: 'EMPLOYER_ACCEPTANCE',
      sourceReferenceId: 'accept-1',
      metadata: {
        runtimeTrust: {
          correlationId: 'corr-runtime-1',
          payloadHash: 'b'.repeat(64),
          mutationFingerprint: 'c'.repeat(64),
        },
      },
    });
    mockVerificationArtifactFindMany.mockResolvedValue([]);
    mockVerificationArtifactFindFirst.mockResolvedValue(null);
    mockDecisionCapsuleFindMany.mockResolvedValue([]);
    mockVerifyDecisionCapsuleReplay.mockResolvedValue({
      capsuleId: 'capsule-1',
      valid: true,
      expectedArtifactHash: 'a'.repeat(64),
      actualArtifactHash: 'a'.repeat(64),
      expectedEvidenceSpineDigest: null,
      actualEvidenceSpineDigest: null,
    });
  });

  it('emits R-CAT-6 replay metadata without losing upstream correlation fields', async () => {
    const replay = await replayDecision('capsule-1');

    expect(replay.replayMetadata).toEqual(expect.objectContaining({
      replayCategory: 'R-CAT-6',
      mutationClassification: 'DOSSIER_REPLAY',
      correlationId: 'corr-runtime-1',
      payloadHash: 'b'.repeat(64),
      mutationFingerprint: 'c'.repeat(64),
    }));
  });
});

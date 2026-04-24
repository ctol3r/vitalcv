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

describe('replayEngine', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-20T12:00:00.000Z'));

    mockGetCapsuleById.mockReset().mockResolvedValue({
      id: 'capsule-1',
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      decisionType: 'HIRING',
      decisionTimestamp: '2026-03-20T10:00:00.000Z',
      credentialIds: ['artifact-1'],
      issuerIds: ['issuer-1'],
      artifactHash: 'a'.repeat(64),
      methodology: 'decision_capsule.v262',
      methodologyVersion: 'decision_capsule.v262',
      verifierOrgId: 'org-1',
      decisionAction: 'APPROVE',
      trustStateHash: 'b'.repeat(64),
      status: 'VALID',
      triggerEvent: 'verifier_decision',
      sourceReferenceId: 'app-1',
      metadata: {
        clerkUserId: 'clerk-1',
        facilityName: 'General Hospital',
        notes: 'Approved from snapshot',
      },
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:05:00.000Z',
    });
    mockVerifyDecisionCapsuleReplay.mockReset().mockResolvedValue({
      capsuleId: 'capsule-1',
      valid: true,
      expectedArtifactHash: 'a'.repeat(64),
      actualArtifactHash: 'a'.repeat(64),
      expectedEvidenceSpineDigest: 'digest-1',
      actualEvidenceSpineDigest: 'digest-1',
    });
    mockVerificationArtifactFindMany.mockReset().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id) {
        return [{
          id: 'artifact-1',
          npi: '1003000126',
          source: 'STATE_BOARD',
          status: 'VERIFIED',
          rawPayload: { state: 'ca', address: '123 Main St', status: 'ACTIVE' },
          verifiedAt: new Date('2026-03-19T10:00:00.000Z'),
          expiresAt: new Date('2026-04-19T10:00:00.000Z'),
          createdAt: new Date('2026-03-19T09:00:00.000Z'),
        }];
      }

      return [
        {
          id: 'artifact-1',
          source: 'STATE_BOARD',
          status: 'VERIFIED',
          rawPayload: { state: 'ca', address: '123 Main St', status: 'ACTIVE' },
          verifiedAt: new Date('2026-03-19T10:00:00.000Z'),
          expiresAt: new Date('2026-04-19T10:00:00.000Z'),
          createdAt: new Date('2026-03-19T09:00:00.000Z'),
        },
        {
          id: 'artifact-2',
          source: 'NPPES',
          status: 'ACTIVE',
          rawPayload: { state: 'ca', address: '456 Side St', status: 'ACTIVE' },
          verifiedAt: new Date('2026-03-18T10:00:00.000Z'),
          expiresAt: null,
          createdAt: new Date('2026-03-18T09:00:00.000Z'),
        },
      ];
    });
    mockVerificationArtifactFindFirst.mockReset().mockResolvedValue({
      rawPayload: {
        readiness_level: 'L3',
        readiness_score: 91,
        readiness_status: 'READY',
        methodology_version: 'trust_state.v1',
      },
      createdAt: new Date('2026-03-20T09:59:00.000Z'),
    });
    mockDecisionCapsuleFindMany.mockReset().mockResolvedValue([
      {
        id: 'capsule-related',
        decisionType: 'HIRING',
        decisionTimestamp: new Date('2026-03-19T10:00:00.000Z'),
        status: 'VALID',
        metadata: {
          decisionAction: 'REJECT',
        },
      },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('replays identical output across repeated calls without wall-clock drift', async () => {
    const first = await replayDecision('capsule-1');

    jest.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));
    const second = await replayDecision('capsule-1');

    expect(first).toEqual(second);
    expect(first.replayedAt).toBe('2026-03-20T10:05:00.000Z');
    expect(first.integrity.verifiedAt).toBe('2026-03-20T10:05:00.000Z');
  });

  it('preserves identical replay state across multiple replay cycles', async () => {
    const first = await replayDecision('capsule-1');

    jest.setSystemTime(new Date('2026-04-05T12:00:00.000Z'));
    const second = await replayDecision('capsule-1');

    jest.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));
    const third = await replayDecision('capsule-1');

    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(JSON.stringify(third)).toBe(JSON.stringify(first));
  });

  it('replays the same causal graph even when evidence arrives in a different order', async () => {
    let contextCallCount = 0;
    mockVerificationArtifactFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id) {
        return [{
          id: 'artifact-1',
          npi: '1003000126',
          source: 'STATE_BOARD',
          status: 'VERIFIED',
          rawPayload: { state: 'ca', address: '123 Main St', status: 'ACTIVE' },
          verifiedAt: new Date('2026-03-19T10:00:00.000Z'),
          expiresAt: new Date('2026-04-19T10:00:00.000Z'),
          createdAt: new Date('2026-03-19T09:00:00.000Z'),
        }];
      }

      contextCallCount += 1;
      const contextArtifacts = contextCallCount === 1
        ? [
            {
              id: 'artifact-2',
              source: 'NPPES',
              status: 'ACTIVE',
              rawPayload: { state: 'ca', address: '456 Side St', status: 'ACTIVE' },
              verifiedAt: new Date('2026-03-18T10:00:00.000Z'),
              expiresAt: null,
              createdAt: new Date('2026-03-18T09:00:00.000Z'),
            },
            {
              id: 'artifact-1',
              source: 'STATE_BOARD',
              status: 'VERIFIED',
              rawPayload: { state: 'ca', address: '123 Main St', status: 'ACTIVE' },
              verifiedAt: new Date('2026-03-19T10:00:00.000Z'),
              expiresAt: new Date('2026-04-19T10:00:00.000Z'),
              createdAt: new Date('2026-03-19T09:00:00.000Z'),
            },
          ]
        : [
            {
              id: 'artifact-1',
              source: 'STATE_BOARD',
              status: 'VERIFIED',
              rawPayload: { state: 'ca', address: '123 Main St', status: 'ACTIVE' },
              verifiedAt: new Date('2026-03-19T10:00:00.000Z'),
              expiresAt: new Date('2026-04-19T10:00:00.000Z'),
              createdAt: new Date('2026-03-19T09:00:00.000Z'),
            },
            {
              id: 'artifact-2',
              source: 'NPPES',
              status: 'ACTIVE',
              rawPayload: { state: 'ca', address: '456 Side St', status: 'ACTIVE' },
              verifiedAt: new Date('2026-03-18T10:00:00.000Z'),
              expiresAt: null,
              createdAt: new Date('2026-03-18T09:00:00.000Z'),
            },
          ];

      return contextArtifacts;
    });

    const first = await replayDecision('capsule-1');
    const second = await replayDecision('capsule-1');

    expect(first.authorityChain).toEqual(second.authorityChain);
    expect(first.authorityChain.map((entry) => `${entry.position}:${entry.nodeType}:${entry.id}`)).toEqual([
      '0:CLINICIAN:1003000126',
      '1:CREDENTIAL:artifact-2',
      '2:CREDENTIAL:artifact-1',
      '3:ISSUER:issuer-1',
      '4:VERIFIER:org-1',
      '5:DECISION:capsule-1',
    ]);
  });

  it('sanitizes evidence records and keeps consulted sources sorted deterministically', async () => {
    const replay = await replayDecision('capsule-1');

    expect(replay.evidenceSnapshot.evidenceRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({
        artifactId: 'artifact-1',
        sanitizedPayload: expect.not.objectContaining({
          address: expect.anything(),
        }),
      }),
    ]));
    expect(replay.evidenceSnapshot.sourcesConsulted.map((source) => source.label)).toEqual([
      'NPI Registry (CMS)',
      'State Medical Board',
    ]);
  });

  it('preserves the stored trigger event and source reference as the replay root cause', async () => {
    const replay = await replayDecision('capsule-1');

    expect(replay.decision.triggerEvent).toBe('verifier_decision');
    expect(replay.decision.sourceReferenceId).toBe('app-1');
    expect(replay.evidenceSnapshot.anomaliesDetected).not.toContain('No root cause reference was stored with this decision.');
  });

  it('replays correctly after schema changes without losing compatibility', async () => {
    mockGetCapsuleById.mockResolvedValue({
      id: 'capsule-legacy',
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      decisionType: 'HIRING',
      decisionTimestamp: '2026-03-20T10:00:00.000Z',
      credentialIds: [],
      issuerIds: [],
      artifactHash: 'c'.repeat(64),
      methodology: 'decision_capsule.v120',
      methodologyVersion: 'decision_capsule.v120',
      verifierOrgId: null,
      decisionAction: null,
      trustStateHash: null,
      status: 'AT_RISK',
      triggerEvent: 'verifier_decision',
      sourceReferenceId: 'legacy-source',
      metadata: {
        trustBand: 'L2',
        readinessScore: 72,
        gaps: ['license follow-up required'],
      },
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:01:00.000Z',
    });
    mockVerifyDecisionCapsuleReplay.mockResolvedValue({
      capsuleId: 'capsule-legacy',
      valid: true,
      expectedArtifactHash: 'c'.repeat(64),
      actualArtifactHash: 'c'.repeat(64),
      expectedEvidenceSpineDigest: null,
      actualEvidenceSpineDigest: null,
    });
    mockVerificationArtifactFindMany.mockResolvedValue([]);
    mockVerificationArtifactFindFirst.mockResolvedValue(null);
    mockDecisionCapsuleFindMany.mockResolvedValue([]);

    const replay = await replayDecision('capsule-legacy');

    expect(replay.status).toBe('AT_RISK');
    expect(replay.integrity.methodologyVersion).toBe('decision_capsule.v120');
    expect(replay.evidenceSnapshot.trustStateAtDecision).toEqual({
      trustBand: 'L2',
      trustScore: 72,
      readinessStatus: 'UNKNOWN',
      capturedAt: null,
      methodology: 'trust_state.v1',
    });
    expect(replay.evidenceSnapshot.anomaliesDetected).toEqual([
      'license follow-up required',
      'No verification artifacts were linked into this decision replay.',
      'Authority chain is incomplete: no credential links captured.',
    ]);
  });

  it('falls back to legacy snapshot metadata when a typed trust snapshot is unavailable', async () => {
    mockGetCapsuleById.mockResolvedValue({
      id: 'capsule-fallback',
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      decisionType: 'HIRING',
      decisionTimestamp: '2026-03-20T10:00:00.000Z',
      credentialIds: [],
      issuerIds: [],
      artifactHash: 'd'.repeat(64),
      methodology: 'decision_capsule.v120',
      methodologyVersion: 'decision_capsule.v120',
      verifierOrgId: null,
      decisionAction: null,
      trustStateHash: null,
      status: 'VALID',
      triggerEvent: 'verifier_decision',
      sourceReferenceId: 'legacy-source',
      metadata: {
        trustBand: 'L1',
        readinessScore: 48,
        gaps: 'manual review still required',
      },
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:01:00.000Z',
    });
    mockVerifyDecisionCapsuleReplay.mockResolvedValue({
      capsuleId: 'capsule-fallback',
      valid: true,
      expectedArtifactHash: 'd'.repeat(64),
      actualArtifactHash: 'd'.repeat(64),
      expectedEvidenceSpineDigest: null,
      actualEvidenceSpineDigest: null,
    });
    mockVerificationArtifactFindMany.mockResolvedValue([]);
    mockVerificationArtifactFindFirst.mockResolvedValue(null);
    mockDecisionCapsuleFindMany.mockResolvedValue([]);

    const replay = await replayDecision('capsule-fallback');

    expect(replay.evidenceSnapshot.trustStateAtDecision).toEqual({
      trustBand: 'L1',
      trustScore: 48,
      readinessStatus: 'UNKNOWN',
      capturedAt: null,
      methodology: 'trust_state.v1',
    });
    expect(replay.evidenceSnapshot.anomaliesDetected).toEqual([
      'manual review still required',
      'No verification artifacts were linked into this decision replay.',
      'Authority chain is incomplete: no credential links captured.',
    ]);
  });

  it('flags incomplete causal chains instead of silently presenting them as complete', async () => {
    mockGetCapsuleById.mockResolvedValue({
      id: 'capsule-incomplete',
      subjectDid: 'did:vitalcv:1003000126',
      subjectNpi: '1003000126',
      decisionType: 'HIRING',
      decisionTimestamp: '2026-03-20T10:00:00.000Z',
      credentialIds: [],
      issuerIds: [],
      artifactHash: 'e'.repeat(64),
      methodology: 'decision_capsule.v262',
      methodologyVersion: 'decision_capsule.v262',
      verifierOrgId: null,
      decisionAction: 'REVIEW',
      trustStateHash: null,
      status: 'AT_RISK',
      triggerEvent: null,
      sourceReferenceId: null,
      metadata: {},
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:05:00.000Z',
    });
    mockVerifyDecisionCapsuleReplay.mockResolvedValue({
      capsuleId: 'capsule-incomplete',
      valid: true,
      expectedArtifactHash: 'e'.repeat(64),
      actualArtifactHash: 'e'.repeat(64),
      expectedEvidenceSpineDigest: null,
      actualEvidenceSpineDigest: null,
    });
    mockVerificationArtifactFindMany.mockResolvedValue([]);
    mockVerificationArtifactFindFirst.mockResolvedValue(null);
    mockDecisionCapsuleFindMany.mockResolvedValue([]);

    const replay = await replayDecision('capsule-incomplete');

    expect(replay.authorityChain.map((entry) => entry.nodeType)).toEqual([
      'CLINICIAN',
      'VERIFIER',
      'DECISION',
    ]);
    expect(replay.evidenceSnapshot.anomaliesDetected).toEqual(expect.arrayContaining([
      'No verification artifacts were linked into this decision replay.',
      'No root cause reference was stored with this decision.',
      'Authority chain is incomplete: no credential links captured.',
    ]));
  });

  it('returns a safe replay with tamper evidence after a partial integrity failure', async () => {
    mockVerifyDecisionCapsuleReplay.mockResolvedValue({
      capsuleId: 'capsule-1',
      valid: false,
      expectedArtifactHash: 'a'.repeat(64),
      actualArtifactHash: 'f'.repeat(64),
      expectedEvidenceSpineDigest: 'digest-1',
      actualEvidenceSpineDigest: 'digest-1',
    });

    const replay = await replayDecision('capsule-1');

    expect(replay.integrity.hashMatch).toBe(false);
    expect(replay.integrity.tamperEvidence).toContain('Hash mismatch');
    expect(replay.authorityChain).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeType: 'CLINICIAN' }),
      expect.objectContaining({ nodeType: 'VERIFIER' }),
      expect.objectContaining({ nodeType: 'DECISION' }),
    ]));
    expect(replay.evidenceSnapshot.sourcesConsulted).toHaveLength(2);
  });
});

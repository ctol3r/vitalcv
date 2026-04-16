jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    decisionCapsule: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../decision/capsuleEngine', () => ({
  capsuleEngine: {},
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import {
  addAttestation,
  DecisionAttestationError,
  extractCapsuleDecisionAttestations,
} from '../replayEngine';

const prismaMock = prisma as unknown as {
  decisionCapsule: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe('replayEngine.addAttestation', () => {
  beforeEach(() => {
    prismaMock.decisionCapsule.findUnique.mockReset();
    prismaMock.decisionCapsule.update.mockReset();
  });

  it('persists a safe attestation with a complete decision snapshot', async () => {
    prismaMock.decisionCapsule.findUnique.mockResolvedValue({
      id: 'capsule-1',
      subjectDid: 'did:vitalcv:1234567890',
      subjectNpi: '1234567890',
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-04-10T12:00:00.000Z'),
      status: 'VALID',
      methodology: 'decision_capsule.v262',
      artifactHash: 'artifact-hash-1',
      metadata: {
        triggerEvent: 'employment_acceptance',
        sourceReferenceId: 'acceptance-1',
        verifierOrgId: 'org-1',
        decisionAction: 'APPROVE',
      },
    });
    prismaMock.decisionCapsule.update.mockResolvedValue({});

    const result = await addAttestation('capsule-1', {
      attesterId: 'user-1',
      attesterRole: 'Credentialing Lead',
      statement: 'Reviewed and confirmed.',
      timestamp: '2026-04-11T09:30:00.000Z',
    });

    expect(result).toEqual({
      capsuleId: 'capsule-1',
      attestationCount: 1,
      attestedAt: '2026-04-11T09:30:00.000Z',
      created: true,
    });

    expect(prismaMock.decisionCapsule.update).toHaveBeenCalledTimes(1);
    const updateArgs = prismaMock.decisionCapsule.update.mock.calls[0]?.[0];
    expect(updateArgs.where).toEqual({ id: 'capsule-1' });
    expect(updateArgs.data.metadata).toEqual(expect.objectContaining({
      attestations: [
        expect.objectContaining({
          attesterId: 'user-1',
          attesterRole: 'Credentialing Lead',
          statement: 'Reviewed and confirmed.',
          timestamp: '2026-04-11T09:30:00.000Z',
          dedupeKey: expect.any(String),
          hash: expect.any(String),
          snapshot: {
            artifactHash: 'artifact-hash-1',
            capsuleId: 'capsule-1',
            decisionAction: 'APPROVE',
            decisionTimestamp: '2026-04-10T12:00:00.000Z',
            decisionType: 'HIRING',
            methodologyVersion: 'decision_capsule.v262',
            sourceReferenceId: 'acceptance-1',
            status: 'VALID',
            subjectDid: 'did:vitalcv:1234567890',
            subjectNpi: '1234567890',
            triggerEvent: 'employment_acceptance',
            verifierOrgId: 'org-1',
          },
        }),
      ],
    }));
    expect(JSON.stringify(updateArgs.data.metadata)).not.toContain('undefined');

    const exportedAttestations = extractCapsuleDecisionAttestations({
      id: 'capsule-1',
      subjectDid: 'did:vitalcv:1234567890',
      subjectNpi: '1234567890',
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-04-10T12:00:00.000Z'),
      status: 'VALID',
      methodology: 'decision_capsule.v262',
      artifactHash: 'artifact-hash-1',
      metadata: updateArgs.data.metadata,
    });
    expect(exportedAttestations).toHaveLength(1);
    expect(exportedAttestations[0]?.verification.hashMatch).toBe(true);
  });

  it('rejects attestation for an invalid decision capsule before updating', async () => {
    prismaMock.decisionCapsule.findUnique.mockResolvedValue({
      id: 'capsule-1',
      subjectDid: 'did:vitalcv:1234567890',
      subjectNpi: '1234567890',
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-04-10T12:00:00.000Z'),
      status: 'INVALID',
      methodology: 'decision_capsule.v262',
      artifactHash: 'artifact-hash-1',
      metadata: {
        triggerEvent: 'employment_acceptance',
        sourceReferenceId: 'acceptance-1',
      },
    });

    await expect(addAttestation('capsule-1', {
      attesterId: 'user-1',
      attesterRole: 'Credentialing Lead',
      statement: 'Reviewed and confirmed.',
    })).rejects.toMatchObject<Partial<DecisionAttestationError>>({
      code: 'ACTION_NOT_ATTESTABLE',
      statusCode: 409,
    });

    expect(prismaMock.decisionCapsule.update).not.toHaveBeenCalled();
  });

  it('rejects oversized attestation payloads before updating', async () => {
    prismaMock.decisionCapsule.findUnique.mockResolvedValue({
      id: 'capsule-1',
      subjectDid: 'did:vitalcv:1234567890',
      subjectNpi: '1234567890',
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-04-10T12:00:00.000Z'),
      status: 'VALID',
      methodology: 'decision_capsule.v262',
      artifactHash: 'artifact-hash-1',
      metadata: {
        triggerEvent: 'employment_acceptance',
        sourceReferenceId: 'acceptance-1',
      },
    });

    await expect(addAttestation('capsule-1', {
      attesterId: 'user-1',
      attesterRole: 'Credentialing Lead',
      statement: 'x'.repeat(40_000),
    })).rejects.toMatchObject<Partial<DecisionAttestationError>>({
      code: 'ATTESTATION_PAYLOAD_TOO_LARGE',
      statusCode: 413,
    });

    expect(prismaMock.decisionCapsule.update).not.toHaveBeenCalled();
  });

  it('treats duplicate attestations for the same action as idempotent', async () => {
    prismaMock.decisionCapsule.findUnique.mockResolvedValue({
      id: 'capsule-1',
      subjectDid: 'did:vitalcv:1234567890',
      subjectNpi: '1234567890',
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-04-10T12:00:00.000Z'),
      status: 'VALID',
      methodology: 'decision_capsule.v262',
      artifactHash: 'artifact-hash-1',
      metadata: {
        triggerEvent: 'employment_acceptance',
        sourceReferenceId: 'acceptance-1',
        attestations: [
          {
            attesterId: 'user-1',
            attesterRole: 'Credentialing Lead',
            statement: 'Reviewed and confirmed.',
            timestamp: '2026-04-11T09:30:00.000Z',
            hash: '8121759da1e4b827f16f9393bb9ab7f4761681118141837a4e42a8f27ecb3a91',
            snapshot: {
              artifactHash: 'artifact-hash-1',
              capsuleId: 'capsule-1',
              decisionAction: 'APPROVE',
              decisionTimestamp: '2026-04-10T12:00:00.000Z',
              decisionType: 'HIRING',
              methodologyVersion: 'decision_capsule.v262',
              sourceReferenceId: 'acceptance-1',
              status: 'VALID',
              subjectDid: 'did:vitalcv:1234567890',
              subjectNpi: '1234567890',
              triggerEvent: 'employment_acceptance',
              verifierOrgId: 'org-1',
            },
          },
        ],
      },
    });

    const result = await addAttestation('capsule-1', {
      attesterId: 'user-1',
      attesterRole: 'Credentialing Lead',
      statement: 'Reviewed and confirmed.',
      timestamp: '2026-04-12T10:15:00.000Z',
    });

    expect(result).toEqual({
      capsuleId: 'capsule-1',
      attestationCount: 1,
      attestedAt: '2026-04-11T09:30:00.000Z',
      created: false,
    });
    expect(prismaMock.decisionCapsule.update).not.toHaveBeenCalled();
  });

  it('detects tampering when exported attestation payload no longer matches the stored hash', () => {
    const exportedAttestations = extractCapsuleDecisionAttestations({
      id: 'capsule-1',
      subjectDid: 'did:vitalcv:1234567890',
      subjectNpi: '1234567890',
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-04-10T12:00:00.000Z'),
      status: 'VALID',
      methodology: 'decision_capsule.v262',
      artifactHash: 'artifact-hash-1',
      metadata: {
        triggerEvent: 'employment_acceptance',
        sourceReferenceId: 'acceptance-1',
        attestations: [
          {
            attesterId: 'user-1',
            attesterRole: 'Credentialing Lead',
            statement: 'Tampered after storage.',
            timestamp: '2026-04-11T09:30:00.000Z',
            hash: '8121759da1e4b827f16f9393bb9ab7f4761681118141837a4e42a8f27ecb3a91',
            snapshot: {
              artifactHash: 'artifact-hash-1',
              capsuleId: 'capsule-1',
              decisionAction: 'APPROVE',
              decisionTimestamp: '2026-04-10T12:00:00.000Z',
              decisionType: 'HIRING',
              methodologyVersion: 'decision_capsule.v262',
              sourceReferenceId: 'acceptance-1',
              status: 'VALID',
              subjectDid: 'did:vitalcv:1234567890',
              subjectNpi: '1234567890',
              triggerEvent: 'employment_acceptance',
              verifierOrgId: 'org-1',
            },
          },
        ],
      },
    });

    expect(exportedAttestations[0]?.verification.hashMatch).toBe(false);
    expect(exportedAttestations[0]?.verification.tamperEvidence).toContain('stored hash');
  });
});

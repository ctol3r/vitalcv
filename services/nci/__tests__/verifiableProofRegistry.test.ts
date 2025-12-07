import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NCIVerifiableProofType, PrismaClient } from '@prisma/client';
import { VerifiableProofRegistry } from '../verifiableProofRegistry.js';

describe('VerifiableProofRegistry', () => {
  const upsert = jest.fn();
  const findUnique = jest.fn();
  const findMany = jest.fn();

  const prismaMock = {
    nCIVerifiableProof: { upsert, findUnique, findMany },
  } as unknown as PrismaClient;

  let registry: VerifiableProofRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new VerifiableProofRegistry(prismaMock);
  });

  it('records proofs with deterministic hashes', async () => {
    const proof = {
      id: 'proof-1',
      did: 'did:example:hash',
      proofType: NCIVerifiableProofType.ISSUANCE,
      eventType: 'VC_ISSUED',
      payloadHash: 'abc',
      anchorTxHash: null,
      chainId: null,
      metadata: null,
      issuedFor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    upsert.mockResolvedValue(proof);

    const payload = { event: 'VC_ISSUED', timestamp: 1, nested: { value: 'A' } };
    const hashA = VerifiableProofRegistry.hashPayload(payload);
    const hashB = VerifiableProofRegistry.hashPayload({ nested: { value: 'A' }, event: 'VC_ISSUED', timestamp: 1 });

    expect(hashA).toBe(hashB);

    await registry.recordProof({
      did: proof.did,
      proofType: NCIVerifiableProofType.ISSUANCE,
      eventType: 'VC_ISSUED',
      payload,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          payloadHash_proofType: {
            payloadHash: hashA,
            proofType: NCIVerifiableProofType.ISSUANCE,
          },
        },
      })
    );
  });

  it('detects existing proofs for same payload', async () => {
    findUnique.mockResolvedValue({ id: 'proof-2', did: 'did:holder' });
    const exists = await registry.hasProof('did:holder', NCIVerifiableProofType.VERIFICATION, {
      value: 'same',
    });
    expect(exists).toBe(true);
  });
});

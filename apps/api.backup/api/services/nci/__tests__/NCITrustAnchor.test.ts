import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { generateKeyPairSync } from 'crypto';
import { AccreditationStatus, TrustEntityType, PrismaClient } from '@prisma/client';
import { NCITrustAnchorService } from '../models/NCITrustAnchor.js';

describe('NCITrustAnchorService', () => {
  const upsert = jest.fn();
  const findUnique = jest.fn();

  const prismaMock = {
    nCITrustAnchor: { upsert, findUnique },
  } as unknown as PrismaClient;

  let service: NCITrustAnchorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NCITrustAnchorService(prismaMock);
  });

  it('registers trust anchors', async () => {
    const record = {
      entityId: 'anchor-1',
      entityType: TrustEntityType.ISSUER,
      publicKey: '-----BEGIN PUBLIC KEY-----\nMIIB...IDAQAB\n-----END PUBLIC KEY-----',
      certificateChain: null,
      accreditation: AccreditationStatus.ACCREDITED,
      jurisdiction: 'CA',
      isActive: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    upsert.mockResolvedValue(record);

    const result = await service.registerAnchor({
      entityId: 'anchor-1',
      entityType: TrustEntityType.ISSUER,
      publicKey: record.publicKey,
      accreditation: AccreditationStatus.ACCREDITED,
      jurisdiction: 'CA',
    });

    expect(result).toBe(record);
    expect(upsert).toHaveBeenCalled();
  });

  it('verifies attestations signed by anchor', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const entityId = 'anchor-verify';
    const did = 'did:example:node';
    const messagePayload = { did, nonce: '123' };
    const messageBuffer = Buffer.from(JSON.stringify(messagePayload));
    const signature = privateKey.sign(messageBuffer).toString('base64');

    findUnique.mockResolvedValue({
      entityId,
      entityType: TrustEntityType.ISSUER,
      publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      certificateChain: null,
      accreditation: AccreditationStatus.ACCREDITED,
      jurisdiction: null,
      isActive: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const verified = await service.verifyAttestation({
      entityId,
      expectedDid: did,
      attestation: { message: messagePayload, signature },
    });

    expect(verified).toBe(true);
  });

  it('rejects attestations when anchor is not trusted', async () => {
    findUnique.mockResolvedValue({
      entityId: 'anchor-suspended',
      entityType: TrustEntityType.ISSUER,
      publicKey: '-----BEGIN PUBLIC KEY-----\nMIIB...IDAQAB\n-----END PUBLIC KEY-----',
      certificateChain: null,
      accreditation: AccreditationStatus.REVOKED,
      jurisdiction: null,
      isActive: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.verifyAttestation({
        entityId: 'anchor-suspended',
        expectedDid: 'did:example:bad',
        attestation: { message: 'did:example:bad', signature: 'deadbeef' },
      })
    ).rejects.toThrow('not in good standing');
  });
});

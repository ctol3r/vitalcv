import { PrismaClient } from '@prisma/client';
import { generateKeyPair, SignJWT, exportJWK } from 'jose';
import { DeviceChallengeService } from '../deviceChallenge';

describe('DeviceChallengeService', () => {
  let service: DeviceChallengeService;
  let privateKey: CryptoKey;
  let publicJwk: Record<string, unknown>;
  const deviceId = '5b2aa813-5a74-45b4-92ac-8f3b8bd73c70';
  const endpointUrl = 'https://api.vitalcv.ai/wallet/device/register';

  beforeAll(async () => {
    const { publicKey, privateKey: privKey } = await generateKeyPair('EdDSA');
    privateKey = privKey;
    publicJwk = await exportJWK(publicKey);
    publicJwk.alg = 'EdDSA';
    publicJwk.kty = 'OKP';
    publicJwk.crv = 'Ed25519';
  });

  beforeEach(() => {
    service = new DeviceChallengeService();
  });

  function createMockPrisma(): PrismaClient {
    return {
      walletDevice: {
        findUnique: jest.fn().mockResolvedValue({
          deviceId,
          clinicianId: 'clin-1',
          publicKeyJwk: publicJwk,
          metadata: null,
          createdAt: new Date(),
          lastUsedAt: null,
        }),
        update: jest.fn().mockResolvedValue(true),
      },
    } as unknown as PrismaClient;
  }

  it('issues challenge with nonce and expiration', () => {
    const challenge = service.issueChallenge(deviceId);
    expect(challenge.nonce).toMatch(/[a-f0-9-]{36}/i);
    expect(new Date(challenge.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('verifies valid proof and rotates challenge', async () => {
    const challenge = service.issueChallenge(deviceId);
    const proof = await new SignJWT({
      nonce: challenge.nonce,
      htm: 'POST',
      htu: endpointUrl,
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({
        alg: 'EdDSA',
        typ: 'dpop+jwt',
        jwk: publicJwk,
      })
      .sign(privateKey);

    const prisma = createMockPrisma();
    const result = await service.verifyChallenge({
      prisma,
      deviceId,
      proof,
      method: 'POST',
      url: endpointUrl,
    });

    expect(result.device.deviceId).toBe(deviceId);
    expect(result.nextChallenge.nonce).not.toBe(challenge.nonce);
    expect(result.nextChallenge.expiresAt).toBeDefined();
    expect((prisma.walletDevice.update as jest.Mock).mock.calls.length).toBe(1);
  });

  it('throws when nonce does not match', async () => {
    service.issueChallenge(deviceId);
    const proof = await new SignJWT({
      nonce: 'wrong-nonce',
      htm: 'POST',
      htu: endpointUrl,
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({
        alg: 'EdDSA',
        typ: 'dpop+jwt',
        jwk: publicJwk,
      })
      .sign(privateKey);

    const prisma = createMockPrisma();

    await expect(
      service.verifyChallenge({
        prisma,
        deviceId,
        proof,
        method: 'POST',
        url: endpointUrl,
      })
    ).rejects.toThrow('nonce_mismatch');
  });
});


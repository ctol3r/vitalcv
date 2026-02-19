import { generateKeyPairSync } from 'crypto';
import { signArtifact, verifySignature, getJwks, _resetKeyCache } from '../services/signingService';

describe('signingService', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };

    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    process.env['PSV_SIGNING_PRIVATE_KEY'] = privateKey as string;
    process.env['PSV_SIGNING_PUBLIC_KEY'] = publicKey as string;
    process.env['PSV_SIGNING_KID'] = 'test-key-1';

    _resetKeyCache();
  });

  afterAll(() => {
    process.env = originalEnv;
    _resetKeyCache();
  });

  it('signs a payload and returns valid JWS', async () => {
    const payload = '{"test":"data"}';
    const result = await signArtifact(payload);

    expect(result.signature).toBeDefined();
    expect(result.publicKeyId).toBe('test-key-1');
    expect(result.signedAt).toBeDefined();

    const parts = result.signature.split('.');
    expect(parts).toHaveLength(3);
  });

  it('signature verifies with the public key', async () => {
    const payload = '{"npi":"1234567890","status":"ACTIVE"}';
    const result = await signArtifact(payload);

    const { valid, payload: decoded } = verifySignature(result.signature);
    expect(valid).toBe(true);
    expect(decoded).toBe(payload);
  });

  it('tampered payload fails verification', async () => {
    const payload = '{"npi":"1234567890","status":"ACTIVE"}';
    const result = await signArtifact(payload);

    // Tamper with the payload part of the JWS
    const parts = result.signature.split('.');
    const tamperedPayload = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'A' ? 'B' : 'A');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const { valid } = verifySignature(tampered);
    expect(valid).toBe(false);
  });

  it('JWKS endpoint returns valid key', () => {
    const jwks = getJwks();

    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]['kid']).toBe('test-key-1');
    expect(jwks.keys[0]['alg']).toBe('ES256');
    expect(jwks.keys[0]['use']).toBe('sig');
    expect(jwks.keys[0]['kty']).toBe('EC');
    expect(jwks.keys[0]['crv']).toBe('P-256');
    // Must NOT contain private key material
    expect(jwks.keys[0]['d']).toBeUndefined();
  });
});

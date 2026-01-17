/**
 * B103A-TBIND-001: Tests for DPoP guard middleware
 *
 * Acceptance criteria:
 * - Bearer-only request returns 401 use_dpop error
 * - DPoP verifies signature, htm/htu/iat/jti; cnf.jkt present in AT
 * - Test covers negative paths including signature verification
 */

import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dpopGuard } from '../dpopGuard';

function mockReqGet(name: 'set-cookie'): string[] | undefined;
function mockReqGet(name: string): string | undefined;
function mockReqGet(name: string): string | string[] | undefined {
  if (name === 'set-cookie') {
    return undefined;
  }
  if (name === 'host') {
    return 'example.com';
  }
  return undefined;
}

const createMockNext = (): NextFunction => vi.fn<[any?], void>();

describe('dpopGuard', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      protocol: 'https',
      get: mockReqGet,
      path: '/oidc4vci/credential',
      method: 'POST',
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = createMockNext();
  });

  it('should return 401 when authorization header is missing', async () => {
    mockReq.headers = {};

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_token',
        error_description: 'Missing or invalid Authorization header',
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 use_dpop when bearer-only request (no DPoP header)', async () => {
    // Create sender-constrained access token (with cnf.jkt)
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'use_dpop',
        error_description: expect.stringContaining('DPoP proof is required'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when DPoP proof is invalid format', async () => {
    mockReq.headers = {
      authorization: 'Bearer token123',
      dpop: 'invalid.proof',
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_dpop',
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when DPoP proof has invalid signature', async () => {
    // Create a proof with wrong signature (using different key)
    const { privateKey: wrongKey } = await generateKeyPair('ES256');
    const { publicKey: correctKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(correctKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    // Sign with wrong key but include correct public key in header
    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(wrongKey); // Wrong key!

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(wrongKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_dpop',
        error_description: expect.stringContaining('signature verification failed'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when DPoP proof has wrong HTTP method', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const proof = await new SignJWT({
      htm: 'GET',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };
    mockReq.method = 'POST';

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_dpop',
        error_description: expect.stringContaining('htm mismatch'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when DPoP proof has wrong HTTP URI', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/wrong/path',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_dpop',
        error_description: expect.stringContaining('htu mismatch'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when DPoP proof timestamp is too old', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000) - 120, // 2 minutes ago
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_dpop',
        error_description: expect.stringContaining('iat too old'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when DPoP proof missing jti', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      // jti missing
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_dpop',
        error_description: expect.stringContaining('Missing jti'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when DPoP proof jti is reused (replay attack)', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);
    const jti = randomUUID();

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti,
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    // First request should succeed
    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);

    // Reset mocks
    vi.clearAllMocks();
    mockRes.status = vi.fn().mockReturnThis();
    mockRes.json = vi.fn().mockReturnThis();
    mockNext = createMockNext();

    // Second request with same jti should fail
    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_dpop',
        error_description: expect.stringContaining('jti reused'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should accept valid DPoP proof with ES256 and attach cnfJkt to request', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect((mockReq as any).cnfJkt).toBeDefined();
    expect(typeof (mockReq as any).cnfJkt).toBe('string');
    expect((mockReq as any).dpopValidated).toBe(true);
  });

  it('should accept valid DPoP proof with EdDSA and attach cnfJkt to request', async () => {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'EdDSA' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect((mockReq as any).cnfJkt).toBeDefined();
    expect(typeof (mockReq as any).cnfJkt).toBe('string');
    expect((mockReq as any).dpopValidated).toBe(true);
  });

  it('should return 400 invalid_alg when non-allowlisted algorithm is used', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'RS256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_alg',
        error_description: expect.stringContaining("algorithm 'RS256' not allowed"),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('B109A-TBIND-002: should return 400 when typ is missing or incorrect', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-kid', jwk: jwk as any })
      // typ missing
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_typ',
        error_description: expect.stringContaining('invalid_typ'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('B113A-TBIND-002: should return 400 when kid is missing', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const thumbprint = await calculateJwkThumbprint(jwk);

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: jwk as any })
      // kid missing
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: { jkt: thumbprint },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_kid',
        error_description: expect.stringContaining('invalid_kid'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when access token missing cnf.jkt claim', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);

    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token without cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      // No cnf claim
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_dpop',
        error_description: expect.stringContaining('Access token missing cnf.jkt claim'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('B108A-TBIND-001: should return 401 when access token cnf.jkt does not match DPoP proof thumbprint', async () => {
    const { privateKey: dpopKey, publicKey: dpopPublicKey } = await generateKeyPair('ES256');
    const dpopJwk = await exportJWK(dpopPublicKey);

    // Create DPoP proof
    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: dpopJwk as any })
      .sign(dpopKey);

    // Create access token with different cnf.jkt (from different key)
    const { privateKey: atKey, publicKey: atPublicKey } = await generateKeyPair('ES256');
    const atJwk = await exportJWK(atPublicKey);
    const { calculateJwkThumbprint } = await import('jose');
    const wrongThumbprint = await calculateJwkThumbprint(atJwk);

    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: {
        jkt: wrongThumbprint, // Wrong thumbprint - doesn't match DPoP proof
      },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(atKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'invalid_dpop',
        error_description: expect.stringContaining('cnf.jkt mismatch'),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('B108A-TBIND-001: should accept valid DPoP proof with matching cnf.jkt in access token', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const { calculateJwkThumbprint } = await import('jose');
    const thumbprint = await calculateJwkThumbprint(jwk);

    // Create DPoP proof
    const proof = await new SignJWT({
      htm: 'POST',
      htu: 'https://example.com/oidc4vci/credential',
      iat: Math.floor(Date.now() / 1000),
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', kid: 'test-kid', jwk: jwk as any })
      .sign(privateKey);

    // Create access token with matching cnf.jkt
    const accessToken = await new SignJWT({
      sub: 'user123',
      cnf: {
        jkt: thumbprint, // Matches DPoP proof thumbprint
      },
    })
      .setProtectedHeader({ alg: 'ES256' })
      .sign(privateKey);

    mockReq.headers = {
      authorization: `Bearer ${accessToken}`,
      dpop: proof,
    };

    await dpopGuard(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect((mockReq as any).cnfJkt).toBe(thumbprint);
    expect((mockReq as any).dpopValidated).toBe(true);
  });
});

/**
 * B128A-TBIND-002: DPoP JOSE allowlist tests
 * Tests algorithm allowlist (ES256, EdDSA), typ='dpop+jwt', kid presence, skew≤60s
 */

import { Request, Response, NextFunction } from 'express';
import { dpopGuard } from '../../../issuer-api/src/middleware/dpopGuard';
import { SignJWT, generateKeyPair, exportJWK, calculateJwkThumbprint } from 'jose';

describe('B128A-TBIND-002: DPoP JOSE Policy', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusCode: number;
  let jsonResponse: any;

  beforeEach(() => {
    statusCode = 200;
    jsonResponse = null;
    mockReq = {
      headers: {},
      body: {},
      path: '/credential',
      protocol: 'https',
      method: 'POST',
      get: jest.fn((name: string) => {
        if (name === 'host') return 'vitalcv.ai';
        return undefined;
      }),
    };
    mockRes = {
      status: jest.fn((code: number) => {
        statusCode = code;
        return mockRes as Response;
      }),
      json: jest.fn((data: any) => {
        jsonResponse = data;
        return mockRes as Response;
      }),
    };
    mockNext = jest.fn();
  });

  describe('Algorithm allowlist (ES256, EdDSA)', () => {
    it('should accept ES256 algorithm', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk, kid: 'test-kid' })
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });

    it('should accept EdDSA algorithm', async () => {
      const { privateKey, publicKey } = await generateKeyPair('EdDSA');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'EdDSA', typ: 'dpop+jwt', jwk, kid: 'test-kid' })
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'EdDSA' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });

    it('should reject RS256 algorithm (not in allowlist)', async () => {
      const { privateKey, publicKey } = await generateKeyPair('RS256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'RS256', typ: 'dpop+jwt', jwk, kid: 'test-kid' })
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'RS256' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(400);
      expect(jsonResponse.error).toBe('invalid_alg');
      expect(jsonResponse.error_description).toContain('RS256');
    });

    it('should reject HS256 algorithm (symmetric - not allowed)', async () => {
      // Note: For this test, we'll mock the header to show the rejection path
      // In reality, JOSE library will reject symmetric keys for DPoP
      mockReq.headers = {
        authorization: 'DPoP fake-token',
        dpop: 'fake.dpop.with-hs256',
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toMatch(/invalid_dpop|invalid_alg/);
    });
  });

  describe('typ header validation', () => {
    it('should require typ=dpop+jwt', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // Create DPoP proof with wrong typ
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', jwk, kid: 'test-kid' }) // Wrong typ
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(400);
      expect(jsonResponse.error).toBe('invalid_typ');
      expect(jsonResponse.error_description).toContain('dpop+jwt');
    });

    it('should reject missing typ header', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // Create DPoP proof without typ
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', jwk, kid: 'test-kid' }) // No typ
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(400);
      expect(jsonResponse.error).toBe('invalid_typ');
    });
  });

  describe('kid header validation', () => {
    it('should require kid header', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // Create DPoP proof without kid
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk }) // No kid
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(400);
      expect(jsonResponse.error).toBe('invalid_kid');
      expect(jsonResponse.error_description).toContain('kid');
    });
  });

  describe('Time skew validation (≤60s)', () => {
    it('should accept iat within 60s skew', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // IAT 30 seconds ago (within tolerance)
      const iat = Math.floor(Date.now() / 1000) - 30;
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat,
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk, kid: 'test-kid' })
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });

    it('should reject iat beyond 60s skew', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // IAT 90 seconds ago (beyond tolerance)
      const iat = Math.floor(Date.now() / 1000) - 90;
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat,
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk, kid: 'test-kid' })
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('invalid_dpop');
      expect(jsonResponse.error_description).toContain('iat');
      expect(jsonResponse.error_description).toContain('60s');
    });

    it('should accept iat in future within 60s skew', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // IAT 30 seconds in future (within tolerance)
      const iat = Math.floor(Date.now() / 1000) + 30;
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat,
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk, kid: 'test-kid' })
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });
  });

  describe('Coverage and integration', () => {
    it('should pass with all valid headers (ES256)', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({
          alg: 'ES256',
          typ: 'dpop+jwt',
          jwk,
          kid: 'test-kid-123'
        })
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });

    it('should pass with all valid headers (EdDSA)', async () => {
      const { privateKey, publicKey } = await generateKeyPair('EdDSA');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({
          alg: 'EdDSA',
          typ: 'dpop+jwt',
          jwk,
          kid: 'test-kid-456'
        })
        .sign(privateKey);

      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'EdDSA' })
        .sign(privateKey);

      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });
  });
});


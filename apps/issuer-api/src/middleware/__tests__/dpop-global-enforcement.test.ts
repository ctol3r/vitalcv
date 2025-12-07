/**
 * B128A-TBIND-001: Test DPoP sender-constrained AT global enforcement
 * Tests that Bearer-only tokens are rejected and DPoP is enforced everywhere
 */

import { Request, Response, NextFunction } from 'express';
import { dpopGuard } from '../dpopGuard';
import { SignJWT, generateKeyPair, exportJWK, calculateJwkThumbprint } from 'jose';

describe('B128A-TBIND-001: DPoP Global Enforcement', () => {
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

  describe('Bearer-only token rejection', () => {
    it('should reject Bearer-only token without DPoP header (use_dpop error)', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token-here',
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      // Wait for async validation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('use_dpop');
      expect(jsonResponse.error_description).toContain('DPoP proof is required');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject Bearer token for credential endpoint', async () => {
      mockReq.path = '/credential';
      mockReq.headers = {
        authorization: 'Bearer valid-token',
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('use_dpop');
    });

    it('should reject Bearer token for batch endpoint', async () => {
      mockReq.path = '/batch';
      mockReq.headers = {
        authorization: 'Bearer valid-token',
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('use_dpop');
    });

    it('should reject Bearer token for deferred endpoint', async () => {
      mockReq.path = '/deferred';
      mockReq.headers = {
        authorization: 'Bearer valid-token',
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('use_dpop');
    });
  });

  describe('cnf.jkt claim validation', () => {
    it('should require cnf.jkt in access token for credential endpoints', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // Create DPoP proof
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk, kid: 'test-kid' })
        .sign(privateKey);

      // Access token WITHOUT cnf.jkt
      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.path = '/credential';
      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('invalid_dpop');
      expect(jsonResponse.error_description).toContain('cnf.jkt');
    });

    it('should validate cnf.jkt matches DPoP proof thumbprint', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // Create DPoP proof
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk, kid: 'test-kid' })
        .sign(privateKey);

      // Access token WITH correct cnf.jkt
      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: thumbprint },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.path = '/credential';
      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });

    it('should reject mismatched cnf.jkt', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);

      // Create DPoP proof
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        jti: `jti-${Date.now()}`,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk, kid: 'test-kid' })
        .sign(privateKey);

      // Access token WITH mismatched cnf.jkt
      const accessToken = await new SignJWT({
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        cnf: { jkt: 'wrong-thumbprint' },
      })
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

      mockReq.path = '/credential';
      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('invalid_dpop');
      expect(jsonResponse.error_description).toContain('mismatch');
    });
  });

  describe('DPoP proof validation', () => {
    it('should validate htm (HTTP method)', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // Create DPoP proof with wrong HTM
      const dpopProof = await new SignJWT({
        htm: 'GET', // Wrong method - should be POST
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

      mockReq.path = '/credential';
      mockReq.method = 'POST';
      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('invalid_dpop');
      expect(jsonResponse.error_description).toContain('htm');
    });

    it('should validate htu (HTTP URI)', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // Create DPoP proof with wrong HTU
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://evil.com/credential', // Wrong URI
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

      mockReq.path = '/credential';
      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('invalid_dpop');
      expect(jsonResponse.error_description).toContain('htu');
    });

    it('should validate iat (issued at time) within 60s skew', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // Create DPoP proof with old IAT (more than 60s ago)
      const oldIat = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: oldIat,
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

      mockReq.path = '/credential';
      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('invalid_dpop');
      expect(jsonResponse.error_description).toContain('iat');
    });

    it('should validate jti presence', async () => {
      const { privateKey, publicKey } = await generateKeyPair('ES256');
      const jwk = await exportJWK(publicKey);
      const thumbprint = await calculateJwkThumbprint(jwk);

      // Create DPoP proof WITHOUT jti
      const dpopProof = await new SignJWT({
        htm: 'POST',
        htu: 'https://vitalcv.ai/credential',
        iat: Math.floor(Date.now() / 1000),
        // Missing jti
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

      mockReq.path = '/credential';
      mockReq.headers = {
        authorization: `DPoP ${accessToken}`,
        dpop: dpopProof,
      };

      dpopGuard(mockReq as Request, mockRes as Response, mockNext);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusCode).toBe(401);
      expect(jsonResponse.error).toBe('invalid_dpop');
      expect(jsonResponse.error_description).toContain('jti');
    });
  });
});


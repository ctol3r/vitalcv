/**
 * B100B-TBIND-039: Tests for Access/Refresh Token Policy
 *
 * Acceptance criteria:
 * - AT embeds cnf.jkt
 * - RT sender-constrained & rotates
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { issueAccessToken, issueRefreshToken, validateAndRotateRefreshToken } from '../services/tokenService';
import { generateKeyPair, exportJWK, calculateJwkThumbprint } from 'jose';

describe('B100B-TBIND-039: Access/Refresh Token Policy', () => {
  let testJwk: any;
  let testPrivateJwk: any;
  let testCnfJkt: string;

  beforeEach(async () => {
    // Generate test JWK for DPoP
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    testJwk = await exportJWK(publicKey);
    testPrivateJwk = await exportJWK(privateKey);
    process.env.SIGNING_KEY_JWK = JSON.stringify(testPrivateJwk);
    testCnfJkt = await calculateJwkThumbprint(testJwk);
  });

  describe('Access Token Issuance', () => {
    it('should embed cnf.jkt claim when DPoP is used', async () => {
      const token = await issueAccessToken({
        clientId: 'test-client',
        scope: ['openid', 'credential:issue'],
        cnfJkt: testCnfJkt,
        expiresIn: 3600,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Decode token to verify cnf.jkt claim
      const parts = token.split('.');
      expect(parts.length).toBe(3); // JWT has 3 parts

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      expect(payload.cnf).toBeDefined();
      expect(payload.cnf.jkt).toBe(testCnfJkt);
    });

    it('should not include cnf.jkt when DPoP is not used', async () => {
      const token = await issueAccessToken({
        clientId: 'test-client',
        scope: ['openid'],
        expiresIn: 3600,
      });

      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      expect(payload.cnf).toBeUndefined();
    });
  });

  describe('Refresh Token Issuance', () => {
    it('should issue refresh token with DPoP constraint', async () => {
      const result = await issueRefreshToken({
        clientId: 'test-client',
        scope: ['openid'],
        cnfJkt: testCnfJkt,
        expiresIn: 604800,
      });

      expect(result.token).toBeDefined();
      expect(result.tokenId).toBeDefined();
      expect(typeof result.token).toBe('string');
    });

    it('should issue refresh token with mTLS constraint', async () => {
      const certFingerprint = 'test-cert-fingerprint';
      const result = await issueRefreshToken({
        clientId: 'test-client',
        scope: ['openid'],
        clientCert: certFingerprint,
        expiresIn: 604800,
      });

      expect(result.token).toBeDefined();
      expect(result.tokenId).toBeDefined();
    });

    it('should reject refresh token without sender-constraint', async () => {
      await expect(
        issueRefreshToken({
          clientId: 'test-client',
          scope: ['openid'],
          expiresIn: 604800,
        })
      ).rejects.toThrow('Refresh tokens must be sender-constrained');
    });
  });

  describe('Refresh Token Rotation', () => {
    it('should rotate refresh token on use', async () => {
      // Issue initial refresh token
      const initialResult = await issueRefreshToken({
        clientId: 'test-client',
        scope: ['openid', 'credential:issue'],
        cnfJkt: testCnfJkt,
        expiresIn: 604800,
      });

      // Use refresh token to get new tokens
      const rotatedResult = await validateAndRotateRefreshToken(
        initialResult.token,
        testCnfJkt
      );

      expect(rotatedResult.accessToken).toBeDefined();
      expect(rotatedResult.refreshToken).toBeDefined();
      expect(rotatedResult.refreshToken).not.toBe(initialResult.token);
      expect(rotatedResult.scope).toEqual(['openid', 'credential:issue']);
    });

    it('should reject reused refresh token', async () => {
      const initialResult = await issueRefreshToken({
        clientId: 'test-client',
        scope: ['openid'],
        cnfJkt: testCnfJkt,
        expiresIn: 604800,
      });

      // First use - should succeed
      await validateAndRotateRefreshToken(initialResult.token, testCnfJkt);

      // Second use - should fail (token already rotated)
      await expect(
        validateAndRotateRefreshToken(initialResult.token, testCnfJkt)
      ).rejects.toThrow('refresh_token_already_used');
    });

    it('should validate sender-constraint on refresh', async () => {
      const initialResult = await issueRefreshToken({
        clientId: 'test-client',
        scope: ['openid'],
        cnfJkt: testCnfJkt,
        expiresIn: 604800,
      });

      // Try to use with wrong cnf.jkt
      const wrongJkt = 'wrong-jkt';
      await expect(
        validateAndRotateRefreshToken(initialResult.token, wrongJkt)
      ).rejects.toThrow('sender_constraint_mismatch');
    });

    it('should preserve sender-constraint in rotated tokens', async () => {
      const initialResult = await issueRefreshToken({
        clientId: 'test-client',
        scope: ['openid'],
        cnfJkt: testCnfJkt,
        expiresIn: 604800,
      });

      const rotatedResult = await validateAndRotateRefreshToken(
        initialResult.token,
        testCnfJkt
      );

      // New access token should have cnf.jkt
      const accessTokenParts = rotatedResult.accessToken.split('.');
      const accessPayload = JSON.parse(Buffer.from(accessTokenParts[1], 'base64url').toString());
      expect(accessPayload.cnf.jkt).toBe(testCnfJkt);

      // New refresh token should preserve constraint
      const secondRotatedResult = await validateAndRotateRefreshToken(
        rotatedResult.refreshToken,
        testCnfJkt
      );
      expect(secondRotatedResult.accessToken).toBeDefined();
    });
  });
});

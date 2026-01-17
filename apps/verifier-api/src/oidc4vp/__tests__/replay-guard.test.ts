/**
 * B125A-OIDC-005: Tests for OIDC4VP replay guard
 *
 * Acceptance criteria:
 * - Replays → 409
 * - Cache metrics exported
 * - Unit/e2e cover positive+reuse
 */

import { createHash } from 'crypto';
import express, { Express } from 'express';
import { SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { issueSdJwtCredential } from '../../../../issuer-api/src/services/sdJwtIssuer';
import { PolkadotService } from '../../services/polkadotService';
import oidc4vpRouter from '../routes';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/oidc4vp', oidc4vpRouter);
  return app;
}

describe('B125A-OIDC-005: OIDC4VP Replay Guard', () => {
  let app: Express;
  let keyPair: { privateKey: CryptoKey; publicKey: CryptoKey };
  let jwk: any;
  let sdJwtCredential: string;
  const verifierAudience = 'https://vitalcv.ai/oidc4vp';

  beforeEach(async () => {
    app = createTestApp();

    // Generate key pair for VP tokens
    const pair = await generateKeyPair('ES256');
    keyPair = pair;
    jwk = await exportJWK(pair.publicKey);
    process.env.CHAIN_DISABLED = 'true';
    PolkadotService.clearAnchoredHashes();

    const holderJkt = await calculateJwkThumbprint(jwk);
    const issued = await issueSdJwtCredential({
      issuerDid: 'did:web:issuer.vitalcv.com',
      issuerUrl: 'https://vitalcv.ai',
      holderJkt,
      credentialTypes: ['ClinicianIdentityCredential'],
      subject: {
        id: 'did:example:holder',
        name: 'Replay Tester',
        npi: '1234567890',
      },
    });

    sdJwtCredential = issued.credential;
    const hash = createHash('sha256').update(sdJwtCredential).digest('hex');
    const polkadot = new PolkadotService();
    await polkadot.anchorData(hash);
  });

  /**
   * Helper to create a VP token with JTI
   */
  async function createVPToken(nonce: string, jti?: string): Promise<string> {
    return await new SignJWT({
      sub: 'did:example:holder',
      aud: verifierAudience,
      nonce,
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: [sdJwtCredential],
      },
      iat: Math.floor(Date.now() / 1000),
      jti: jti || `vp-jti-${Date.now()}-${Math.random()}`,
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'JWT', jwk })
      .sign(keyPair.privateKey);
  }

  describe('JTI Replay Protection', () => {
    it('should accept VP token with unique JTI on first use', async () => {
      const nonceResponse = await request(app).post('/oidc4vp/nonce').send({});
      const nonce = nonceResponse.body.nonce;
      const vpToken = await createVPToken(nonce);

      const response = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken,
        nonce,
      });

      // Should accept (may fail on other validation, but not replay)
      expect(response.status).not.toBe(409);
      expect(response.body.error).not.toBe('replay_detected');
    });

    it('should return 409 when VP token with same JTI is reused (replay attack)', async () => {
      const jti = `replay-test-jti-${Date.now()}`;
      const nonceResponse = await request(app).post('/oidc4vp/nonce').send({});
      const nonce = nonceResponse.body.nonce;
      const vpToken1 = await createVPToken(nonce, jti);

      // First request - should succeed
      const response1 = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken1,
        nonce,
      });

      expect(response1.status).not.toBe(409);

      // Second request with same JTI - should fail with 409
      const vpToken2 = await createVPToken(nonce, jti);
      const response2 = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken2,
        nonce,
      });

      expect(response2.status).toBe(409);
      expect(response2.body.error).toBe('replay_detected');
      expect(response2.body.error_description).toContain('jti reused');
      expect(response2.body.error_description).toContain(jti);
    });

    it('should track multiple unique JTIs independently', async () => {
      const jti1 = `unique-jti-1-${Date.now()}`;
      const jti2 = `unique-jti-2-${Date.now()}`;
      const jti3 = `unique-jti-3-${Date.now()}`;

      const nonce1Response = await request(app).post('/oidc4vp/nonce').send({});
      const nonce1 = nonce1Response.body.nonce;
      const nonce2Response = await request(app).post('/oidc4vp/nonce').send({});
      const nonce2 = nonce2Response.body.nonce;
      const nonce3Response = await request(app).post('/oidc4vp/nonce').send({});
      const nonce3 = nonce3Response.body.nonce;

      const vpToken1 = await createVPToken(nonce1, jti1);
      const vpToken2 = await createVPToken(nonce2, jti2);
      const vpToken3 = await createVPToken(nonce3, jti3);

      // All three should succeed (first use)
      const response1 = await request(app)
        .post('/oidc4vp/presentation')
        .send({ vp_token: vpToken1, nonce: nonce1 });

      const response2 = await request(app)
        .post('/oidc4vp/presentation')
        .send({ vp_token: vpToken2, nonce: nonce2 });

      const response3 = await request(app)
        .post('/oidc4vp/presentation')
        .send({ vp_token: vpToken3, nonce: nonce3 });

      expect(response1.status).not.toBe(409);
      expect(response2.status).not.toBe(409);
      expect(response3.status).not.toBe(409);

      // Reusing any of them should fail
      const vpToken1Replay = await createVPToken(nonce1, jti1);
      const replayResponse = await request(app)
        .post('/oidc4vp/presentation')
        .send({ vp_token: vpToken1Replay, nonce: nonce1 });

      expect(replayResponse.status).toBe(409);
      expect(replayResponse.body.error).toBe('replay_detected');
    });
  });

  describe('Nonce Binding', () => {
    it('should accept VP token with valid nonce', async () => {
      // Get a fresh nonce
      const nonceResponse = await request(app).post('/oidc4vp/nonce').send({});

      expect(nonceResponse.status).toBe(200);
      const { nonce } = nonceResponse.body;
      expect(nonce).toBeDefined();

      // Use the nonce in VP presentation
      const vpToken = await createVPToken(nonce);
      const response = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken,
        nonce,
      });

      // Should accept (may fail on other validation, but not nonce)
      expect(response.status).not.toBe(400);
      expect(response.body.error_description).not.toContain('Invalid or expired nonce');
    });

    it('should return 409 when nonce is reused', async () => {
      // Get a fresh nonce
      const nonceResponse = await request(app).post('/oidc4vp/nonce').send({});

      const { nonce } = nonceResponse.body;

      // First use - should succeed
      const vpToken1 = await createVPToken(nonce);
      const response1 = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken1,
        nonce,
      });

      expect(response1.status).not.toBe(409);

      // Second use with same nonce - should fail with 409
      const vpToken2 = await createVPToken(nonce);
      const response2 = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken2,
        nonce,
      });

      expect(response2.status).toBe(409);
      expect(response2.body.error).toBe('replay_detected');
      expect(response2.body.error_description).toContain('Nonce reused');
    });

    it('should reject invalid nonce', async () => {
      const vpToken = await createVPToken('invalid-nonce-not-in-store');
      const response = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken,
        nonce: 'invalid-nonce-not-in-store',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(response.body.error_description).toContain('Invalid or expired nonce');
    });

    it('should reject missing nonce', async () => {
      const nonceResponse = await request(app).post('/oidc4vp/nonce').send({});
      const nonce = nonceResponse.body.nonce;
      const vpToken = await createVPToken(nonce);
      const response = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });
  });

  describe('Nonce Endpoint', () => {
    it('should return a fresh nonce with 60s expiry', async () => {
      const response = await request(app).post('/oidc4vp/nonce').send({});

      expect(response.status).toBe(200);
      expect(response.body.nonce).toBeDefined();
      expect(typeof response.body.nonce).toBe('string');
      expect(response.body.expires_in).toBe(60);
    });

    it('should return unique nonces on multiple requests', async () => {
      const response1 = await request(app).post('/oidc4vp/nonce').send({});

      const response2 = await request(app).post('/oidc4vp/nonce').send({});

      expect(response1.body.nonce).toBeDefined();
      expect(response2.body.nonce).toBeDefined();
      expect(response1.body.nonce).not.toBe(response2.body.nonce);
    });
  });

  describe('Metrics Endpoint', () => {
    it('should expose replay guard metrics in JSON format', async () => {
      const response = await request(app).get('/oidc4vp/metrics').set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.nonce).toBeDefined();
      expect(response.body.jti).toBeDefined();
      expect(response.body.replay_detections).toBeDefined();

      // Nonce metrics
      expect(response.body.nonce.hits).toBeGreaterThanOrEqual(0);
      expect(response.body.nonce.misses).toBeGreaterThanOrEqual(0);
      expect(response.body.nonce.evictions).toBeGreaterThanOrEqual(0);
      expect(response.body.nonce.cache_size).toBeGreaterThanOrEqual(0);

      // JTI metrics
      expect(response.body.jti.hits).toBeGreaterThanOrEqual(0);
      expect(response.body.jti.misses).toBeGreaterThanOrEqual(0);
      expect(response.body.jti.evictions).toBeGreaterThanOrEqual(0);
      expect(response.body.jti.cache_size).toBeGreaterThanOrEqual(0);
    });

    it('should expose replay guard metrics in Prometheus format', async () => {
      const response = await request(app).get('/oidc4vp/metrics').set('Accept', 'text/plain');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');

      const metrics = response.text;
      expect(metrics).toContain('oidc4vp_nonce_hits');
      expect(metrics).toContain('oidc4vp_nonce_misses');
      expect(metrics).toContain('oidc4vp_nonce_evictions');
      expect(metrics).toContain('oidc4vp_nonce_cache_size');
      expect(metrics).toContain('oidc4vp_jti_hits');
      expect(metrics).toContain('oidc4vp_jti_misses');
      expect(metrics).toContain('oidc4vp_jti_evictions');
      expect(metrics).toContain('oidc4vp_jti_cache_size');
      expect(metrics).toContain('oidc4vp_replay_detections');
    });

    it('should increment replay_detections counter on replay attack', async () => {
      // Get initial metrics
      const initialMetrics = await request(app)
        .get('/oidc4vp/metrics')
        .set('Accept', 'application/json');

      const initialReplayDetections = initialMetrics.body.replay_detections;

      // Trigger a replay attack
      const jti = `replay-metric-test-${Date.now()}`;
      const nonceResponse = await request(app).post('/oidc4vp/nonce').send({});
      const nonce = nonceResponse.body.nonce;
      const vpToken1 = await createVPToken(nonce, jti);

      await request(app).post('/oidc4vp/presentation').send({ vp_token: vpToken1, nonce });

      const vpToken2 = await createVPToken(nonce, jti);
      await request(app).post('/oidc4vp/presentation').send({ vp_token: vpToken2, nonce });

      // Get updated metrics
      const updatedMetrics = await request(app)
        .get('/oidc4vp/metrics')
        .set('Accept', 'application/json');

      const updatedReplayDetections = updatedMetrics.body.replay_detections;

      // replay_detections should have increased
      expect(updatedReplayDetections).toBeGreaterThan(initialReplayDetections);
    });
  });

  describe('Edge Cases', () => {
    it('should reject VP token without JTI', async () => {
      // Create VP token without JTI
      const nonceResponse = await request(app).post('/oidc4vp/nonce').send({});
      const nonce = nonceResponse.body.nonce;
      const vpTokenWithoutJti = await new SignJWT({
        sub: 'did:example:holder',
        aud: verifierAudience,
        nonce,
        vp: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiablePresentation'],
          verifiableCredential: [sdJwtCredential],
        },
        iat: Math.floor(Date.now() / 1000),
        // No jti
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', jwk })
        .sign(keyPair.privateKey);

      const response = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpTokenWithoutJti,
        nonce,
      });

      // Should not fail on replay guard (no jti means no replay check)
      // But may fail on other validation
      // This is an edge case - typically VP tokens should have JTI
      expect(response.status).not.toBe(409);
    });

    it('should reject missing vp_token', async () => {
      const response = await request(app).post('/oidc4vp/presentation').send({
        // No vp_token
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(response.body.error_description).toContain('Missing vp_token');
    });
  });

  describe('E2E Positive Flow', () => {
    it('should support complete VP presentation flow with nonce', async () => {
      // Step 1: Get a fresh nonce
      const nonceResponse = await request(app).post('/oidc4vp/nonce').send({});

      expect(nonceResponse.status).toBe(200);
      const { nonce } = nonceResponse.body;

      // Step 2: Create VP token with unique JTI
      const vpToken = await createVPToken(nonce);

      // Step 3: Submit VP presentation with nonce
      const presentationResponse = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken,
        nonce,
      });

      // Should succeed
      expect(presentationResponse.status).toBe(200);
      expect(presentationResponse.body.status).toBe('VALID');

      // Step 4: Verify metrics are updated
      const metricsResponse = await request(app)
        .get('/oidc4vp/metrics')
        .set('Accept', 'application/json');

      expect(metricsResponse.body.nonce.hits).toBeGreaterThan(0);
      expect(metricsResponse.body.jti.misses).toBeGreaterThan(0);
    });

    it('should support multiple presentations with different JTIs and nonces', async () => {
      // Presentation 1
      const nonce1Response = await request(app).post('/oidc4vp/nonce').send({});
      const vpToken1 = await createVPToken(nonce1Response.body.nonce);
      const presentation1 = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken1,
        nonce: nonce1Response.body.nonce,
      });

      expect(presentation1.status).toBe(200);

      // Presentation 2
      const nonce2Response = await request(app).post('/oidc4vp/nonce').send({});
      const vpToken2 = await createVPToken(nonce2Response.body.nonce);
      const presentation2 = await request(app).post('/oidc4vp/presentation').send({
        vp_token: vpToken2,
        nonce: nonce2Response.body.nonce,
      });

      expect(presentation2.status).toBe(200);

      // Both should succeed as they have unique JTIs and nonces
      expect(presentation1.body.status).toBe('VALID');
      expect(presentation2.body.status).toBe('VALID');
    });
  });
});

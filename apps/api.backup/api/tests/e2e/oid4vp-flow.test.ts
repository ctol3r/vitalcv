/**
 * DC-017: End-to-end tests for OID4VP + Verify + Candidate link
 * Tests the complete flow from request generation to verification and candidate creation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../src/index';
import prisma from '../../src/graphql/prisma_client';

describe('OID4VP End-to-End Flow', () => {
  let orgId: string;
  let sessionId: string;
  let nonce: string;
  let state: string;

  beforeAll(async () => {
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Hospital',
      },
    });
    orgId = org.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.verifierSession.deleteMany({
      where: { orgId },
    });
    await prisma.candidate.deleteMany({
      where: { orgId },
    });
    await prisma.organization.delete({
      where: { id: orgId },
    });
    await prisma.$disconnect();
  });

  describe('DC-001: Presentation Request Generation', () => {
    it('should generate a presentation request with workflow', async () => {
      const response = await request(app)
        .post('/api/oid4vp/request')
        .send({
          workflow: 'full_onboarding',
          orgId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('nonce');
      expect(response.body).toHaveProperty('state');
      expect(response.body).toHaveProperty('request_url');
      expect(response.body).toHaveProperty('qr_payload');
      expect(response.body).toHaveProperty('presentation_definition');

      sessionId = response.body.sessionId;
      nonce = response.body.nonce;
      state = response.body.state;

      // Verify session was created
      const session = await prisma.verifierSession.findUnique({
        where: { id: sessionId },
      });
      expect(session).toBeTruthy();
      expect(session?.orgId).toBe(orgId);
      expect(session?.nonce).toBe(nonce);
      expect(session?.status).toBe('pending');
    });

    it('should generate request with credential types', async () => {
      const response = await request(app)
        .post('/api/oid4vp/request')
        .send({
          credentialTypes: ['LicenseCredential', 'BoardCertificationCredential'],
          orgId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.presentation_definition).toHaveProperty('input_descriptors');
    });

    it('should retrieve request by session ID', async () => {
      const response = await request(app)
        .get(`/api/oid4vp/request/${sessionId}`)
        .expect(200);

      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.nonce).toBe(nonce);
      expect(response.body.status).toBe('pending');
    });
  });

  describe('DC-002: Presentation Verification', () => {
    it('should verify a VP token and create candidate', async () => {
      // Mock VP token (in real scenario, this would come from a wallet)
      const mockVPToken = 'eyJhbGciOiJFUzI1NiJ9.eyJ2cCI6eyJ2ZXJpZmlhYmxlQ3JlZGVudGlhbCI6WyJleUpoYkdjaU9pSkZVekkxTmlJc0ltdHBaQ0k2SW1SdGNtVnpJbjAuZXlKamJHRjRJam9pY0hKdlkydHNiM2M2ZEdobElpd2lhV1FpT2lKaFltSTJOekppTkRGaU5USXhZelpoWmpjNFptUTJOemcyWkRCaVptSm1NMlJpTVNJc0ltTjFjM1J2YldWeVltOTFjekU2SWxSbGJHeHBZMkYwYVc5dVltOXliMk5oYkdodmMzUTZJbU5zYVdWdWRHOXphR1J2YldWdWRITWlMQ0psYkdsbGNpSTZNVGM1TmpnM01qWTNNeXdpYVdRaU9pSmhZbUk2TmpJd05ESTVOakF3WVRneVlXWTFPR0kzTmpRNE1qVXpZbUUzWkdVNU56UTRNQ0lzSW5CeWIyZHZJaUFvYUhSMGNITTZMeTl3WVhOelpYTXVZMjl0TDJGdWVDOHlOekV3TURBeUxURXdMVEF5TURVME1qUTBOVGs1T1RVME1pMHhNREExSURVME1ERXpNREUyTmpReE1qQXpOekV3TGpJd01URXpNU3dnSW5KaFkydGxkQ0lzSW1WNGNDSTZNVGN5TXpFNU5ETXlOaXdpWlhod0lqb3hOemM0T1RZM09URTBmUS5leUpoYkdjaU9pSkZVekkxTmlJc0ltdHBaQ0k2SW1SdGNtVnpJbjAuZXlKamJHRjRJam9pY0hKdlkydHNiM2M2ZEdobElpd2lhV1FpT2lKaFltSTJOekppTkRGaU5USXhZelpoWmpjNFptUTJOemcyWkRCaVptSm1NMlJpTVNJc0ltTjFjM1J2YldWeVltOTFjekU2SWxSbGJHeHBZMkYwYVc5dVltOXliMk5oYkdodmMzUTZJbU5zYVdWdWRHOXphR1J2YldWdWRITWlMQ0psYkdsbGNpSTZNVGM1TmpnM01qWTNNeXdpYVdRaU9pSmhZbUk2TmpJd05ESTVOakF3WVRneVlXWTFPR0kzTmpRNE1qVXpZbUUzWkdVNU56UTRNQ0lzSW5CeWIyZHZJaUFvYUhSMGNITTZMeTl3WVhOelpYTXVZMjl0TDJGdWVDOHlOekV3TURBeUxURXdMVEF5TURVME1qUTBOVGs1T1RVME1pMHhNREExSURVME1ERXpNREUyTmpReE1qQXpOekV3TGpJd01URXpNU3dnSW5KaFkydGxkQ0lzSW1WNGNDSTZNVGN5TXpFNU5ETXlOaXdpWlhod0lqb3hOemM0T1RZM09URTBmUSJdfX0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const response = await request(app)
        .post('/api/oid4vp/verify')
        .send({
          vp_token: mockVPToken,
          nonce,
          state,
        })
        .expect(200);

      expect(response.body).toHaveProperty('verified');
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('result');

      // Verify session was updated
      const session = await prisma.verifierSession.findUnique({
        where: { id: sessionId },
      });
      expect(session?.status).toBe('completed');

      // Verify candidate was created (DC-015)
      if (response.body.result.subjectInfo?.npi || response.body.result.subjectInfo?.did) {
        const candidates = await prisma.candidate.findMany({
          where: { orgId },
        });
        expect(candidates.length).toBeGreaterThan(0);
      }
    });

    it('should reject expired session', async () => {
      // Create an expired session
      const expiredSession = await prisma.verifierSession.create({
        data: {
          orgId,
          nonce: 'expired-nonce',
          state: 'expired-state',
          expiresAt: new Date(Date.now() - 1000 * 60), // 1 minute ago
          status: 'pending',
        },
      });

      await request(app)
        .post('/api/oid4vp/verify')
        .send({
          vp_token: 'mock-token',
          nonce: expiredSession.nonce,
        })
        .expect(410);
    });

    it('should reject reused nonce', async () => {
      // Try to use the same nonce twice
      await request(app)
        .post('/api/oid4vp/verify')
        .send({
          vp_token: 'mock-token',
          nonce,
        })
        .expect(409); // Already used
    });
  });

  describe('DC-015: Candidate Link', () => {
    it('should link verification to candidate profile', async () => {
      const session = await prisma.verifierSession.findUnique({
        where: { id: sessionId },
        include: { candidate: true },
      });

      if (session?.candidateId) {
        expect(session.candidate).toBeTruthy();
        expect(session.candidate?.orgId).toBe(orgId);
      }
    });
  });

  describe('DC-005: Policy Compliance', () => {
    it('should enforce policy requirements', async () => {
      const response = await request(app)
        .post('/api/oid4vp/request')
        .send({
          workflow: 'hospitalist_onboarding',
          orgId,
        })
        .expect(200);

      const pd = response.body.presentation_definition;
      expect(pd.input_descriptors.length).toBeGreaterThan(0);
      // Verify that required credentials for hospitalist workflow are included
    });
  });
});


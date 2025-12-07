/**
 * WebAuthn and AAL Policy Tests
 *
 * Tests for phishing-resistant MFA (AAL2/AAL3) with WebAuthn passkeys
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  getUserAalPolicy,
  checkUserAalCompliance,
} from '../aal-policy';
import {
  generateRecoveryKey,
  verifyRecoveryKey,
  revokeRecoveryKey,
} from '../recovery-keys';
import { challengeStore } from '../challenge-store';

const prisma = new PrismaClient();

describe('WebAuthn AAL2/AAL3 Authentication', () => {
  let testUser: any;
  let adminUser: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.recoveryKey.deleteMany({});
    await prisma.webAuthnAuthenticator.deleteMany({});
    await prisma.userAalAssignment.deleteMany({});
    await prisma.aalPolicy.deleteMany({});
    await prisma.user.deleteMany({});
    challengeStore.clear();

    // Create test users
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        roles: ['verifier'],
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        roles: ['admin'],
      },
    });
  });

  afterEach(async () => {
    await prisma.recoveryKey.deleteMany({});
    await prisma.webAuthnAuthenticator.deleteMany({});
    await prisma.userAalAssignment.deleteMany({});
    await prisma.aalPolicy.deleteMany({});
    await prisma.user.deleteMany({});
    challengeStore.clear();
  });

  describe('AAL2 Policy Enforcement', () => {
    it('should require phishing-resistant authenticator for AAL2', async () => {
      const policy = await getUserAalPolicy(testUser.id, testUser.roles);
      expect(policy).not.toBeNull();
      expect(policy?.aalLevel).toBe(2);
      expect(policy?.requiresPhishingResistant).toBe(true);

      const status = await checkUserAalCompliance(testUser.id, testUser.roles);
      expect(status.meetsRequirement).toBe(false);
      expect(status.currentAal).toBe(1);
      expect(status.requiredAal).toBe(2);
    });

    it('should meet AAL2 requirement with phishing-resistant authenticator', async () => {
      // Create a phishing-resistant (but not device-bound) authenticator
      await prisma.webAuthnAuthenticator.create({
        data: {
          userId: testUser.id,
          credentialId: 'test-credential-id',
          publicKey: 'test-public-key',
          name: 'Test Authenticator',
          deviceBound: false, // Not device-bound, but phishing-resistant
          counter: 0,
        },
      });

      const status = await checkUserAalCompliance(testUser.id, testUser.roles);
      expect(status.meetsRequirement).toBe(true);
      expect(status.currentAal).toBe(2);
      expect(status.requiredAal).toBe(2);
      expect(status.error).toBeUndefined();
    });
  });

  describe('AAL3 Policy Enforcement', () => {
    it('should require device-bound authenticator for AAL3', async () => {
      const policy = await getUserAalPolicy(adminUser.id, adminUser.roles);
      expect(policy).not.toBeNull();
      expect(policy?.aalLevel).toBe(3);
      expect(policy?.requiresPhishingResistant).toBe(true);
      expect(policy?.config?.requireDeviceBound).toBe(true);

      const status = await checkUserAalCompliance(adminUser.id, adminUser.roles);
      expect(status.meetsRequirement).toBe(false);
      expect(status.currentAal).toBe(1);
      expect(status.requiredAal).toBe(3);
      expect(status.error).toBe('AAL3 requires device-bound authenticator');
    });

    it('should not meet AAL3 with non-device-bound authenticator', async () => {
      // Create a phishing-resistant but not device-bound authenticator
      await prisma.webAuthnAuthenticator.create({
        data: {
          userId: adminUser.id,
          credentialId: 'test-credential-id',
          publicKey: 'test-public-key',
          name: 'Test Authenticator',
          deviceBound: false,
          counter: 0,
        },
      });

      const status = await checkUserAalCompliance(adminUser.id, adminUser.roles);
      expect(status.meetsRequirement).toBe(false);
      expect(status.currentAal).toBe(2); // Phishing-resistant = AAL2
      expect(status.requiredAal).toBe(3);
      expect(status.error).toBe('AAL3 requires device-bound authenticator');
    });

    it('should meet AAL3 requirement with device-bound authenticator', async () => {
      // Create a device-bound authenticator
      await prisma.webAuthnAuthenticator.create({
        data: {
          userId: adminUser.id,
          credentialId: 'test-credential-id',
          publicKey: 'test-public-key',
          name: 'Test Authenticator',
          deviceBound: true, // Device-bound = AAL3
          counter: 0,
        },
      });

      const status = await checkUserAalCompliance(adminUser.id, adminUser.roles);
      expect(status.meetsRequirement).toBe(true);
      expect(status.currentAal).toBe(3);
      expect(status.requiredAal).toBe(3);
      expect(status.error).toBeUndefined();
    });
  });

  describe('Challenge Storage', () => {
    it('should store and retrieve registration challenges', () => {
      const challengeId = 'test-challenge-id';
      const challenge = 'test-challenge-value';

      challengeStore.store(challengeId, challenge, testUser.id, 'registration', 300);

      // Challenge should exist
      const exists = challengeStore.exists(challengeId);
      expect(exists).toBe(true);
    });

    it('should expire challenges after TTL', async () => {
      const challengeId = 'test-challenge-id';
      const challenge = 'test-challenge-value';

      // Store with 0 TTL (immediate expiration)
      challengeStore.store(challengeId, challenge, testUser.id, 'registration', 0);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const exists = challengeStore.exists(challengeId);
      expect(exists).toBe(false);
    });

    it('should consume challenges after retrieval', () => {
      const challengeId = 'test-challenge-id';
      const challenge = 'test-challenge-value';

      challengeStore.store(challengeId, challenge, testUser.id, 'registration', 300);

      const data = challengeStore.retrieve(challengeId);
      expect(data).not.toBeNull();
      expect(data?.challenge).toBe(challenge);

      // Challenge should be consumed (removed)
      const exists = challengeStore.exists(challengeId);
      expect(exists).toBe(false);
    });
  });

  describe('Recovery Keys', () => {
    it('should generate recovery keys', async () => {
      const { key, keyHash, id } = await generateRecoveryKey(
        testUser.id,
        'Test Recovery Key'
      );

      expect(key).toBeDefined();
      expect(keyHash).toBeDefined();
      expect(id).toBeDefined();
      expect(key.length).toBeGreaterThan(0);
    });

    it('should verify valid recovery keys', async () => {
      const { key, id } = await generateRecoveryKey(testUser.id);

      const result = await verifyRecoveryKey(testUser.id, key);
      expect(result.success).toBe(true);
      expect(result.recoveryKeyId).toBe(id);
    });

    it('should reject invalid recovery keys', async () => {
      await generateRecoveryKey(testUser.id);

      const result = await verifyRecoveryKey(testUser.id, 'invalid-key');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid recovery key');
    });

    it('should revoke recovery keys', async () => {
      const { id } = await generateRecoveryKey(testUser.id);

      const result = await revokeRecoveryKey(testUser.id, id);
      expect(result.success).toBe(true);

      // Verify revoked key cannot be used
      const keys = await prisma.recoveryKey.findUnique({
        where: { id },
      });
      expect(keys?.revokedAt).not.toBeNull();
    });
  });

  describe('Authenticator Management', () => {
    it('should list user authenticators', async () => {
      await prisma.webAuthnAuthenticator.createMany({
        data: [
          {
            userId: testUser.id,
            credentialId: 'cred-1',
            publicKey: 'key-1',
            name: 'Authenticator 1',
            deviceBound: false,
            counter: 0,
          },
          {
            userId: testUser.id,
            credentialId: 'cred-2',
            publicKey: 'key-2',
            name: 'Authenticator 2',
            deviceBound: true,
            counter: 0,
          },
        ],
      });

      const authenticators = await prisma.webAuthnAuthenticator.findMany({
        where: {
          userId: testUser.id,
          revokedAt: null,
        },
      });

      expect(authenticators.length).toBe(2);
    });

    it('should revoke authenticators', async () => {
      const authenticator = await prisma.webAuthnAuthenticator.create({
        data: {
          userId: testUser.id,
          credentialId: 'cred-1',
          publicKey: 'key-1',
          name: 'Test Authenticator',
          deviceBound: false,
          counter: 0,
        },
      });

      await prisma.webAuthnAuthenticator.update({
        where: { id: authenticator.id },
        data: { revokedAt: new Date() },
      });

      const status = await checkUserAalCompliance(testUser.id, testUser.roles);
      expect(status.authenticators.length).toBe(0);
    });
  });
});


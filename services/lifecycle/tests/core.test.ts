/**
 * B238A-LIFE-010: LifecycleCoreTests
 *
 * Tests covering expiration checks, renewal flows, auto-renewal rules, revocations.
 * Includes success and failure cases. Ensures policies apply correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { RenewalService } from '../renewalService.js';
import { RevocationService } from '../revocationService.js';
import { ExpirationScheduler } from '../schedulers/expirationScheduler.js';
import { RenewalNotificationService } from '../notifications/renewalNotificationService.js';
import { RenewalRequestStatus } from '../models/RenewalRequest.js';
import { RevocationStatus } from '../models/Revocation.js';

// Mock Prisma client for testing
class MockPrismaClient {
  credential: any;
  credentialExpiryPolicy: any;
  renewalRequest: any;
  revocation: any;
  autoRenewalRules: any;
  notification: any;

  constructor() {
    this.credential = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    this.credentialExpiryPolicy = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    };
    this.renewalRequest = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    this.revocation = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    this.autoRenewalRules = {
      findFirst: jest.fn(),
    };
    this.notification = {
      create: jest.fn(),
    };
  }
}

describe('Credential Lifecycle Core Tests', () => {
  let prisma: any;
  let renewalService: RenewalService;
  let revocationService: RevocationService;
  let expirationScheduler: ExpirationScheduler;
  let notificationService: RenewalNotificationService;

  beforeEach(() => {
    prisma = new MockPrismaClient() as any;
    renewalService = new RenewalService(prisma);
    revocationService = new RevocationService(prisma);
    expirationScheduler = new ExpirationScheduler(prisma);
    notificationService = new RenewalNotificationService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ExpirationScheduler', () => {
    describe('checkCredentialExpiration', () => {
      it('should detect expiring credential correctly', async () => {
        const credentialId = 'cred-123';
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 15); // 15 days from now

        prisma.credential.findUnique.mockResolvedValue({
          id: credentialId,
          type: 'license',
          expiresAt,
          status: 'active',
        });

        prisma.credentialExpiryPolicy.findUnique.mockResolvedValue({
          id: 'policy-1',
          credentialType: 'license',
          defaultValidityPeriod: 365,
          gracePeriod: 30,
          renewalRequirements: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await expirationScheduler.checkCredentialExpiration(credentialId);

        expect(result).not.toBeNull();
        expect(result?.credentialId).toBe(credentialId);
        expect(result?.daysUntilExpiry).toBeCloseTo(15, 0);
        expect(result?.isExpired).toBe(false);
        expect(result?.shouldNotify).toBe(true);
      });

      it('should detect expired credential in grace period', async () => {
        const credentialId = 'cred-123';
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() - 10); // 10 days ago

        prisma.credential.findUnique.mockResolvedValue({
          id: credentialId,
          type: 'license',
          expiresAt,
          status: 'active',
        });

        prisma.credentialExpiryPolicy.findUnique.mockResolvedValue({
          id: 'policy-1',
          credentialType: 'license',
          defaultValidityPeriod: 365,
          gracePeriod: 30,
          renewalRequirements: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await expirationScheduler.checkCredentialExpiration(credentialId);

        expect(result).not.toBeNull();
        expect(result?.isExpired).toBe(true);
        expect(result?.isInGracePeriod).toBe(true);
        expect(result?.shouldNotify).toBe(true);
      });

      it('should return null for non-existent credential', async () => {
        prisma.credential.findUnique.mockResolvedValue(null);

        const result = await expirationScheduler.checkCredentialExpiration('non-existent');

        expect(result).toBeNull();
      });

      it('should handle credentials without expiry dates', async () => {
        prisma.credential.findUnique.mockResolvedValue({
          id: 'cred-123',
          type: 'license',
          expiresAt: null,
          status: 'active',
        });

        const result = await expirationScheduler.checkCredentialExpiration('cred-123');

        expect(result).toBeNull();
      });
    });

    describe('checkExpirations', () => {
      it('should check all active credentials', async () => {
        const now = new Date();
        const expiresSoon = new Date(now);
        expiresSoon.setDate(expiresSoon.getDate() + 20);

        prisma.credential.findMany.mockResolvedValue([
          {
            id: 'cred-1',
            type: 'license',
            expiresAt: expiresSoon,
          },
          {
            id: 'cred-2',
            type: 'board',
            expiresAt: expiresSoon,
          },
        ]);

        prisma.credentialExpiryPolicy.findMany.mockResolvedValue([
          {
            id: 'policy-1',
            credentialType: 'license',
            defaultValidityPeriod: 365,
            gracePeriod: 30,
            renewalRequirements: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const results = await expirationScheduler.checkExpirations();

        expect(results.length).toBe(2);
        expect(results[0].credentialId).toBe('cred-1');
        expect(results[1].credentialId).toBe('cred-2');
      });
    });
  });

  describe('RenewalService', () => {
    describe('createRenewalRequest', () => {
      it('should create renewal request successfully', async () => {
        const credential = {
          id: 'cred-123',
          type: 'license',
          status: 'active',
          expiresAt: new Date(),
        };

        prisma.credential.findUnique.mockResolvedValue(credential);
        prisma.renewalRequest.findFirst.mockResolvedValue(null);
        prisma.renewalRequest.create.mockResolvedValue({
          id: 'renewal-1',
          credentialId: 'cred-123',
          requesterId: 'user-1',
          status: RenewalRequestStatus.PENDING,
          submittedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await renewalService.createRenewalRequest({
          credentialId: 'cred-123',
          requesterId: 'user-1',
          reason: 'Renewal required',
        });

        expect(result.id).toBe('renewal-1');
        expect(result.status).toBe(RenewalRequestStatus.PENDING);
        expect(prisma.renewalRequest.create).toHaveBeenCalled();
      });

      it('should fail if credential does not exist', async () => {
        prisma.credential.findUnique.mockResolvedValue(null);

        await expect(
          renewalService.createRenewalRequest({
            credentialId: 'non-existent',
            requesterId: 'user-1',
          })
        ).rejects.toThrow('Credential not found');
      });

      it('should fail if credential is not active', async () => {
        prisma.credential.findUnique.mockResolvedValue({
          id: 'cred-123',
          status: 'revoked',
        });

        await expect(
          renewalService.createRenewalRequest({
            credentialId: 'cred-123',
            requesterId: 'user-1',
          })
        ).rejects.toThrow('Credential is not active');
      });

      it('should fail if pending renewal already exists', async () => {
        prisma.credential.findUnique.mockResolvedValue({
          id: 'cred-123',
          status: 'active',
        });
        prisma.renewalRequest.findFirst.mockResolvedValue({
          id: 'existing-renewal',
          status: RenewalRequestStatus.PENDING,
        });

        await expect(
          renewalService.createRenewalRequest({
            credentialId: 'cred-123',
            requesterId: 'user-1',
          })
        ).rejects.toThrow('Pending renewal request already exists');
      });
    });

    describe('validateRenewalRequest', () => {
      it('should validate renewal request successfully', async () => {
        const renewalRequest = {
          id: 'renewal-1',
          credentialId: 'cred-123',
          credential: {
            id: 'cred-123',
            type: 'license',
            expiresAt: new Date(),
            status: 'active',
          },
          renewalData: {
            documents: ['doc1', 'doc2'],
            paymentConfirmed: true,
          },
        };

        prisma.renewalRequest.findUnique.mockResolvedValue(renewalRequest);
        prisma.credentialExpiryPolicy.findUnique.mockResolvedValue({
          id: 'policy-1',
          credentialType: 'license',
          defaultValidityPeriod: 365,
          gracePeriod: 30,
          renewalRequirements: {
            requiresDocumentation: true,
            requiresPayment: true,
            requiredDocuments: ['doc1', 'doc2'],
          },
        });

        const result = await renewalService.validateRenewalRequest('renewal-1');

        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('should fail validation if required documents are missing', async () => {
        const renewalRequest = {
          id: 'renewal-1',
          credentialId: 'cred-123',
          credential: {
            id: 'cred-123',
            type: 'license',
            expiresAt: new Date(),
            status: 'active',
          },
          renewalData: {
            documents: ['doc1'],
          },
        };

        prisma.renewalRequest.findUnique.mockResolvedValue(renewalRequest);
        prisma.credentialExpiryPolicy.findUnique.mockResolvedValue({
          id: 'policy-1',
          credentialType: 'license',
          defaultValidityPeriod: 365,
          gracePeriod: 30,
          renewalRequirements: {
            requiredDocuments: ['doc1', 'doc2', 'doc3'],
          },
        });

        const result = await renewalService.validateRenewalRequest('renewal-1');

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('Missing required documents');
      });
    });

    describe('approveRenewalRequest', () => {
      it('should approve renewal and update credential expiry', async () => {
        const renewalRequest = {
          id: 'renewal-1',
          credentialId: 'cred-123',
          credential: {
            id: 'cred-123',
            type: 'license',
            expiresAt: new Date(),
            status: 'active',
          },
          status: RenewalRequestStatus.PENDING,
        };

        prisma.renewalRequest.findUnique.mockResolvedValue(renewalRequest);
        prisma.credentialExpiryPolicy.findUnique.mockResolvedValue({
          id: 'policy-1',
          credentialType: 'license',
          defaultValidityPeriod: 365,
          gracePeriod: 30,
          renewalRequirements: null,
        });

        // Mock validation (no errors)
        jest.spyOn(renewalService, 'validateRenewalRequest').mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
        });

        prisma.renewalRequest.update.mockResolvedValue({
          ...renewalRequest,
          status: RenewalRequestStatus.APPROVED,
          decisionAt: new Date(),
        });

        prisma.credential.update.mockResolvedValue({
          id: 'cred-123',
          expiresAt: new Date(),
        });

        const result = await renewalService.approveRenewalRequest('renewal-1', 'approver-1');

        expect(result.credentialId).toBe('cred-123');
        expect(result.newExpiryDate).toBeInstanceOf(Date);
        expect(prisma.credential.update).toHaveBeenCalled();
      });
    });
  });

  describe('RevocationService', () => {
    describe('createRevocation', () => {
      it('should create revocation successfully', async () => {
        const credential = {
          id: 'cred-123',
          status: 'active',
        };

        prisma.credential.findUnique.mockResolvedValue(credential);
        prisma.revocation.findFirst.mockResolvedValue(null);
        prisma.revocation.create.mockResolvedValue({
          id: 'revocation-1',
          credentialId: 'cred-123',
          initiatorId: 'user-1',
          reason: 'Violation of terms',
          status: RevocationStatus.PENDING,
          effectiveAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const effectiveAt = new Date();
        effectiveAt.setDate(effectiveAt.getDate() + 7);

        const result = await revocationService.createRevocation({
          credentialId: 'cred-123',
          initiatorId: 'user-1',
          reason: 'Violation of terms',
          effectiveAt,
        });

        expect(result.id).toBe('revocation-1');
        expect(result.status).toBe(RevocationStatus.PENDING);
      });

      it('should fail if credential does not exist', async () => {
        prisma.credential.findUnique.mockResolvedValue(null);

        await expect(
          revocationService.createRevocation({
            credentialId: 'non-existent',
            initiatorId: 'user-1',
            reason: 'Test',
            effectiveAt: new Date(),
          })
        ).rejects.toThrow('Credential not found');
      });

      it('should fail if credential is already revoked', async () => {
        prisma.credential.findUnique.mockResolvedValue({
          id: 'cred-123',
          status: 'revoked',
        });

        await expect(
          revocationService.createRevocation({
            credentialId: 'cred-123',
            initiatorId: 'user-1',
            reason: 'Test',
            effectiveAt: new Date(),
          })
        ).rejects.toThrow('Credential is already revoked');
      });

      it('should fail if effective date is in the past', async () => {
        prisma.credential.findUnique.mockResolvedValue({
          id: 'cred-123',
          status: 'active',
        });

        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        await expect(
          revocationService.createRevocation({
            credentialId: 'cred-123',
            initiatorId: 'user-1',
            reason: 'Test',
            effectiveAt: pastDate,
          })
        ).rejects.toThrow('Effective date must be in the future or present');
      });
    });

    describe('executeRevocation', () => {
      it('should execute revocation and update credential status', async () => {
        const revocation = {
          id: 'revocation-1',
          credentialId: 'cred-123',
          credential: {
            id: 'cred-123',
            status: 'active',
          },
          status: RevocationStatus.PENDING,
          effectiveAt: new Date(Date.now() - 1000), // 1 second ago
        };

        prisma.revocation.findUnique.mockResolvedValue(revocation);
        jest.spyOn(revocationService, 'validateRevocation').mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
        });

        prisma.revocation.update.mockResolvedValue({
          ...revocation,
          status: RevocationStatus.REVOKED,
        });

        prisma.credential.update.mockResolvedValue({
          id: 'cred-123',
          status: 'revoked',
        });

        prisma.renewalRequest.updateMany.mockResolvedValue({ count: 0 });

        const result = await revocationService.executeRevocation('revocation-1');

        expect(result.credentialId).toBe('cred-123');
        expect(prisma.credential.update).toHaveBeenCalledWith({
          where: { id: 'cred-123' },
          data: { status: 'revoked' },
        });
      });
    });

    describe('canUseCredential', () => {
      it('should return true for active credential', async () => {
        prisma.credential.findUnique.mockResolvedValue({
          id: 'cred-123',
          status: 'active',
        });

        prisma.revocation.findFirst.mockResolvedValue(null);

        const result = await revocationService.canUseCredential('cred-123');

        expect(result.canUse).toBe(true);
      });

      it('should return false for revoked credential', async () => {
        prisma.credential.findUnique.mockResolvedValue({
          id: 'cred-123',
          status: 'revoked',
        });

        const result = await revocationService.canUseCredential('cred-123');

        expect(result.canUse).toBe(false);
        expect(result.reason).toContain('revoked');
      });
    });
  });

  describe('Auto-Renewal Rules', () => {
    it('should check auto-renewal rules when validating renewal', async () => {
      const renewalRequest = {
        id: 'renewal-1',
        credentialId: 'cred-123',
        credential: {
          id: 'cred-123',
          type: 'license',
          expiresAt: new Date(),
          status: 'active',
        },
      };

      prisma.renewalRequest.findUnique.mockResolvedValue(renewalRequest);
      prisma.credentialExpiryPolicy.findUnique.mockResolvedValue({
        id: 'policy-1',
        credentialType: 'license',
        defaultValidityPeriod: 365,
        gracePeriod: 30,
        renewalRequirements: null,
      });

      prisma.autoRenewalRules.findFirst.mockResolvedValue({
        id: 'rule-1',
        orgId: 'org-1',
        credentialType: 'license',
        autoRenew: true,
        maxRenewals: 5,
      });

      const result = await renewalService.validateRenewalRequest('renewal-1');

      expect(result.autoRenewalRules).toBeDefined();
      expect(result.autoRenewalRules?.autoRenew).toBe(true);
    });
  });

  describe('Policy Application', () => {
    it('should apply grace period correctly', async () => {
      const credentialId = 'cred-123';
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 15); // 15 days ago

      prisma.credential.findUnique.mockResolvedValue({
        id: credentialId,
        type: 'license',
        expiresAt,
        status: 'active',
      });

      prisma.credentialExpiryPolicy.findUnique.mockResolvedValue({
        id: 'policy-1',
        credentialType: 'license',
        defaultValidityPeriod: 365,
        gracePeriod: 30, // 30 day grace period
        renewalRequirements: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await expirationScheduler.checkCredentialExpiration(credentialId);

      expect(result?.isExpired).toBe(true);
      expect(result?.isInGracePeriod).toBe(true);
    });

    it('should detect credentials beyond grace period', async () => {
      const credentialId = 'cred-123';
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 45); // 45 days ago

      prisma.credential.findUnique.mockResolvedValue({
        id: credentialId,
        type: 'license',
        expiresAt,
        status: 'active',
      });

      prisma.credentialExpiryPolicy.findUnique.mockResolvedValue({
        id: 'policy-1',
        credentialType: 'license',
        defaultValidityPeriod: 365,
        gracePeriod: 30,
        renewalRequirements: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await expirationScheduler.checkCredentialExpiration(credentialId);

      expect(result?.isExpired).toBe(true);
      expect(result?.isInGracePeriod).toBe(false);
    });
  });
});


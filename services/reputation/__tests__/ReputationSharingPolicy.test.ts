/**
 * B224B-REP-006: Tests for ReputationSharingPolicy model
 */

import { PrismaClient, RecipientType } from '@prisma/client';
import { ReputationSharingPolicyService } from '../models/ReputationSharingPolicy';

describe('ReputationSharingPolicyService', () => {
  let prisma: PrismaClient;
  let service: ReputationSharingPolicyService;

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new ReputationSharingPolicyService(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('createPolicy', () => {
    it('should create a new sharing policy', async () => {
      const input = {
        clinicianId: 'clinician-123',
        recipientType: RecipientType.BOARD,
        allowedMetrics: ['overallScore', 'qualityScore'],
        consentGiven: true,
      };

      const policy = await service.createPolicy(input);

      expect(policy).toBeDefined();
      expect(policy.clinicianId).toBe(input.clinicianId);
      expect(policy.recipientType).toBe(input.recipientType);
      expect(policy.allowedMetrics).toEqual(input.allowedMetrics);
      expect(policy.consentGiven).toBe(true);
      expect(policy.consentGivenAt).toBeDefined();
    });

    it('should create policy without consent', async () => {
      const input = {
        clinicianId: 'clinician-456',
        recipientType: RecipientType.PAYER,
        consentGiven: false,
      };

      const policy = await service.createPolicy(input);

      expect(policy.consentGiven).toBe(false);
      expect(policy.consentGivenAt).toBeNull();
    });
  });

  describe('updatePolicy', () => {
    it('should update policy consent', async () => {
      const created = await service.createPolicy({
        clinicianId: 'clinician-789',
        recipientType: RecipientType.EMPLOYER,
        consentGiven: false,
      });

      const updated = await service.updatePolicy(created.id, {
        consentGiven: true,
      });

      expect(updated.consentGiven).toBe(true);
      expect(updated.consentGivenAt).toBeDefined();
    });

    it('should update allowed metrics', async () => {
      const created = await service.createPolicy({
        clinicianId: 'clinician-101',
        recipientType: RecipientType.BOARD,
        allowedMetrics: ['overallScore'],
      });

      const updated = await service.updatePolicy(created.id, {
        allowedMetrics: ['overallScore', 'qualityScore', 'safetyScore'],
      });

      expect(updated.allowedMetrics).toEqual(['overallScore', 'qualityScore', 'safetyScore']);
    });
  });

  describe('getActivePolicies', () => {
    it('should return only active policies', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await service.createPolicy({
        clinicianId: 'clinician-active',
        recipientType: RecipientType.BOARD,
        consentGiven: true,
        expiryDate: futureDate,
      });

      await service.createPolicy({
        clinicianId: 'clinician-expired',
        recipientType: RecipientType.BOARD,
        consentGiven: true,
        expiryDate: new Date(Date.now() - 1000), // Expired
      });

      await service.createPolicy({
        clinicianId: 'clinician-no-consent',
        recipientType: RecipientType.BOARD,
        consentGiven: false,
      });

      const activePolicies = await service.getActivePolicies('clinician-active', RecipientType.BOARD);

      expect(activePolicies.length).toBe(1);
      expect(activePolicies[0].clinicianId).toBe('clinician-active');
    });
  });

  describe('revokeConsent', () => {
    it('should revoke consent for a policy', async () => {
      const created = await service.createPolicy({
        clinicianId: 'clinician-revoke',
        recipientType: RecipientType.PAYER,
        consentGiven: true,
      });

      const revoked = await service.revokeConsent(created.id);

      expect(revoked.consentGiven).toBe(false);
      expect(revoked.consentGivenAt).toBeNull();
    });
  });
});


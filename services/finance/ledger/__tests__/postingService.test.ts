/**
 * Tests for LedgerPostingService
 */

import { PrismaClient } from '@prisma/client';
import { LedgerPostingService } from '../postingService';

describe('LedgerPostingService', () => {
  let prisma: PrismaClient;
  let service: LedgerPostingService;

  beforeAll(() => {
    prisma = new PrismaClient();
    service = new LedgerPostingService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.ledgerEntry.deleteMany({});
  });

  describe('postEntry', () => {
    it('should post a single ledger entry', async () => {
      const entry = await service.postEntry({
        orgId: 'org-123',
        amount: 1000,
        currency: 'USD',
        type: 'credit',
        referenceId: 'ref-123',
      });

      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();
      expect(entry.amount).toBe(1000);
      expect(entry.type).toBe('credit');
    });
  });

  describe('postDoubleEntry', () => {
    it('should post a double-entry transaction', async () => {
      const [debit, credit] = await service.postDoubleEntry({
        debit: {
          orgId: 'org-123',
          amount: 1000,
          currency: 'USD',
          type: 'debit',
          referenceId: 'ref-123',
        },
        credit: {
          orgId: 'org-456',
          amount: 1000,
          currency: 'USD',
          type: 'credit',
          referenceId: 'ref-123',
        },
      });

      expect(debit.type).toBe('debit');
      expect(credit.type).toBe('credit');
      expect(debit.amount).toBe(credit.amount);
    });

    it('should throw error if debit and credit amounts do not match', async () => {
      await expect(
        service.postDoubleEntry({
          debit: {
            orgId: 'org-123',
            amount: 1000,
            currency: 'USD',
            type: 'debit',
          },
          credit: {
            orgId: 'org-456',
            amount: 500,
            currency: 'USD',
            type: 'credit',
          },
        })
      ).rejects.toThrow('Double-entry accounting violation');
    });

    it('should throw error if debit type is not debit', async () => {
      await expect(
        service.postDoubleEntry({
          debit: {
            orgId: 'org-123',
            amount: 1000,
            currency: 'USD',
            type: 'credit',
          },
          credit: {
            orgId: 'org-456',
            amount: 1000,
            currency: 'USD',
            type: 'credit',
          },
        })
      ).rejects.toThrow('debit entry must have type "debit"');
    });
  });

  describe('postMarketplacePurchase', () => {
    it('should post marketplace purchase transaction', async () => {
      const [purchaserDebit, vendorCredit, platformFee] = await service.postMarketplacePurchase({
        purchaseId: 'purchase-123',
        purchaserOrgId: 'org-purchaser',
        vendorOrgId: 'org-vendor',
        amount: 1000,
        currency: 'USD',
        platformFee: 100,
      });

      expect(purchaserDebit.type).toBe('debit');
      expect(purchaserDebit.amount).toBe(1000);
      expect(vendorCredit.type).toBe('credit');
      expect(vendorCredit.amount).toBe(900); // 1000 - 100 platform fee
      expect(platformFee).toBeDefined();
      expect(platformFee?.amount).toBe(100);
    });

    it('should handle marketplace purchase without platform fee', async () => {
      const [purchaserDebit, vendorCredit, platformFee] = await service.postMarketplacePurchase({
        purchaseId: 'purchase-123',
        purchaserOrgId: 'org-purchaser',
        vendorOrgId: 'org-vendor',
        amount: 1000,
        currency: 'USD',
      });

      expect(purchaserDebit.amount).toBe(1000);
      expect(vendorCredit.amount).toBe(1000);
      expect(platformFee).toBeUndefined();
    });
  });

  describe('postRevenueShareDistribution', () => {
    it('should post revenue share distribution', async () => {
      const [platformDebit, vendorCredit] = await service.postRevenueShareDistribution({
        distributionId: 'dist-123',
        vendorOrgId: 'org-vendor',
        amount: 500,
        currency: 'USD',
        basisPoints: 5000, // 50%
      });

      expect(platformDebit.orgId).toBeNull(); // Platform
      expect(platformDebit.type).toBe('debit');
      expect(vendorCredit.orgId).toBe('org-vendor');
      expect(vendorCredit.type).toBe('credit');
      expect(platformDebit.amount).toBe(vendorCredit.amount);
    });
  });

  describe('postRefund', () => {
    it('should post refund transaction', async () => {
      const [vendorDebit, purchaserCredit, platformFeeReversal] = await service.postRefund({
        refundId: 'refund-123',
        purchaseId: 'purchase-123',
        purchaserOrgId: 'org-purchaser',
        vendorOrgId: 'org-vendor',
        amount: 1000,
        currency: 'USD',
        platformFee: 100,
      });

      expect(vendorDebit.type).toBe('debit');
      expect(vendorDebit.amount).toBe(900); // 1000 - 100 platform fee
      expect(purchaserCredit.type).toBe('credit');
      expect(purchaserCredit.amount).toBe(1000);
      expect(platformFeeReversal).toBeDefined();
      expect(platformFeeReversal?.amount).toBe(100);
    });
  });

  describe('verifyBalance', () => {
    it('should verify double-entry accounting balance', async () => {
      await service.postDoubleEntry({
        debit: {
          orgId: 'org-123',
          amount: 1000,
          currency: 'USD',
          type: 'debit',
          referenceId: 'ref-123',
        },
        credit: {
          orgId: 'org-456',
          amount: 1000,
          currency: 'USD',
          type: 'credit',
          referenceId: 'ref-123',
        },
      });

      const isBalanced = await service.verifyBalance('ref-123');

      expect(isBalanced).toBe(true);
    });

    it('should return false if entries are not balanced', async () => {
      await service.postEntry({
        orgId: 'org-123',
        amount: 1000,
        currency: 'USD',
        type: 'debit',
        referenceId: 'ref-123',
      });

      await service.postEntry({
        orgId: 'org-456',
        amount: 500,
        currency: 'USD',
        type: 'credit',
        referenceId: 'ref-123',
      });

      const isBalanced = await service.verifyBalance('ref-123');

      expect(isBalanced).toBe(false);
    });
  });
});


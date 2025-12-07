/**
 * Tests for LedgerEntry model
 */

import { PrismaClient } from '@prisma/client';
import { LedgerEntry } from '../LedgerEntry';

describe('LedgerEntry', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.ledgerEntry.deleteMany({});
  });

  describe('create', () => {
    it('should create a ledger entry', async () => {
      const entry = await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 1000,
        currency: 'USD',
        type: 'credit',
        referenceId: 'ref-123',
      });

      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();
      expect(entry.orgId).toBe('org-123');
      expect(entry.amount).toBe(1000);
      expect(entry.currency).toBe('USD');
      expect(entry.type).toBe('credit');
      expect(entry.referenceId).toBe('ref-123');
    });

    it('should create a ledger entry with default currency', async () => {
      const entry = await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 500,
        type: 'debit',
      });

      expect(entry.currency).toBe('USD');
    });
  });

  describe('findById', () => {
    it('should find a ledger entry by ID', async () => {
      const created = await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 1000,
        type: 'credit',
      });

      const found = await LedgerEntry.findById(prisma, created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.amount).toBe(1000);
    });

    it('should return null if entry not found', async () => {
      const found = await LedgerEntry.findById(prisma, 'non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('findByOrgId', () => {
    it('should find ledger entries by organization ID', async () => {
      await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 1000,
        type: 'credit',
      });

      await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 500,
        type: 'debit',
      });

      await LedgerEntry.create(prisma, {
        orgId: 'org-456',
        amount: 2000,
        type: 'credit',
      });

      const entries = await LedgerEntry.findByOrgId(prisma, 'org-123');

      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.orgId === 'org-123')).toBe(true);
    });

    it('should filter by type', async () => {
      await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 1000,
        type: 'credit',
      });

      await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 500,
        type: 'debit',
      });

      const credits = await LedgerEntry.findByOrgId(prisma, 'org-123', {
        type: 'credit',
      });

      expect(credits).toHaveLength(1);
      expect(credits[0].type).toBe('credit');
    });
  });

  describe('getBalance', () => {
    it('should calculate balance correctly', async () => {
      await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 1000,
        currency: 'USD',
        type: 'credit',
      });

      await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 300,
        currency: 'USD',
        type: 'debit',
      });

      await LedgerEntry.create(prisma, {
        orgId: 'org-123',
        amount: 200,
        currency: 'USD',
        type: 'credit',
      });

      const balance = await LedgerEntry.getBalance(prisma, 'org-123', 'USD');

      expect(balance).toBe(900); // 1000 + 200 - 300
    });

    it('should return 0 for organization with no entries', async () => {
      const balance = await LedgerEntry.getBalance(prisma, 'org-none', 'USD');

      expect(balance).toBe(0);
    });
  });
});


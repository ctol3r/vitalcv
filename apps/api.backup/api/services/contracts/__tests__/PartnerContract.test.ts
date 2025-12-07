/**
 * B231A-CON-001: PartnerContract Model Tests
 */

import { PrismaClient } from '@prisma/client';
import {
  createPartnerContract,
  getPartnerContract,
  listPartnerContracts,
  updatePartnerContract,
  updateContractStatus,
  validateStatusTransition,
  validateDateRange,
  findContractsExpiringSoon,
} from '../models/PartnerContract.js';

describe('PartnerContract Model', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.partnerContract.deleteMany({});
    await prisma.contractTemplate.deleteMany({});
  });

  describe('createPartnerContract', () => {
    it('should create a contract with required fields', async () => {
      const input = {
        orgId: 'org1',
        counterpartyId: 'org2',
      };

      const contract = await createPartnerContract(prisma, input);

      expect(contract).toBeDefined();
      expect(contract.id).toBeDefined();
      expect(contract.orgId).toBe(input.orgId);
      expect(contract.counterpartyId).toBe(input.counterpartyId);
      expect(contract.status).toBe('draft');
    });

    it('should create a contract with all fields', async () => {
      const effectiveDate = new Date('2024-01-01');
      const expiryDate = new Date('2025-01-01');

      const input = {
        orgId: 'org1',
        counterpartyId: 'org2',
        templateId: 'template1',
        status: 'draft' as const,
        effectiveDate,
        expiryDate,
        terms: { key: 'value' },
        revenueShareId: 'revenue1',
        metadata: { custom: 'data' },
      };

      const contract = await createPartnerContract(prisma, input);

      expect(contract.templateId).toBe(input.templateId);
      expect(contract.status).toBe(input.status);
      expect(contract.effectiveDate).toEqual(effectiveDate);
      expect(contract.expiryDate).toEqual(expiryDate);
      expect(contract.terms).toEqual(input.terms);
      expect(contract.revenueShareId).toBe(input.revenueShareId);
    });
  });

  describe('validateDateRange', () => {
    it('should accept valid date range', () => {
      const effective = new Date('2024-01-01');
      const expiry = new Date('2025-01-01');
      expect(() => validateDateRange(effective, expiry)).not.toThrow();
    });

    it('should reject expiry before effective date', () => {
      const effective = new Date('2025-01-01');
      const expiry = new Date('2024-01-01');
      expect(() => validateDateRange(effective, expiry)).toThrow(
        'Effective date must be before expiry date'
      );
    });

    it('should accept dates with same day', () => {
      const date = new Date('2024-01-01');
      expect(() => validateDateRange(date, date)).toThrow();
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow valid transitions', () => {
      expect(() => validateStatusTransition('draft', 'negotiating')).not.toThrow();
      expect(() => validateStatusTransition('negotiating', 'signed')).not.toThrow();
      expect(() => validateStatusTransition('signed', 'terminated')).not.toThrow();
    });

    it('should reject invalid transitions', () => {
      expect(() => validateStatusTransition('draft', 'signed')).toThrow();
      expect(() => validateStatusTransition('signed', 'draft')).toThrow();
      expect(() => validateStatusTransition('terminated', 'signed')).toThrow();
    });
  });

  describe('getPartnerContract', () => {
    it('should retrieve a contract by ID', async () => {
      const created = await createPartnerContract(prisma, {
        orgId: 'org1',
        counterpartyId: 'org2',
      });

      const retrieved = await getPartnerContract(prisma, created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent contract', async () => {
      const retrieved = await getPartnerContract(prisma, 'non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('listPartnerContracts', () => {
    it('should list all contracts', async () => {
      await createPartnerContract(prisma, {
        orgId: 'org1',
        counterpartyId: 'org2',
      });
      await createPartnerContract(prisma, {
        orgId: 'org2',
        counterpartyId: 'org3',
      });

      const contracts = await listPartnerContracts(prisma);
      expect(contracts.length).toBe(2);
    });

    it('should filter by orgId', async () => {
      await createPartnerContract(prisma, {
        orgId: 'org1',
        counterpartyId: 'org2',
      });
      await createPartnerContract(prisma, {
        orgId: 'org2',
        counterpartyId: 'org3',
      });

      const filtered = await listPartnerContracts(prisma, { orgId: 'org1' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].orgId).toBe('org1');
    });

    it('should filter by status', async () => {
      const contract1 = await createPartnerContract(prisma, {
        orgId: 'org1',
        counterpartyId: 'org2',
        status: 'draft',
      });
      await updateContractStatus(prisma, contract1.id, 'negotiating');

      await createPartnerContract(prisma, {
        orgId: 'org2',
        counterpartyId: 'org3',
        status: 'draft',
      });

      const negotiating = await listPartnerContracts(prisma, { status: 'negotiating' });
      expect(negotiating.length).toBe(1);
      expect(negotiating[0].status).toBe('negotiating');
    });
  });

  describe('updateContractStatus', () => {
    it('should update contract status', async () => {
      const contract = await createPartnerContract(prisma, {
        orgId: 'org1',
        counterpartyId: 'org2',
        status: 'draft',
      });

      const updated = await updateContractStatus(prisma, contract.id, 'negotiating');

      expect(updated.status).toBe('negotiating');
    });

    it('should reject invalid status transitions', async () => {
      const contract = await createPartnerContract(prisma, {
        orgId: 'org1',
        counterpartyId: 'org2',
        status: 'draft',
      });

      await expect(
        updateContractStatus(prisma, contract.id, 'signed')
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('findContractsExpiringSoon', () => {
    it('should find contracts expiring within specified days', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20); // 20 days from now

      await createPartnerContract(prisma, {
        orgId: 'org1',
        counterpartyId: 'org2',
        status: 'signed',
        expiryDate: futureDate,
      });

      const expiring = await findContractsExpiringSoon(prisma, 30);
      expect(expiring.length).toBe(1);
    });

    it('should not return expired contracts', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10); // 10 days ago

      await createPartnerContract(prisma, {
        orgId: 'org1',
        counterpartyId: 'org2',
        status: 'signed',
        expiryDate: pastDate,
      });

      const expiring = await findContractsExpiringSoon(prisma, 30);
      expect(expiring.length).toBe(0);
    });

    it('should only return signed contracts', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);

      await createPartnerContract(prisma, {
        orgId: 'org1',
        counterpartyId: 'org2',
        status: 'draft',
        expiryDate: futureDate,
      });

      const expiring = await findContractsExpiringSoon(prisma, 30);
      expect(expiring.length).toBe(0);
    });
  });
});


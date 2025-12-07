/**
 * Unit tests for ContractService
 */

import { ContractService } from '../contractService.js';
import { PrismaClient, ContractStatus } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
  ContractStatus: {
    DRAFT: 'DRAFT',
    UNDER_REVIEW: 'UNDER_REVIEW',
    ACTIVE: 'ACTIVE',
    TERMINATED: 'TERMINATED',
    EXPIRED: 'EXPIRED',
  },
}));

describe('ContractService', () => {
  let contractService: ContractService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      contract: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      contractVersion: {
        create: jest.fn(),
        update: jest.fn(),
      },
      contractAuditLog: {
        create: jest.fn(),
      },
    };

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
    contractService = new ContractService();
  });

  describe('createContract', () => {
    it('should create a contract from template', async () => {
      const input = {
        templateId: 'template-1',
        title: 'Test Contract',
        slug: 'test-contract',
        type: 'SERVICE' as const,
        authorId: 'user-1',
        variables: { orgName: 'Test Org' },
      };

      // Mock template service
      (contractService as any).templateService = {
        getTemplate: jest.fn().mockResolvedValue({ id: 'template-1', content: 'Template {{orgName}}' }),
        generateContent: jest.fn().mockResolvedValue('Template Test Org'),
      };

      mockPrisma.contract.create.mockResolvedValue({
        id: 'contract-1',
        ...input,
        status: ContractStatus.DRAFT,
      });

      mockPrisma.contractVersion.create.mockResolvedValue({
        id: 'version-1',
        contractId: 'contract-1',
        versionNumber: 1,
      });

      mockPrisma.contract.update.mockResolvedValue({
        id: 'contract-1',
        currentVersionId: 'version-1',
      });

      const result = await contractService.createContract(input);

      expect(result).toBeDefined();
      expect(mockPrisma.contract.create).toHaveBeenCalled();
      expect(mockPrisma.contractVersion.create).toHaveBeenCalled();
    });

    it('should throw error if template not found', async () => {
      const input = {
        templateId: 'invalid-template',
        title: 'Test Contract',
        slug: 'test-contract',
        type: 'SERVICE' as const,
        authorId: 'user-1',
      };

      (contractService as any).templateService = {
        getTemplate: jest.fn().mockResolvedValue(null),
      };

      await expect(contractService.createContract(input)).rejects.toThrow('Template invalid-template not found');
    });
  });

  describe('publishContract', () => {
    it('should publish contract and set status to UNDER_REVIEW', async () => {
      const contractId = 'contract-1';
      const userId = 'user-1';

      mockPrisma.contract.findUnique.mockResolvedValue({
        id: contractId,
        status: ContractStatus.DRAFT,
      });

      mockPrisma.contract.update.mockResolvedValue({
        id: contractId,
        status: ContractStatus.UNDER_REVIEW,
      });

      // Mock workflow engine
      (contractService as any).workflowEngine = {
        transitionStatus: jest.fn().mockResolvedValue(undefined),
        triggerNotifications: jest.fn().mockResolvedValue(undefined),
      };

      const result = await contractService.publishContract(contractId, userId);

      expect(result.status).toBe(ContractStatus.UNDER_REVIEW);
      expect(mockPrisma.contractAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('activateContract', () => {
    it('should activate contract and set status to ACTIVE', async () => {
      const contractId = 'contract-1';
      const userId = 'user-1';

      mockPrisma.contract.findUnique.mockResolvedValue({
        id: contractId,
        status: ContractStatus.UNDER_REVIEW,
      });

      mockPrisma.contract.update.mockResolvedValue({
        id: contractId,
        status: ContractStatus.ACTIVE,
      });

      // Mock workflow engine
      (contractService as any).workflowEngine = {
        transitionStatus: jest.fn().mockResolvedValue(undefined),
        triggerNotifications: jest.fn().mockResolvedValue(undefined),
      };

      const result = await contractService.activateContract(contractId, userId);

      expect(result.status).toBe(ContractStatus.ACTIVE);
      expect(mockPrisma.contractAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('terminateContract', () => {
    it('should terminate contract', async () => {
      const contractId = 'contract-1';
      const userId = 'user-1';
      const reason = 'Contract violation';

      mockPrisma.contract.findUnique.mockResolvedValue({
        id: contractId,
        status: ContractStatus.ACTIVE,
      });

      mockPrisma.contract.update.mockResolvedValue({
        id: contractId,
        status: ContractStatus.TERMINATED,
      });

      // Mock workflow engine
      (contractService as any).workflowEngine = {
        transitionStatus: jest.fn().mockResolvedValue(undefined),
        triggerNotifications: jest.fn().mockResolvedValue(undefined),
      };

      const result = await contractService.terminateContract(contractId, userId, reason);

      expect(result.status).toBe(ContractStatus.TERMINATED);
      expect(mockPrisma.contractAuditLog.create).toHaveBeenCalled();
    });
  });
});


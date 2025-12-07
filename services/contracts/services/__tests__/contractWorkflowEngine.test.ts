/**
 * Unit tests for ContractWorkflowEngine
 */

import { ContractWorkflowEngine } from '../contractWorkflowEngine.js';
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

describe('ContractWorkflowEngine', () => {
  let workflowEngine: ContractWorkflowEngine;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      contract: {
        findUnique: jest.fn(),
      },
      contractChangeRequest: {
        count: jest.fn(),
      },
    };

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
    workflowEngine = new ContractWorkflowEngine();
  });

  describe('transitionStatus', () => {
    it('should allow valid transition from DRAFT to UNDER_REVIEW', async () => {
      const contractId = 'contract-1';

      mockPrisma.contract.findUnique.mockResolvedValue({
        id: contractId,
        status: ContractStatus.DRAFT,
        currentVersion: { id: 'version-1' },
        parties: [],
      });

      await expect(
        workflowEngine.transitionStatus(
          ContractStatus.DRAFT,
          ContractStatus.UNDER_REVIEW,
          contractId
        )
      ).resolves.not.toThrow();
    });

    it('should allow valid transition from UNDER_REVIEW to ACTIVE', async () => {
      const contractId = 'contract-1';

      mockPrisma.contract.findUnique.mockResolvedValue({
        id: contractId,
        status: ContractStatus.UNDER_REVIEW,
        currentVersion: { id: 'version-1' },
        parties: [
          { id: 'party-1', role: 'SIGNER', signatureStatus: 'SIGNED' },
        ],
      });

      await expect(
        workflowEngine.transitionStatus(
          ContractStatus.UNDER_REVIEW,
          ContractStatus.ACTIVE,
          contractId
        )
      ).resolves.not.toThrow();
    });

    it('should reject invalid transition from DRAFT to ACTIVE', async () => {
      const contractId = 'contract-1';

      await expect(
        workflowEngine.transitionStatus(
          ContractStatus.DRAFT,
          ContractStatus.ACTIVE,
          contractId
        )
      ).rejects.toThrow('Invalid status transition');
    });

    it('should reject transition from TERMINATED', async () => {
      const contractId = 'contract-1';

      await expect(
        workflowEngine.transitionStatus(
          ContractStatus.TERMINATED,
          ContractStatus.ACTIVE,
          contractId
        )
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('enforceBusinessRules', () => {
    it('should reject publishing without a version', async () => {
      const contractId = 'contract-1';

      mockPrisma.contract.findUnique.mockResolvedValue({
        id: contractId,
        status: ContractStatus.DRAFT,
        currentVersion: null,
        parties: [],
      });

      await expect(
        workflowEngine.transitionStatus(
          ContractStatus.DRAFT,
          ContractStatus.UNDER_REVIEW,
          contractId
        )
      ).rejects.toThrow('Cannot publish contract without a version');
    });

    it('should reject activating without parties', async () => {
      const contractId = 'contract-1';

      mockPrisma.contract.findUnique.mockResolvedValue({
        id: contractId,
        status: ContractStatus.UNDER_REVIEW,
        currentVersion: { id: 'version-1' },
        parties: [],
      });

      await expect(
        workflowEngine.transitionStatus(
          ContractStatus.UNDER_REVIEW,
          ContractStatus.ACTIVE,
          contractId
        )
      ).rejects.toThrow('Cannot activate contract without parties');
    });

    it('should reject activating if not all signers have signed', async () => {
      const contractId = 'contract-1';

      mockPrisma.contract.findUnique.mockResolvedValue({
        id: contractId,
        status: ContractStatus.UNDER_REVIEW,
        currentVersion: { id: 'version-1' },
        parties: [
          { id: 'party-1', role: 'SIGNER', signatureStatus: 'SIGNED' },
          { id: 'party-2', role: 'SIGNER', signatureStatus: 'PENDING' },
        ],
      });

      await expect(
        workflowEngine.transitionStatus(
          ContractStatus.UNDER_REVIEW,
          ContractStatus.ACTIVE,
          contractId
        )
      ).rejects.toThrow('Cannot activate contract');
    });
  });

  describe('isValidTransition', () => {
    it('should return true for valid transitions', () => {
      expect(
        workflowEngine.isValidTransition(
          ContractStatus.DRAFT,
          ContractStatus.UNDER_REVIEW
        )
      ).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(
        workflowEngine.isValidTransition(
          ContractStatus.DRAFT,
          ContractStatus.ACTIVE
        )
      ).toBe(false);
    });
  });

  describe('getValidNextStatuses', () => {
    it('should return valid next statuses for DRAFT', () => {
      const nextStatuses = workflowEngine.getValidNextStatuses(ContractStatus.DRAFT);
      expect(nextStatuses).toContain(ContractStatus.UNDER_REVIEW);
      expect(nextStatuses).toContain(ContractStatus.TERMINATED);
    });

    it('should return empty array for TERMINATED', () => {
      const nextStatuses = workflowEngine.getValidNextStatuses(ContractStatus.TERMINATED);
      expect(nextStatuses).toEqual([]);
    });
  });
});


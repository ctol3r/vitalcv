/**
 * Unit tests for ContractPartyService
 */

import { ContractPartyService } from '../contractPartyService.js';
import { PrismaClient, SignatureStatus } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
  SignatureStatus: {
    PENDING: 'PENDING',
    SIGNED: 'SIGNED',
    DECLINED: 'DECLINED',
  },
}));

describe('ContractPartyService', () => {
  let partyService: ContractPartyService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      contractParty: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      contract: {
        findUnique: jest.fn(),
      },
      contractAuditLog: {
        create: jest.fn(),
      },
    };

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
    partyService = new ContractPartyService();
  });

  describe('addParty', () => {
    it('should add a party to a contract', async () => {
      const input = {
        contractId: 'contract-1',
        contactEmail: 'party@example.com',
        role: 'SIGNER' as const,
      };

      mockPrisma.contractParty.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.contract.findUnique.mockResolvedValue({
        id: 'contract-1',
        title: 'Test Contract',
      });
      mockPrisma.contractParty.create.mockResolvedValue({
        id: 'party-1',
        ...input,
        signatureStatus: SignatureStatus.PENDING,
      });

      const result = await partyService.addParty(input);

      expect(result).toBeDefined();
      expect(mockPrisma.contractParty.create).toHaveBeenCalled();
      expect(mockPrisma.contractAuditLog.create).toHaveBeenCalled();
    });

    it('should reject duplicate invite', async () => {
      const input = {
        contractId: 'contract-1',
        contactEmail: 'party@example.com',
        role: 'SIGNER' as const,
      };

      mockPrisma.contractParty.findFirst.mockResolvedValue({
        id: 'existing-party',
        contactEmail: 'party@example.com',
      });

      await expect(partyService.addParty(input)).rejects.toThrow(
        'already invited'
      );
    });
  });

  describe('updateSignatureStatus', () => {
    it('should update signature status to SIGNED', async () => {
      const input = {
        partyId: 'party-1',
        signatureStatus: 'SIGNED' as const,
        signedAt: new Date(),
      };

      mockPrisma.contractParty.findUnique.mockResolvedValue({
        id: 'party-1',
        contractId: 'contract-1',
        signatureStatus: SignatureStatus.PENDING,
        contract: {
          id: 'contract-1',
          title: 'Test Contract',
        },
      });

      mockPrisma.contractParty.update.mockResolvedValue({
        id: 'party-1',
        signatureStatus: SignatureStatus.SIGNED,
        signedAt: input.signedAt,
      });

      const result = await partyService.updateSignatureStatus(input);

      expect(result.signatureStatus).toBe(SignatureStatus.SIGNED);
      expect(mockPrisma.contractAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('removeParty', () => {
    it('should remove a party from contract', async () => {
      const partyId = 'party-1';
      const userId = 'user-1';

      mockPrisma.contractParty.findUnique.mockResolvedValue({
        id: partyId,
        contractId: 'contract-1',
        signatureStatus: SignatureStatus.PENDING,
        contactEmail: 'party@example.com',
        role: 'SIGNER',
        contract: {
          id: 'contract-1',
          title: 'Test Contract',
        },
      });

      mockPrisma.contractParty.delete.mockResolvedValue({});

      await partyService.removeParty(partyId, userId);

      expect(mockPrisma.contractParty.delete).toHaveBeenCalled();
      expect(mockPrisma.contractAuditLog.create).toHaveBeenCalled();
    });

    it('should reject removing a party who has signed', async () => {
      const partyId = 'party-1';
      const userId = 'user-1';

      mockPrisma.contractParty.findUnique.mockResolvedValue({
        id: partyId,
        contractId: 'contract-1',
        signatureStatus: SignatureStatus.SIGNED,
      });

      await expect(partyService.removeParty(partyId, userId)).rejects.toThrow(
        'already signed'
      );
    });
  });

  describe('areAllSignersSigned', () => {
    it('should return true if all signers have signed', async () => {
      const contractId = 'contract-1';

      mockPrisma.contractParty.findMany.mockResolvedValue([
        { id: 'party-1', role: 'SIGNER', signatureStatus: SignatureStatus.SIGNED },
        { id: 'party-2', role: 'SIGNER', signatureStatus: SignatureStatus.SIGNED },
      ]);

      const result = await partyService.areAllSignersSigned(contractId);

      expect(result).toBe(true);
    });

    it('should return false if not all signers have signed', async () => {
      const contractId = 'contract-1';

      mockPrisma.contractParty.findMany.mockResolvedValue([
        { id: 'party-1', role: 'SIGNER', signatureStatus: SignatureStatus.SIGNED },
        { id: 'party-2', role: 'SIGNER', signatureStatus: SignatureStatus.PENDING },
      ]);

      const result = await partyService.areAllSignersSigned(contractId);

      expect(result).toBe(false);
    });
  });
});


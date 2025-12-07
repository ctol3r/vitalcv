/**
 * B119C-ROI-024: Revenue Recognition Schedule Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  createRevenueRecognition,
  recordCashSettlement,
  generateRevenueSchedule,
  getPendingVitaRecognitions,
} from '../revenueSchedule';

// Mock Prisma client
const mockPrisma = {
  revenueRecognition: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Revenue Recognition Schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRevenueRecognition', () => {
    it('should create FIAT revenue recognition with recognized status', async () => {
      const input = {
        eventId: 'event-1',
        eventType: 'marketplacePurchase',
        orgId: 'org-1',
        revenueType: 'FIAT' as const,
        amount: 10000, // $100 in cents
      };

      const mockResult = {
        id: 'rr-1',
        ...input,
        orgId: 'org-1',
        recognizedAt: new Date(),
        cashSettledAt: null,
        settlementTxId: null,
        status: 'recognized',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.revenueRecognition.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await createRevenueRecognition(mockPrisma, input);

      expect(result.status).toBe('recognized');
      expect(mockPrisma.revenueRecognition.create).toHaveBeenCalledWith({
        data: {
          eventId: 'event-1',
          eventType: 'marketplacePurchase',
          orgId: 'org-1',
          revenueType: 'FIAT',
          amount: 10000,
          recognizedAt: expect.any(Date),
          status: 'recognized',
          metadata: {},
        },
      });
    });

    it('should create VITA revenue recognition with pending status', async () => {
      const input = {
        eventId: 'event-1',
        eventType: 'marketplacePurchase',
        orgId: 'org-1',
        revenueType: 'VITA' as const,
        amount: 1000, // 1000 VITA tokens
      };

      const mockResult = {
        id: 'rr-1',
        ...input,
        orgId: 'org-1',
        recognizedAt: new Date(),
        cashSettledAt: null,
        settlementTxId: null,
        status: 'pending',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.revenueRecognition.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await createRevenueRecognition(mockPrisma, input);

      expect(result.status).toBe('pending');
      expect(mockPrisma.revenueRecognition.create).toHaveBeenCalledWith({
        data: {
          eventId: 'event-1',
          eventType: 'marketplacePurchase',
          orgId: 'org-1',
          revenueType: 'VITA',
          amount: 1000,
          recognizedAt: expect.any(Date),
          status: 'pending',
          metadata: {},
        },
      });
    });
  });

  describe('recordCashSettlement', () => {
    it('should record cash settlement for VITA revenue', async () => {
      const recognition = {
        id: 'rr-1',
        eventId: 'event-1',
        eventType: 'marketplacePurchase',
        orgId: 'org-1',
        revenueType: 'VITA' as const,
        amount: 1000,
        recognizedAt: new Date(),
        cashSettledAt: null,
        settlementTxId: null,
        status: 'pending' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.revenueRecognition.findUnique as jest.Mock).mockResolvedValue(recognition);
      (mockPrisma.revenueRecognition.update as jest.Mock).mockResolvedValue({
        ...recognition,
        cashSettledAt: new Date(),
        settlementTxId: 'tx-123',
        status: 'settled',
      });

      const result = await recordCashSettlement(mockPrisma, 'rr-1', 'tx-123');

      expect(result.status).toBe('settled');
      expect(result.settlementTxId).toBe('tx-123');
      expect(result.cashSettledAt).toBeInstanceOf(Date);
    });

    it('should reject cash settlement for FIAT revenue', async () => {
      const recognition = {
        id: 'rr-1',
        eventId: 'event-1',
        eventType: 'marketplacePurchase',
        orgId: 'org-1',
        revenueType: 'FIAT' as const,
        amount: 10000,
        recognizedAt: new Date(),
        cashSettledAt: null,
        settlementTxId: null,
        status: 'recognized' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.revenueRecognition.findUnique as jest.Mock).mockResolvedValue(recognition);

      await expect(recordCashSettlement(mockPrisma, 'rr-1', 'tx-123')).rejects.toThrow(
        'Cash settlement only applies to VITA revenue'
      );
    });

    it('should reject cash settlement for already settled revenue', async () => {
      const recognition = {
        id: 'rr-1',
        eventId: 'event-1',
        eventType: 'marketplacePurchase',
        orgId: 'org-1',
        revenueType: 'VITA' as const,
        amount: 1000,
        recognizedAt: new Date(),
        cashSettledAt: new Date(),
        settlementTxId: 'tx-123',
        status: 'settled' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.revenueRecognition.findUnique as jest.Mock).mockResolvedValue(recognition);

      await expect(recordCashSettlement(mockPrisma, 'rr-1', 'tx-456')).rejects.toThrow(
        'already settled'
      );
    });
  });

  describe('generateRevenueSchedule', () => {
    it('should generate revenue recognition from billing event', async () => {
      const mockResult = {
        id: 'rr-1',
        eventId: 'event-1',
        eventType: 'marketplacePurchase',
        orgId: 'org-1',
        revenueType: 'FIAT' as const,
        amount: 10000,
        recognizedAt: new Date(),
        cashSettledAt: null,
        settlementTxId: null,
        status: 'recognized' as const,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.revenueRecognition.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await generateRevenueSchedule(
        mockPrisma,
        'event-1',
        'marketplacePurchase',
        'org-1',
        'FIAT',
        10000
      );

      expect(result).toEqual(mockResult);
    });
  });
});


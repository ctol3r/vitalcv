/**
 * B223B-MARKET-007: OrderTransaction Model Tests
 */

import { PrismaClient } from '@prisma/client';
import {
  createTransaction,
  getTransaction,
  getTransactionById,
  listTransactions,
  updateTransactionStatus,
  getVendorTransactions,
  getPurchaserTransactions,
  validateTransactionInput,
  OrderTransactionInput,
} from '../OrderTransaction.js';

describe('OrderTransaction Model', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      orderTransaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    } as any;
  });

  describe('validateTransactionInput', () => {
    it('should validate correct input', () => {
      const input: OrderTransactionInput = {
        transactionId: 'tx_123',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 1000,
        currency: 'USD',
      };

      expect(() => validateTransactionInput(input)).not.toThrow();
    });

    it('should throw error if transactionId is missing', () => {
      const input: OrderTransactionInput = {
        transactionId: '',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 1000,
        currency: 'USD',
      };

      expect(() => validateTransactionInput(input)).toThrow('transactionId is required');
    });

    it('should throw error if amount is not positive', () => {
      const input: OrderTransactionInput = {
        transactionId: 'tx_123',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 0,
        currency: 'USD',
      };

      expect(() => validateTransactionInput(input)).toThrow('amount must be positive');
    });

    it('should throw error if currency is missing', () => {
      const input: OrderTransactionInput = {
        transactionId: 'tx_123',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 1000,
        currency: '',
      };

      expect(() => validateTransactionInput(input)).toThrow('currency is required');
    });
  });

  describe('createTransaction', () => {
    it('should create a transaction', async () => {
      const input: OrderTransactionInput = {
        transactionId: 'tx_123',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 1000,
        currency: 'USD',
        status: 'pending',
      };

      const mockResult = {
        id: 'id_123',
        transactionId: 'tx_123',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 1000,
        currency: 'USD',
        status: 'pending',
        receiptUrl: null,
        metadata: {},
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.orderTransaction.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await createTransaction(mockPrisma as any, input);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.orderTransaction.create).toHaveBeenCalledWith({
        data: {
          transactionId: 'tx_123',
          moduleId: 'module_123',
          vendorId: 'vendor_123',
          purchaserId: 'purchaser_123',
          amount: 1000,
          currency: 'USD',
          status: 'pending',
          receiptUrl: null,
          metadata: {},
          timestamp: expect.any(Date),
        },
      });
    });

    it('should use default status if not provided', async () => {
      const input: OrderTransactionInput = {
        transactionId: 'tx_123',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 1000,
        currency: 'USD',
      };

      const mockResult = {
        id: 'id_123',
        transactionId: 'tx_123',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 1000,
        currency: 'USD',
        status: 'pending',
        receiptUrl: null,
        metadata: {},
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.orderTransaction.create as jest.Mock).mockResolvedValue(mockResult);

      await createTransaction(mockPrisma as any, input);

      expect(mockPrisma.orderTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'pending',
        }),
      });
    });
  });

  describe('getTransaction', () => {
    it('should get transaction by transactionId', async () => {
      const mockResult = {
        id: 'id_123',
        transactionId: 'tx_123',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 1000,
        currency: 'USD',
        status: 'completed',
        receiptUrl: null,
        metadata: {},
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.orderTransaction.findUnique as jest.Mock).mockResolvedValue(mockResult);

      const result = await getTransaction(mockPrisma as any, 'tx_123');

      expect(result).toEqual(mockResult);
      expect(mockPrisma.orderTransaction.findUnique).toHaveBeenCalledWith({
        where: { transactionId: 'tx_123' },
      });
    });

    it('should return null if transaction not found', async () => {
      (mockPrisma.orderTransaction.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getTransaction(mockPrisma as any, 'tx_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listTransactions', () => {
    it('should list transactions with filters', async () => {
      const mockResults = [
        {
          id: 'id_1',
          transactionId: 'tx_1',
          moduleId: 'module_123',
          vendorId: 'vendor_123',
          purchaserId: 'purchaser_123',
          amount: 1000,
          currency: 'USD',
          status: 'completed',
          receiptUrl: null,
          metadata: {},
          timestamp: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.orderTransaction.findMany as jest.Mock).mockResolvedValue(mockResults);

      const result = await listTransactions(mockPrisma as any, {
        vendorId: 'vendor_123',
        status: 'completed',
      });

      expect(result).toEqual(mockResults);
      expect(mockPrisma.orderTransaction.findMany).toHaveBeenCalledWith({
        where: {
          vendorId: 'vendor_123',
          status: 'completed',
        },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      (mockPrisma.orderTransaction.findMany as jest.Mock).mockResolvedValue([]);

      await listTransactions(mockPrisma as any, {
        startDate,
        endDate,
      });

      expect(mockPrisma.orderTransaction.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status', async () => {
      const mockResult = {
        id: 'id_123',
        transactionId: 'tx_123',
        moduleId: 'module_123',
        vendorId: 'vendor_123',
        purchaserId: 'purchaser_123',
        amount: 1000,
        currency: 'USD',
        status: 'completed',
        receiptUrl: 'https://example.com/receipt.pdf',
        metadata: {},
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.orderTransaction.update as jest.Mock).mockResolvedValue(mockResult);

      const result = await updateTransactionStatus(
        mockPrisma as any,
        'tx_123',
        'completed',
        'https://example.com/receipt.pdf'
      );

      expect(result).toEqual(mockResult);
      expect(mockPrisma.orderTransaction.update).toHaveBeenCalledWith({
        where: { transactionId: 'tx_123' },
        data: {
          status: 'completed',
          receiptUrl: 'https://example.com/receipt.pdf',
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getVendorTransactions', () => {
    it('should get transactions for a vendor', async () => {
      const mockResults = [
        {
          id: 'id_1',
          transactionId: 'tx_1',
          moduleId: 'module_123',
          vendorId: 'vendor_123',
          purchaserId: 'purchaser_123',
          amount: 1000,
          currency: 'USD',
          status: 'completed',
          receiptUrl: null,
          metadata: {},
          timestamp: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.orderTransaction.findMany as jest.Mock).mockResolvedValue(mockResults);

      const result = await getVendorTransactions(mockPrisma as any, 'vendor_123');

      expect(result).toEqual(mockResults);
      expect(mockPrisma.orderTransaction.findMany).toHaveBeenCalledWith({
        where: {
          vendorId: 'vendor_123',
        },
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  describe('getPurchaserTransactions', () => {
    it('should get transactions for a purchaser', async () => {
      const mockResults = [
        {
          id: 'id_1',
          transactionId: 'tx_1',
          moduleId: 'module_123',
          vendorId: 'vendor_123',
          purchaserId: 'purchaser_123',
          amount: 1000,
          currency: 'USD',
          status: 'completed',
          receiptUrl: null,
          metadata: {},
          timestamp: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.orderTransaction.findMany as jest.Mock).mockResolvedValue(mockResults);

      const result = await getPurchaserTransactions(mockPrisma as any, 'purchaser_123');

      expect(result).toEqual(mockResults);
      expect(mockPrisma.orderTransaction.findMany).toHaveBeenCalledWith({
        where: {
          purchaserId: 'purchaser_123',
        },
        orderBy: { timestamp: 'desc' },
      });
    });
  });
});


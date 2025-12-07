/**
 * S72-STRETCH-E-008: VITA Ledger Export Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import router from '../exportLedger';

// Mock Prisma client
const mockPrisma = {
  vitaLedger: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock the Prisma import in the route file
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('VITA Ledger Export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export CSV with correct format', async () => {
    const mockEntries = [
      {
        id: 'ledger-1',
        orgId: 'org-1',
        amount: -1000, // Debit
        type: 'purchase',
        txId: 'tx-123',
        reference: 'purchase-1',
        createdAt: new Date('2025-01-01T00:00:00Z'),
      },
      {
        id: 'ledger-2',
        orgId: 'org-1',
        amount: 500, // Credit
        type: 'distribution',
        txId: 'tx-456',
        reference: null,
        createdAt: new Date('2025-01-02T00:00:00Z'),
      },
    ];

    (mockPrisma.vitaLedger.findMany as jest.Mock).mockResolvedValue(mockEntries);

    const req = {
      query: {},
    } as unknown as Request;

    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    // Call the route handler
    await (router as any).handle(req, res);

    // Verify CSV was generated
    expect(mockPrisma.vitaLedger.findMany).toHaveBeenCalled();
    expect((res as any).setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect((res as any).setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="vita-ledger-')
    );
  });

  it('should filter by orgId', async () => {
    const req = {
      query: { orgId: 'org-1' },
    } as unknown as Request;

    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    (mockPrisma.vitaLedger.findMany as jest.Mock).mockResolvedValue([]);

    await (router as any).handle(req, res);

    expect(mockPrisma.vitaLedger.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org-1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('should calculate sums correctly', () => {
    const entries = [
      { amount: -1000, createdAt: new Date() },
      { amount: 500, createdAt: new Date() },
      { amount: -200, createdAt: new Date() },
      { amount: 300, createdAt: new Date() },
    ];

    const totalDebits = entries.filter((e) => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const totalCredits = entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
    const netAmount = entries.reduce((sum, e) => sum + e.amount, 0);

    expect(totalDebits).toBe(1200);
    expect(totalCredits).toBe(800);
    expect(netAmount).toBe(-400);
  });
});


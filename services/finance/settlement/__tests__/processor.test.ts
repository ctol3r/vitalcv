/**
 * Tests for SettlementProcessor
 */

import { PrismaClient } from '@prisma/client';
import { SettlementProcessor, BillingGateway } from '../processor';
import { RevenueRecognitionScheduler } from '../../revenue/recognitionScheduler';

describe('SettlementProcessor', () => {
  let prisma: PrismaClient;
  let mockBillingGateway: BillingGateway;
  let processor: SettlementProcessor;
  let scheduler: RevenueRecognitionScheduler;

  beforeAll(() => {
    prisma = new PrismaClient();
    scheduler = new RevenueRecognitionScheduler(prisma);

    // Mock BillingGateway
    mockBillingGateway = {
      initiatePayout: jest.fn().mockResolvedValue({
        settlementTxId: 'settlement-123',
        status: 'pending' as const,
        estimatedCompletionDate: new Date(),
      }),
      getPayoutStatus: jest.fn().mockResolvedValue({
        status: 'completed' as const,
        completedAt: new Date(),
      }),
    };

    processor = new SettlementProcessor(prisma, mockBillingGateway);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.revenueRecognitionEvent.deleteMany({});
    await prisma.ledgerEntry.deleteMany({});
    await prisma.vitaLedger.deleteMany({});
  });

  describe('aggregatePayables', () => {
    it('should aggregate pending payables for an organization', async () => {
      // Create pending revenue recognition events
      await scheduler.createRecognitionEvent({
        eventId: 'event-1',
        orgId: 'org-123',
        amount: 5000,
        revenueType: 'USD',
        recognitionSchedule: 'immediate',
      });

      await scheduler.createRecognitionEvent({
        eventId: 'event-2',
        orgId: 'org-123',
        amount: 3000,
        revenueType: 'USD',
        recognitionSchedule: 'immediate',
      });

      const aggregation = await processor.aggregatePayables('org-123', 'USD');

      expect(aggregation.orgId).toBe('org-123');
      expect(aggregation.totalAmount).toBe(8000);
      expect(aggregation.entryCount).toBe(2);
      expect(aggregation.pendingRecognitionIds).toHaveLength(2);
    });

    it('should return zero for organization with no pending payables', async () => {
      const aggregation = await processor.aggregatePayables('org-none', 'USD');

      expect(aggregation.totalAmount).toBe(0);
      expect(aggregation.entryCount).toBe(0);
    });
  });

  describe('processSettlement', () => {
    it('should process settlement for an organization', async () => {
      // Create pending revenue recognition events
      await scheduler.createRecognitionEvent({
        eventId: 'event-1',
        orgId: 'org-123',
        amount: 5000,
        revenueType: 'USD',
        recognitionSchedule: 'immediate',
      });

      const result = await processor.processSettlement({
        orgId: 'org-123',
        currency: 'USD',
      });

      expect(result.settlementTxId).toBe('settlement-123');
      expect(result.aggregation.totalAmount).toBe(5000);
      expect(mockBillingGateway.initiatePayout).toHaveBeenCalled();
    });

    it('should throw error if amount is below minimum threshold', async () => {
      await scheduler.createRecognitionEvent({
        eventId: 'event-1',
        orgId: 'org-123',
        amount: 100,
        revenueType: 'USD',
        recognitionSchedule: 'immediate',
      });

      await expect(
        processor.processSettlement({
          orgId: 'org-123',
          currency: 'USD',
          minAmount: 1000,
        })
      ).rejects.toThrow('below minimum threshold');
    });

    it('should throw error if no payable amounts', async () => {
      await expect(
        processor.processSettlement({
          orgId: 'org-none',
          currency: 'USD',
        })
      ).rejects.toThrow('No payable amounts to settle');
    });
  });

  describe('getSettlementSummary', () => {
    it('should get settlement summary for an organization', async () => {
      await scheduler.createRecognitionEvent({
        eventId: 'event-1',
        orgId: 'org-123',
        amount: 5000,
        revenueType: 'USD',
        recognitionSchedule: 'immediate',
      });

      const summary = await processor.getSettlementSummary('org-123', 'USD');

      expect(summary.pending.totalAmount).toBe(5000);
      expect(summary.totalPending).toBe(5000);
      expect(summary.canSettle).toBe(true);
    });
  });
});


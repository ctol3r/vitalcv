/**
 * Tests for RevenueRecognitionScheduler
 */

import { PrismaClient } from '@prisma/client';
import { RevenueRecognitionScheduler } from '../recognitionScheduler';

describe('RevenueRecognitionScheduler', () => {
  let prisma: PrismaClient;
  let scheduler: RevenueRecognitionScheduler;

  beforeAll(() => {
    prisma = new PrismaClient();
    scheduler = new RevenueRecognitionScheduler(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.revenueRecognitionEvent.deleteMany({});
    await prisma.ledgerEntry.deleteMany({});
  });

  describe('createRecognitionEvent', () => {
    it('should create a revenue recognition event', async () => {
      const event = await scheduler.createRecognitionEvent({
        eventId: 'event-123',
        orgId: 'org-123',
        amount: 10000,
        revenueType: 'USD',
        recognitionSchedule: 'immediate',
      });

      expect(event).toBeDefined();
      expect(event.eventId).toBe('event-123');
      expect(event.status).toBe('pending');
    });
  });

  describe('processRecognition', () => {
    it('should process immediate recognition', async () => {
      const event = await scheduler.createRecognitionEvent({
        eventId: 'event-123',
        orgId: 'org-123',
        amount: 10000,
        revenueType: 'USD',
        recognitionSchedule: 'immediate',
      });

      const processed = await scheduler.processRecognition(event.id);

      expect(processed.status).toBe('recognized');
      expect(processed.recognizedAt).toBeDefined();
    });

    it('should process linear recognition', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

      const event = await scheduler.createRecognitionEvent({
        eventId: 'event-123',
        orgId: 'org-123',
        amount: 12000,
        revenueType: 'USD',
        recognitionSchedule: 'linear',
        scheduleConfig: {
          schedule: 'linear',
          startDate,
          endDate,
          periods: 12,
        },
      });

      // Process after 6 months (50% recognized)
      const sixMonthsLater = new Date(startDate.getTime() + 180 * 24 * 60 * 60 * 1000);
      jest.useFakeTimers();
      jest.setSystemTime(sixMonthsLater);

      const processed = await scheduler.processRecognition(event.id);

      expect(processed.status).toBe('recognized');
      jest.useRealTimers();
    });

    it('should process rateable recognition', async () => {
      const event = await scheduler.createRecognitionEvent({
        eventId: 'event-123',
        orgId: 'org-123',
        amount: 10000,
        revenueType: 'USD',
        recognitionSchedule: 'rateable',
        metadata: {
          completionPercentage: 50,
        },
      });

      const processed = await scheduler.processRecognition(event.id);

      expect(processed.status).toBe('recognized');
    });
  });

  describe('updateCompletionPercentage', () => {
    it('should update completion percentage for rateable recognition', async () => {
      const event = await scheduler.createRecognitionEvent({
        eventId: 'event-123',
        orgId: 'org-123',
        amount: 10000,
        revenueType: 'USD',
        recognitionSchedule: 'rateable',
      });

      const updated = await scheduler.updateCompletionPercentage(event.id, 75);

      expect(updated).toBeDefined();
    });

    it('should throw error for non-rateable schedule', async () => {
      const event = await scheduler.createRecognitionEvent({
        eventId: 'event-123',
        orgId: 'org-123',
        amount: 10000,
        revenueType: 'USD',
        recognitionSchedule: 'immediate',
      });

      await expect(
        scheduler.updateCompletionPercentage(event.id, 75)
      ).rejects.toThrow('Cannot update completion percentage for non-rateable schedule');
    });
  });
});


/**
 * Tests for RevenueRecognitionEvent model
 */

import { PrismaClient } from '@prisma/client';
import { RevenueRecognitionEvent } from '../RevenueRecognitionEvent';

describe('RevenueRecognitionEvent', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.revenueRecognitionEvent.deleteMany({});
  });

  describe('create', () => {
    it('should create a revenue recognition event', async () => {
      const event = await RevenueRecognitionEvent.create(prisma, {
        eventId: 'event-123',
        orgId: 'org-123',
        amount: 10000,
        revenueType: 'USD',
        recognitionSchedule: 'immediate',
      });

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.eventId).toBe('event-123');
      expect(event.orgId).toBe('org-123');
      expect(event.amount).toBe(10000);
      expect(event.revenueType).toBe('USD');
      expect(event.recognitionSchedule).toBe('immediate');
      expect(event.status).toBe('pending');
    });

    it('should default to immediate recognition schedule', async () => {
      const event = await RevenueRecognitionEvent.create(prisma, {
        eventId: 'event-123',
        amount: 10000,
        revenueType: 'USD',
      });

      expect(event.recognitionSchedule).toBe('immediate');
    });
  });

  describe('findById', () => {
    it('should find a revenue recognition event by ID', async () => {
      const created = await RevenueRecognitionEvent.create(prisma, {
        eventId: 'event-123',
        amount: 10000,
        revenueType: 'USD',
      });

      const found = await RevenueRecognitionEvent.findById(prisma, created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.eventId).toBe('event-123');
    });

    it('should return null if event not found', async () => {
      const found = await RevenueRecognitionEvent.findById(prisma, 'non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('findByEventId', () => {
    it('should find revenue recognition events by event ID', async () => {
      await RevenueRecognitionEvent.create(prisma, {
        eventId: 'event-123',
        amount: 10000,
        revenueType: 'USD',
      });

      await RevenueRecognitionEvent.create(prisma, {
        eventId: 'event-123',
        amount: 5000,
        revenueType: 'VITA',
      });

      const events = await RevenueRecognitionEvent.findByEventId(prisma, 'event-123');

      expect(events).toHaveLength(2);
      expect(events.every((e) => e.eventId === 'event-123')).toBe(true);
    });
  });

  describe('findPending', () => {
    it('should find pending revenue recognition events', async () => {
      await RevenueRecognitionEvent.create(prisma, {
        eventId: 'event-123',
        amount: 10000,
        revenueType: 'USD',
        status: 'pending',
      });

      await RevenueRecognitionEvent.create(prisma, {
        eventId: 'event-456',
        amount: 5000,
        revenueType: 'USD',
        status: 'recognized',
      });

      const pending = await RevenueRecognitionEvent.findPending(prisma);

      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending');
    });
  });

  describe('updateStatus', () => {
    it('should update the status of a revenue recognition event', async () => {
      const event = await RevenueRecognitionEvent.create(prisma, {
        eventId: 'event-123',
        amount: 10000,
        revenueType: 'USD',
        status: 'pending',
      });

      const now = new Date();
      const updated = await event.updateStatus('recognized', now);

      expect(updated.status).toBe('recognized');
      expect(updated.recognizedAt).toBeDefined();
    });
  });
});


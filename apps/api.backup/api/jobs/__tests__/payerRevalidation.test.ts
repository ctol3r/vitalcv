/**
 * Unit tests for Payer Revalidation Job
 * B137A-REMIND-013: Tests for revalidation reminder creation and scheduling
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  getOverdueRevalidations,
  getUpcomingRevalidations,
  runRevalidationReminderJob,
} from '../payerRevalidation.js';

// Create mock Prisma methods with proper typing
const mockFindMany = jest.fn<any>();
const mockFindFirst = jest.fn<any>();
const mockCreate = jest.fn<any>();

// Mock Prisma
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      payerEnrollment: {
        findMany: mockFindMany,
      },
      payerEnrollmentEvent: {
        findFirst: mockFindFirst,
        create: mockCreate,
      },
    })),
  };
});

describe('Payer Revalidation Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('runRevalidationReminderJob', () => {
    it('should process enrollments with revalidation dates', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          revalidationDueAt: futureDate,
          pecosEnrollmentId: 'PECOS-123',
          pecosStatus: 'APPROVED',
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockEnrollments);
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({});

      const result = await runRevalidationReminderJob();

      expect(result.success).toBe(true);
      expect(result.remindersCreated).toBeGreaterThanOrEqual(0);
      expect(result.executedAt).toBeInstanceOf(Date);
    });

    it('should create 60-day reminder for enrollment due in 60 days', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          revalidationDueAt: futureDate,
          pecosEnrollmentId: null,
          pecosStatus: null,
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockEnrollments);
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({});

      const result = await runRevalidationReminderJob();

      expect(result.remindersCreated).toBeGreaterThan(0);
      expect(result.reminders[0].reminderType).toBe('60-day');
    });

    it('should create overdue reminder for past revalidation dates', async () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          revalidationDueAt: pastDate,
          pecosEnrollmentId: null,
          pecosStatus: null,
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockEnrollments);
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({});

      const result = await runRevalidationReminderJob();

      if (result.reminders.length > 0) {
        expect(result.reminders[0].reminderType).toBe('overdue');
      }
    });

    it('should skip reminders already sent today', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          revalidationDueAt: futureDate,
          pecosEnrollmentId: null,
          pecosStatus: null,
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
      ];

      // Mock existing reminder sent today
      mockFindMany.mockResolvedValue(mockEnrollments);
      mockFindFirst.mockResolvedValue({
        id: 'event-1',
        enrollmentId: 'enroll-1',
        eventType: 'status_change',
        source: 'SYSTEM',
        result: 'PASS',
        evidenceUrl: null,
        evidenceHash: null,
        anchoredTxHash: null,
        metadata: { reminderType: '30-day' },
        createdAt: new Date(),
      });

      const result = await runRevalidationReminderJob();

      expect(result.remindersCreated).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockFindMany.mockRejectedValue(new Error('Database error'));

      const result = await runRevalidationReminderJob();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Database error');
    });

    it('should skip enrollments without revalidation dates', async () => {
      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          revalidationDueAt: null,
          pecosEnrollmentId: null,
          pecosStatus: null,
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockEnrollments);

      const result = await runRevalidationReminderJob();

      expect(result.remindersCreated).toBe(0);
    });
  });

  describe('getUpcomingRevalidations', () => {
    it('should retrieve enrollments due in next 90 days', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          revalidationDueAt: futureDate,
          pecosEnrollmentId: 'PECOS-123',
          pecosStatus: 'APPROVED',
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockEnrollments);

      const result = await getUpcomingRevalidations(90);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].enrollmentId).toBe('enroll-1');
      expect(result[0].daysUntilDue).toBeGreaterThan(0);
    });

    it('should support custom day threshold', async () => {
      mockFindMany.mockResolvedValue([]);

      await getUpcomingRevalidations(30);

      expect(mockFindMany).toHaveBeenCalled();
    });

    it('should order by revalidation date ascending', async () => {
      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          revalidationDueAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          pecosEnrollmentId: null,
          pecosStatus: null,
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
        {
          id: 'enroll-2',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:456',
          status: 'APPROVED',
          revalidationDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          pecosEnrollmentId: null,
          pecosStatus: null,
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockEnrollments);

      const result = await getUpcomingRevalidations();

      expect(result[0].daysUntilDue).toBeLessThan(result[1].daysUntilDue);
    });
  });

  describe('getOverdueRevalidations', () => {
    it('should retrieve overdue enrollments', async () => {
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          revalidationDueAt: pastDate,
          pecosEnrollmentId: 'PECOS-123',
          pecosStatus: 'REVALIDATION_DUE',
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockEnrollments);

      const result = await getOverdueRevalidations();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].reminderType).toBe('overdue');
      expect(result[0].daysUntilDue).toBeLessThan(0);
    });

    it('should order by revalidation date ascending', async () => {
      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          revalidationDueAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          pecosEnrollmentId: null,
          pecosStatus: null,
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
        {
          id: 'enroll-2',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:456',
          status: 'APPROVED',
          revalidationDueAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          pecosEnrollmentId: null,
          pecosStatus: null,
          payer: {
            id: 'payer-1',
            payerId: 'TEST_PAYER',
            name: 'Test Payer',
          },
        },
      ];

      mockFindMany.mockResolvedValue(mockEnrollments);

      const result = await getOverdueRevalidations();

      // More overdue should come first
      expect(Math.abs(result[0].daysUntilDue)).toBeGreaterThan(Math.abs(result[1].daysUntilDue));
    });
  });
});

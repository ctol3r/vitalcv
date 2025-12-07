/**
 * Unit tests for PECOS client
 * B137A-PECOS-006: Tests for getPecosStatus, validatePecosStatus, needsPecosRevalidation
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  MOCK_PECOS_STATUS_APPROVED,
  MOCK_PECOS_STATUS_REVALIDATION_DUE,
  calculatePecosRevalidationDate,
  getPecosRevalidationReminders,
  getPecosStatus,
  needsPecosRevalidation,
  validatePecosStatus,
  type PecosEnrollmentStatus,
} from '../pecosClient.js';

describe('PECOS Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPecosStatus', () => {
    it('should fetch PECOS status by enrollment ID', async () => {
      const result = await getPecosStatus({ enrollmentId: 'PECOS-123' });

      expect(result.success).toBe(true);
      expect(result.status).toBeDefined();
      expect(result.status?.pecosEnrollmentId).toBeDefined();
      expect(result.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('should fetch PECOS status by NPI', async () => {
      const result = await getPecosStatus({ npi: '1234567890' });

      expect(result.success).toBe(true);
      expect(result.status).toBeDefined();
      expect(result.status?.npi).toBe('1234567890');
    });

    it('should return error if neither enrollmentId nor NPI provided', async () => {
      const result = await getPecosStatus({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Either enrollmentId or NPI is required');
    });

    it('should include enrollment type and cycle', async () => {
      const result = await getPecosStatus({ enrollmentId: 'PECOS-123' });

      expect(result.status?.enrollmentType).toMatch(/^855[IRAB]$/);
      expect(result.status?.cycle).toMatch(/^(5year|3year)$/);
    });

    it('should include revalidation dates for approved enrollments', async () => {
      const result = await getPecosStatus({ enrollmentId: 'PECOS-123' });

      if (result.status?.status === 'APPROVED') {
        expect(result.status.effectiveDate).toBeDefined();
        expect(result.status.revalidationDueDate).toBeDefined();
      }
    });

    it('should include practice locations', async () => {
      const result = await getPecosStatus({ enrollmentId: 'PECOS-123' });

      expect(result.status?.practiceLocations).toBeDefined();
      expect(Array.isArray(result.status?.practiceLocations)).toBe(true);
      expect(result.status?.practiceLocations.length).toBeGreaterThan(0);
    });

    it('should occasionally return different statuses (mock)', async () => {
      const results = await Promise.all(
        Array(10)
          .fill(null)
          .map(() => getPecosStatus({ enrollmentId: 'PECOS-TEST' })),
      );

      const statuses = results.map((r) => r.status?.status).filter(Boolean);
      expect(statuses.length).toBeGreaterThan(0);
    });
  });

  describe('validatePecosStatus', () => {
    it('should validate approved PECOS status', () => {
      const result = validatePecosStatus(MOCK_PECOS_STATUS_APPROVED);

      expect(result.isValid).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should fail validation for non-APPROVED status', () => {
      const pendingStatus: PecosEnrollmentStatus = {
        ...MOCK_PECOS_STATUS_APPROVED,
        status: 'PENDING',
      };

      const result = validatePecosStatus(pendingStatus);

      expect(result.isValid).toBe(false);
      expect(result.reasons).toContain('PECOS enrollment status is PENDING, must be APPROVED');
    });

    it('should fail validation for expired enrollment', () => {
      const expiredStatus: PecosEnrollmentStatus = {
        ...MOCK_PECOS_STATUS_APPROVED,
        expirationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = validatePecosStatus(expiredStatus);

      expect(result.isValid).toBe(false);
      expect(result.reasons).toContain('PECOS enrollment has expired');
    });

    it('should fail validation for overdue revalidation', () => {
      const overdueStatus: PecosEnrollmentStatus = {
        ...MOCK_PECOS_STATUS_APPROVED,
        revalidationDueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = validatePecosStatus(overdueStatus);

      expect(result.isValid).toBe(false);
      expect(result.reasons).toContain('PECOS revalidation is overdue');
    });

    it('should handle denied status', () => {
      const deniedStatus: PecosEnrollmentStatus = {
        ...MOCK_PECOS_STATUS_APPROVED,
        status: 'DENIED',
      };

      const result = validatePecosStatus(deniedStatus);

      expect(result.isValid).toBe(false);
      expect(result.reasons.some((r) => r.includes('DENIED'))).toBe(true);
    });
  });

  describe('needsPecosRevalidation', () => {
    it('should return true if revalidation is due within threshold', () => {
      const soonStatus: PecosEnrollmentStatus = {
        ...MOCK_PECOS_STATUS_APPROVED,
        revalidationDueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = needsPecosRevalidation(soonStatus, 90);

      expect(result).toBe(true);
    });

    it('should return false if revalidation is beyond threshold', () => {
      const distantStatus: PecosEnrollmentStatus = {
        ...MOCK_PECOS_STATUS_APPROVED,
        revalidationDueDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = needsPecosRevalidation(distantStatus, 90);

      expect(result).toBe(false);
    });

    it('should return false if no revalidation date', () => {
      const noDateStatus: PecosEnrollmentStatus = {
        ...MOCK_PECOS_STATUS_APPROVED,
        revalidationDueDate: null,
      };

      const result = needsPecosRevalidation(noDateStatus);

      expect(result).toBe(false);
    });

    it('should use default threshold of 90 days', () => {
      const status: PecosEnrollmentStatus = {
        ...MOCK_PECOS_STATUS_APPROVED,
        revalidationDueDate: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = needsPecosRevalidation(status);

      expect(result).toBe(true);
    });
  });

  describe('calculatePecosRevalidationDate', () => {
    it('should calculate 5-year revalidation date', () => {
      const approvalDate = new Date('2020-01-15');
      const revalidationDate = calculatePecosRevalidationDate(approvalDate, '5year');

      expect(revalidationDate.getFullYear()).toBe(2025);
      expect(revalidationDate.getMonth()).toBe(0); // January
      expect(revalidationDate.getDate()).toBe(15);
    });

    it('should calculate 3-year DMEPOS revalidation date', () => {
      const approvalDate = new Date('2021-06-01');
      const revalidationDate = calculatePecosRevalidationDate(approvalDate, '3year');

      expect(revalidationDate.getFullYear()).toBe(2024);
      expect(revalidationDate.getMonth()).toBe(5); // June
      expect(revalidationDate.getDate()).toBe(1);
    });

    it('should default to 5-year cycle if not specified', () => {
      const approvalDate = new Date('2020-01-01');
      const revalidationDate = calculatePecosRevalidationDate(approvalDate);

      const yearsDiff = revalidationDate.getFullYear() - approvalDate.getFullYear();
      expect(yearsDiff).toBe(5);
    });
  });

  describe('getPecosRevalidationReminders', () => {
    it('should generate reminder schedule', () => {
      const revalidationDate = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
      const reminders = getPecosRevalidationReminders(revalidationDate);

      expect(Array.isArray(reminders)).toBe(true);
      expect(reminders.length).toBeGreaterThan(0);
      expect(reminders.length).toBeLessThanOrEqual(5); // Max 5 intervals
    });

    it('should only include future reminders', () => {
      const revalidationDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const reminders = getPecosRevalidationReminders(revalidationDate);

      const now = new Date();
      reminders.forEach((reminder) => {
        expect(reminder.getTime()).toBeGreaterThan(now.getTime());
      });
    });

    it('should return empty array if revalidation date is past', () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const reminders = getPecosRevalidationReminders(pastDate);

      expect(reminders).toHaveLength(0);
    });

    it('should generate 5 reminders for distant dates', () => {
      const distantDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const reminders = getPecosRevalidationReminders(distantDate);

      expect(reminders.length).toBe(5); // 90, 60, 30, 14, 7 days
    });
  });

  describe('Mock fixtures', () => {
    it('MOCK_PECOS_STATUS_APPROVED should have valid structure', () => {
      expect(MOCK_PECOS_STATUS_APPROVED.pecosEnrollmentId).toBe('PECOS-TEST-001');
      expect(MOCK_PECOS_STATUS_APPROVED.status).toBe('APPROVED');
      expect(MOCK_PECOS_STATUS_APPROVED.enrollmentType).toBe('855I');
      expect(MOCK_PECOS_STATUS_APPROVED.cycle).toBe('5year');
      expect(validatePecosStatus(MOCK_PECOS_STATUS_APPROVED).isValid).toBe(true);
    });

    it('MOCK_PECOS_STATUS_REVALIDATION_DUE should be marked for revalidation', () => {
      expect(MOCK_PECOS_STATUS_REVALIDATION_DUE.status).toBe('REVALIDATION_DUE');
      expect(needsPecosRevalidation(MOCK_PECOS_STATUS_REVALIDATION_DUE)).toBe(true);
    });
  });
});

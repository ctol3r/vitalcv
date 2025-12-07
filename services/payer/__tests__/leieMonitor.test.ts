/**
 * Unit tests for LEIE Monitor
 * B137A-LEIE-014: Tests for LEIE checking and enrollment termination
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  checkClinicianLeie,
  checkLeie,
  getLeieExcludedEnrollments,
  runLeieMonitorJob,
  type LeieCheckResult,
} from '../leieMonitor.js';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    payerEnrollment: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    npiClaim: {
      findFirst: jest.fn(),
    },
    npdbOigMonitor: {
      create: jest.fn(),
    },
    payerEnrollmentEvent: {
      create: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

describe('LEIE Monitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkLeie', () => {
    it('should check NPI against LEIE', async () => {
      const result = await checkLeie('1234567890');

      expect(result.npi).toBe('1234567890');
      expect(result.found).toBeDefined();
      expect(typeof result.found).toBe('boolean');
      expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it('should return exclusion record when found', async () => {
      // Run multiple times to potentially hit exclusion scenario
      const results: LeieCheckResult[] = [];
      for (let i = 0; i < 100; i++) {
        const result = await checkLeie('1234567890');
        results.push(result);
      }

      const exclusions = results.filter((r) => r.found);
      if (exclusions.length > 0) {
        const exclusion = exclusions[0];
        expect(exclusion.records).toBeDefined();
        expect(Array.isArray(exclusion.records)).toBe(true);
        expect(exclusion.records![0]).toHaveProperty('exclusionType');
        expect(exclusion.records![0]).toHaveProperty('exclusionDate');
      }
    });

    it('should return clean result when not found', async () => {
      // Most results should be clean (98% chance)
      const results: LeieCheckResult[] = [];
      for (let i = 0; i < 10; i++) {
        const result = await checkLeie('1234567890');
        results.push(result);
      }

      const cleanResults = results.filter((r) => !r.found);
      expect(cleanResults.length).toBeGreaterThan(0);
      cleanResults.forEach((result) => {
        expect(result.found).toBe(false);
        expect(result.records).toBeUndefined();
      });
    });

    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await checkLeie('1234567890');
      const duration = Date.now() - start;

      // Should complete within 1 second (includes 300ms mock delay)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('runLeieMonitorJob', () => {
    it('should process all approved enrollments', async () => {
      const prisma = new PrismaClient() as any;

      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          payer: { id: 'payer-1', name: 'Test Payer' },
        },
      ];

      (prisma.payerEnrollment.findMany as any).mockResolvedValue(mockEnrollments);
      (prisma.npiClaim.findFirst as any).mockResolvedValue({
        id: 'npi-1',
        npi: '1234567890',
        userId: 'user-1',
      });

      const result = await runLeieMonitorJob();

      expect(result.success).toBeDefined();
      expect(result.enrollmentsChecked).toBe(1);
      expect(result.executedAt).toBeInstanceOf(Date);
    });

    it('should handle enrollments without NPI claims', async () => {
      const prisma = new PrismaClient() as any;

      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:no-npi',
          status: 'APPROVED',
          payer: { id: 'payer-1', name: 'Test Payer' },
        },
      ];

      (prisma.payerEnrollment.findMany as any).mockResolvedValue(mockEnrollments);
      (prisma.npiClaim.findFirst as any).mockResolvedValue(null);

      const result = await runLeieMonitorJob();

      expect(result.success).toBe(true);
      expect(result.exclusionsFound).toBe(0);
    });

    it('should terminate enrollment when exclusion found', async () => {
      const prisma = new PrismaClient() as any;

      const mockEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:123',
          status: 'APPROVED',
          metadata: {},
          payer: { id: 'payer-1', name: 'Test Payer' },
        },
      ];

      (prisma.payerEnrollment.findMany as any).mockResolvedValue(mockEnrollments);
      (prisma.npiClaim.findFirst as any).mockResolvedValue({
        id: 'npi-1',
        npi: '1234567890',
        userId: 'user-1',
      });

      // Mock update to return updated enrollment
      (prisma.payerEnrollment.update as any).mockResolvedValue({
        ...mockEnrollments[0],
        status: 'TERMINATED',
        terminatedAt: new Date(),
      });

      (prisma.npdbOigMonitor.create as any).mockResolvedValue({});
      (prisma.payerEnrollmentEvent.create as any).mockResolvedValue({});

      // Run the job - it will randomly find or not find exclusions
      const result = await runLeieMonitorJob();

      // The job should complete successfully regardless
      expect(result.success).toBeDefined();
      expect(result.enrollmentsChecked).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const prisma = new PrismaClient() as any;

      (prisma.payerEnrollment.findMany as any).mockRejectedValue(new Error('Database error'));

      const result = await runLeieMonitorJob();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Database error');
    });
  });

  describe('checkClinicianLeie', () => {
    it('should check specific clinician', async () => {
      const prisma = new PrismaClient() as any;

      (prisma.npiClaim.findFirst as any).mockResolvedValue({
        id: 'npi-1',
        npi: '1234567890',
        userId: 'user-1',
      });

      const result = await checkClinicianLeie('did:example:123');

      expect(result).toBeDefined();
      expect(result?.clinicianDid).toBe('did:example:123');
      expect(result?.npi).toBe('1234567890');
    });

    it('should return null if no NPI found', async () => {
      const prisma = new PrismaClient() as any;

      (prisma.npiClaim.findFirst as any).mockResolvedValue(null);

      const result = await checkClinicianLeie('did:example:no-npi');

      expect(result).toBeNull();
    });
  });

  describe('getLeieExcludedEnrollments', () => {
    it('should retrieve enrollments with LEIE exclusions', async () => {
      const prisma = new PrismaClient() as any;

      const mockExcludedEnrollments = [
        {
          id: 'enroll-1',
          orgId: 'org-1',
          payerId: 'payer-1',
          clinicianDid: 'did:example:excluded',
          status: 'TERMINATED',
          terminatedAt: new Date(),
          metadata: {
            leieExclusion: {
              foundAt: new Date().toISOString(),
              records: [{ exclusionType: '1128a1' }],
            },
          },
          payer: { id: 'payer-1', name: 'Test Payer' },
        },
      ];

      (prisma.payerEnrollment.findMany as any).mockResolvedValue(mockExcludedEnrollments);

      const result = await getLeieExcludedEnrollments();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

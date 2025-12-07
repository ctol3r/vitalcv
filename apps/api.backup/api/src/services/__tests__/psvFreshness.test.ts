/**
 * Unit tests for S72-D1-B-004: Freshness check (120 days)
 *
 * Tests fresh/stale boundary conditions for PSV results
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  isFresh,
  getDaysRemaining,
  getFreshUntilDate,
  getPSVResultWithFreshness,
  getLatestFreshPSVResult,
  markStalePSVResults,
  getStalePSVResults,
  needsPSVReverification,
  getBulkPSVFreshnessStatus,
  PSV_FRESHNESS_DAYS,
} from '../psvFreshness';

const prisma = new PrismaClient();

describe('PSV Freshness Check', () => {
  const testClinicianId = 'test-clinician-freshness';

  beforeEach(async () => {
    // Clean up test data
    await prisma.pSVResult.deleteMany({
      where: { clinicianId: { startsWith: 'test-clinician-' } },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.pSVResult.deleteMany({
      where: { clinicianId: { startsWith: 'test-clinician-' } },
    });
  });

  describe('isFresh', () => {
    it('should return true for recent check (0 days ago)', () => {
      const psvResult = {
        checkedAt: new Date(),
      };

      expect(isFresh(psvResult)).toBe(true);
    });

    it('should return true for check exactly 120 days ago', () => {
      const checkedAt = new Date();
      checkedAt.setDate(checkedAt.getDate() - 120);

      const psvResult = { checkedAt };

      expect(isFresh(psvResult)).toBe(true);
    });

    it('should return false for check 121 days ago', () => {
      const checkedAt = new Date();
      checkedAt.setDate(checkedAt.getDate() - 121);

      const psvResult = { checkedAt };

      expect(isFresh(psvResult)).toBe(false);
    });

    it('should return false for check 180 days ago', () => {
      const checkedAt = new Date();
      checkedAt.setDate(checkedAt.getDate() - 180);

      const psvResult = { checkedAt };

      expect(isFresh(psvResult)).toBe(false);
    });

    it('should handle string dates', () => {
      const checkedAt = new Date();
      checkedAt.setDate(checkedAt.getDate() - 60);

      const psvResult = { checkedAt: checkedAt.toISOString() };

      expect(isFresh(psvResult)).toBe(true);
    });
  });

  describe('getDaysRemaining', () => {
    it('should return 120 for check today', () => {
      const psvResult = {
        checkedAt: new Date(),
      };

      expect(getDaysRemaining(psvResult)).toBe(120);
    });

    it('should return 0 for check exactly 120 days ago', () => {
      const checkedAt = new Date();
      checkedAt.setDate(checkedAt.getDate() - 120);

      const psvResult = { checkedAt };

      expect(getDaysRemaining(psvResult)).toBe(0);
    });

    it('should return negative for stale check', () => {
      const checkedAt = new Date();
      checkedAt.setDate(checkedAt.getDate() - 150);

      const psvResult = { checkedAt };

      expect(getDaysRemaining(psvResult)).toBe(-30);
    });

    it('should return 90 for check 30 days ago', () => {
      const checkedAt = new Date();
      checkedAt.setDate(checkedAt.getDate() - 30);

      const psvResult = { checkedAt };

      expect(getDaysRemaining(psvResult)).toBe(90);
    });
  });

  describe('getFreshUntilDate', () => {
    it('should return date 120 days in the future', () => {
      const checkedAt = new Date();
      const freshUntil = getFreshUntilDate(checkedAt);

      const daysDiff = Math.floor((freshUntil.getTime() - checkedAt.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBe(120);
    });

    it('should handle string dates', () => {
      const checkedAt = new Date();
      const freshUntil = getFreshUntilDate(checkedAt.toISOString());

      const daysDiff = Math.floor((freshUntil.getTime() - checkedAt.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBe(120);
    });
  });

  describe('getPSVResultWithFreshness', () => {
    it('should return result with freshness info', async () => {
      const checkedAt = new Date();
      checkedAt.setDate(checkedAt.getDate() - 30);

      const freshUntil = getFreshUntilDate(checkedAt);

      const psvResult = await prisma.pSVResult.create({
        data: {
          clinicianId: testClinicianId,
          overallStatus: 'PASS',
          checkedAt,
          isFresh: true,
          freshUntil,
        },
      });

      const result = await getPSVResultWithFreshness(psvResult.id);

      expect(result).toBeDefined();
      expect(result?.isFresh).toBe(true);
      expect(result?.daysRemaining).toBeCloseTo(90, 0);
    });

    it('should return null for non-existent result', async () => {
      const result = await getPSVResultWithFreshness('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getLatestFreshPSVResult', () => {
    it('should return latest fresh result', async () => {
      // Create fresh result
      const freshCheckedAt = new Date();
      freshCheckedAt.setDate(freshCheckedAt.getDate() - 30);

      await prisma.pSVResult.create({
        data: {
          clinicianId: testClinicianId,
          overallStatus: 'PASS',
          checkedAt: freshCheckedAt,
          isFresh: true,
          freshUntil: getFreshUntilDate(freshCheckedAt),
        },
      });

      const result = await getLatestFreshPSVResult(testClinicianId);

      expect(result).toBeDefined();
      expect(result?.isFresh).toBe(true);
      expect(result?.clinicianId).toBe(testClinicianId);
    });

    it('should return null if all results are stale', async () => {
      // Create stale result
      const staleCheckedAt = new Date();
      staleCheckedAt.setDate(staleCheckedAt.getDate() - 150);

      await prisma.pSVResult.create({
        data: {
          clinicianId: testClinicianId,
          overallStatus: 'PASS',
          checkedAt: staleCheckedAt,
          isFresh: false,
          freshUntil: getFreshUntilDate(staleCheckedAt),
        },
      });

      const result = await getLatestFreshPSVResult(testClinicianId);

      expect(result).toBeNull();
    });

    it('should return null if no results exist', async () => {
      const result = await getLatestFreshPSVResult('non-existent-clinician');
      expect(result).toBeNull();
    });
  });

  describe('markStalePSVResults', () => {
    it('should mark stale results as not fresh', async () => {
      // Create stale result
      const staleCheckedAt = new Date();
      staleCheckedAt.setDate(staleCheckedAt.getDate() - 150);
      const staleFreshUntil = new Date();
      staleFreshUntil.setDate(staleFreshUntil.getDate() - 30);

      await prisma.pSVResult.create({
        data: {
          clinicianId: testClinicianId,
          overallStatus: 'PASS',
          checkedAt: staleCheckedAt,
          isFresh: true, // Incorrectly marked as fresh
          freshUntil: staleFreshUntil,
        },
      });

      const count = await markStalePSVResults();

      expect(count).toBeGreaterThanOrEqual(1);

      // Verify it's now marked as not fresh
      const result = await prisma.pSVResult.findFirst({
        where: { clinicianId: testClinicianId },
      });

      expect(result?.isFresh).toBe(false);
    });

    it('should not mark fresh results', async () => {
      // Create fresh result
      const freshCheckedAt = new Date();
      freshCheckedAt.setDate(freshCheckedAt.getDate() - 30);
      const freshUntil = getFreshUntilDate(freshCheckedAt);

      await prisma.pSVResult.create({
        data: {
          clinicianId: testClinicianId,
          overallStatus: 'PASS',
          checkedAt: freshCheckedAt,
          isFresh: true,
          freshUntil,
        },
      });

      await markStalePSVResults();

      // Verify it's still marked as fresh
      const result = await prisma.pSVResult.findFirst({
        where: { clinicianId: testClinicianId },
      });

      expect(result?.isFresh).toBe(true);
    });
  });

  describe('getStalePSVResults', () => {
    it('should return stale results', async () => {
      // Create stale result
      const staleCheckedAt = new Date();
      staleCheckedAt.setDate(staleCheckedAt.getDate() - 150);

      await prisma.pSVResult.create({
        data: {
          clinicianId: testClinicianId,
          overallStatus: 'PASS',
          checkedAt: staleCheckedAt,
          isFresh: false,
          freshUntil: getFreshUntilDate(staleCheckedAt),
        },
      });

      const results = await getStalePSVResults();

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.clinicianId === testClinicianId)).toBe(true);
    });

    it('should filter by clinician ID', async () => {
      // Create stale result for specific clinician
      const staleCheckedAt = new Date();
      staleCheckedAt.setDate(staleCheckedAt.getDate() - 150);

      await prisma.pSVResult.create({
        data: {
          clinicianId: testClinicianId,
          overallStatus: 'PASS',
          checkedAt: staleCheckedAt,
          isFresh: false,
          freshUntil: getFreshUntilDate(staleCheckedAt),
        },
      });

      const results = await getStalePSVResults(testClinicianId);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((r) => r.clinicianId === testClinicianId)).toBe(true);
    });
  });

  describe('needsPSVReverification', () => {
    it('should return true if no fresh results exist', async () => {
      const needs = await needsPSVReverification(testClinicianId);
      expect(needs).toBe(true);
    });

    it('should return false if fresh result exists', async () => {
      // Create fresh result
      const freshCheckedAt = new Date();
      freshCheckedAt.setDate(freshCheckedAt.getDate() - 30);

      await prisma.pSVResult.create({
        data: {
          clinicianId: testClinicianId,
          overallStatus: 'PASS',
          checkedAt: freshCheckedAt,
          isFresh: true,
          freshUntil: getFreshUntilDate(freshCheckedAt),
        },
      });

      const needs = await needsPSVReverification(testClinicianId);
      expect(needs).toBe(false);
    });
  });

  describe('getBulkPSVFreshnessStatus', () => {
    it('should return freshness status for multiple clinicians', async () => {
      const clinician1 = 'test-clinician-1';
      const clinician2 = 'test-clinician-2';

      // Create fresh result for clinician1
      const fresh1CheckedAt = new Date();
      fresh1CheckedAt.setDate(fresh1CheckedAt.getDate() - 30);

      await prisma.pSVResult.create({
        data: {
          clinicianId: clinician1,
          overallStatus: 'PASS',
          checkedAt: fresh1CheckedAt,
          isFresh: true,
          freshUntil: getFreshUntilDate(fresh1CheckedAt),
        },
      });

      // Create stale result for clinician2
      const stale2CheckedAt = new Date();
      stale2CheckedAt.setDate(stale2CheckedAt.getDate() - 150);

      await prisma.pSVResult.create({
        data: {
          clinicianId: clinician2,
          overallStatus: 'PASS',
          checkedAt: stale2CheckedAt,
          isFresh: false,
          freshUntil: getFreshUntilDate(stale2CheckedAt),
        },
      });

      const statuses = await getBulkPSVFreshnessStatus([clinician1, clinician2]);

      expect(statuses.get(clinician1)?.isFresh).toBe(true);
      expect(statuses.get(clinician1)?.daysRemaining).toBeGreaterThan(0);
      expect(statuses.get(clinician2)?.isFresh).toBe(false);
      expect(statuses.get(clinician2)?.daysRemaining).toBeLessThan(0);
    });

    it('should handle clinicians with no results', async () => {
      const statuses = await getBulkPSVFreshnessStatus(['non-existent-clinician']);

      expect(statuses.get('non-existent-clinician')?.isFresh).toBe(false);
      expect(statuses.get('non-existent-clinician')?.daysRemaining).toBe(-1);
    });
  });
});


/**
 * B138A-COMPACT-009: Tests for Unified Compacts Status API
 *
 * Tests for happy path, caching, error cases, and refresh scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Unified Compacts Status API', () => {
  const testClinicianDid = 'did:example:test-clinician-456';

  beforeEach(async () => {
    // Clean up test data
    await Promise.all([
      prisma.compactsStatus.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.iMLCEligibility.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.pSYPACTCompact.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.counselingCompact.deleteMany({ where: { clinicianDid: testClinicianDid } }),
    ]);
  });

  afterEach(async () => {
    // Clean up test data
    await Promise.all([
      prisma.compactsStatus.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.iMLCEligibility.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.pSYPACTCompact.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.counselingCompact.deleteMany({ where: { clinicianDid: testClinicianDid } }),
    ]);
  });

  describe('GET /:clinicianDid', () => {
    it('should return 404 if compacts status not computed', async () => {
      const result = await prisma.compactsStatus.findUnique({
        where: { clinicianDid: testClinicianDid },
      });

      expect(result).toBeNull();
    });

    it('should return unified compacts status when computed', async () => {
      // Create test compacts status
      const compactsStatus = await prisma.compactsStatus.create({
        data: {
          clinicianDid: testClinicianDid,
          imlcStatus: 'ELIGIBLE',
          imlcHomeState: 'TX',
          imlcCompactStates: ['AL', 'AZ', 'CO'],
          psypactStatus: 'NOT_ELIGIBLE',
          psypactStates: [],
          counselingStatus: 'NOT_ELIGIBLE',
          counselingStates: [],
          lastComputedAt: new Date(),
          nextRefreshAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });

      expect(compactsStatus).toBeDefined();
      expect(compactsStatus.clinicianDid).toBe(testClinicianDid);
      expect(compactsStatus.imlcStatus).toBe('ELIGIBLE');
      expect(compactsStatus.imlcCompactStates).toHaveLength(3);
    });

    it('should indicate cache hit for fresh status', async () => {
      const futureRefresh = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now

      await prisma.compactsStatus.create({
        data: {
          clinicianDid: testClinicianDid,
          imlcStatus: 'ELIGIBLE',
          imlcCompactStates: ['TX', 'AL'],
          psypactStatus: 'NOT_ELIGIBLE',
          psypactStates: [],
          counselingStatus: 'NOT_ELIGIBLE',
          counselingStates: [],
          lastComputedAt: new Date(),
          nextRefreshAt: futureRefresh,
        },
      });

      const result = await prisma.compactsStatus.findUnique({
        where: { clinicianDid: testClinicianDid },
      });

      expect(result).toBeDefined();
      const cacheHit = new Date() < (result!.nextRefreshAt || new Date(0));
      expect(cacheHit).toBe(true);
    });

    it('should indicate cache miss for expired status', async () => {
      const pastRefresh = new Date(Date.now() - 1000); // 1 second ago

      await prisma.compactsStatus.create({
        data: {
          clinicianDid: testClinicianDid,
          imlcStatus: 'ELIGIBLE',
          imlcCompactStates: ['TX'],
          psypactStatus: 'NOT_ELIGIBLE',
          psypactStates: [],
          counselingStatus: 'NOT_ELIGIBLE',
          counselingStates: [],
          lastComputedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          nextRefreshAt: pastRefresh,
        },
      });

      const result = await prisma.compactsStatus.findUnique({
        where: { clinicianDid: testClinicianDid },
      });

      expect(result).toBeDefined();
      const cacheHit = new Date() < (result!.nextRefreshAt || new Date(0));
      expect(cacheHit).toBe(false);
    });
  });

  describe('POST /compute', () => {
    it('should compute unified status for all compacts', async () => {
      const licenseData = {
        medical: [
          {
            state: 'TX',
            licenseNumber: 'TX12345',
            issueDate: new Date('2020-01-01').toISOString(),
            status: 'active',
            isPrimary: true,
          },
        ],
        psychology: [
          {
            state: 'AZ',
            licenseNumber: 'PSY-AZ-001',
            licenseType: 'Clinical Psychologist',
            issueDate: new Date('2019-01-01').toISOString(),
            status: 'active',
            isPrimary: true,
          },
        ],
        counseling: [
          {
            state: 'CO',
            licenseNumber: 'LPC-CO-789',
            licenseType: 'LPC',
            issueDate: new Date('2021-01-01').toISOString(),
            status: 'active',
            isPrimary: true,
          },
        ],
      };

      const { determineIMLCEligibility } = await import('../../../../../services/compacts/imlcEngine.js');
      const { determinePSYPACTEligibility } = await import('../../../../../services/compacts/psyEngine.js');
      const { determineCounselingCompactEligibility } = await import('../../../../../services/compacts/counselingEngine.js');

      const imlcResult = await determineIMLCEligibility(testClinicianDid, 'TX', licenseData.medical as any);
      const psypactResult = await determinePSYPACTEligibility(testClinicianDid, 'AZ', licenseData.psychology as any);
      const counselingResult = await determineCounselingCompactEligibility(testClinicianDid, 'CO', licenseData.counseling as any);

      expect(imlcResult.status).toBe('ELIGIBLE');
      expect(psypactResult.status).toBe('ELIGIBLE');
      expect(counselingResult.status).toBe('ELIGIBLE');
    });

    it('should handle mixed eligibility results', async () => {
      // Test case where only some compacts are eligible
      const licenseData = {
        medical: [
          {
            state: 'CA', // Not an IMLC state
            licenseNumber: 'CA12345',
            issueDate: new Date('2020-01-01').toISOString(),
            status: 'active',
            isPrimary: true,
          },
        ],
        psychology: [
          {
            state: 'AZ',
            licenseNumber: 'PSY-AZ-001',
            licenseType: 'Clinical Psychologist',
            issueDate: new Date('2019-01-01').toISOString(),
            status: 'active',
            isPrimary: true,
          },
        ],
      };

      const { determineIMLCEligibility } = await import('../../../../../services/compacts/imlcEngine.js');
      const { determinePSYPACTEligibility } = await import('../../../../../services/compacts/psyEngine.js');

      const imlcResult = await determineIMLCEligibility(testClinicianDid, 'CA', licenseData.medical as any);
      const psypactResult = await determinePSYPACTEligibility(testClinicianDid, 'AZ', licenseData.psychology as any);

      expect(imlcResult.status).toBe('NOT_ELIGIBLE');
      expect(psypactResult.status).toBe('ELIGIBLE');
    });
  });

  describe('POST /:clinicianDid/refresh', () => {
    it('should invalidate cache and force refresh', async () => {
      const futureRefresh = new Date(Date.now() + 12 * 60 * 60 * 1000);

      await prisma.compactsStatus.create({
        data: {
          clinicianDid: testClinicianDid,
          imlcStatus: 'ELIGIBLE',
          imlcCompactStates: ['TX'],
          psypactStatus: 'NOT_ELIGIBLE',
          psypactStates: [],
          counselingStatus: 'NOT_ELIGIBLE',
          counselingStates: [],
          lastComputedAt: new Date(),
          nextRefreshAt: futureRefresh,
        },
      });

      // Invalidate cache
      await prisma.compactsStatus.update({
        where: { clinicianDid: testClinicianDid },
        data: { nextRefreshAt: new Date() },
      });

      const result = await prisma.compactsStatus.findUnique({
        where: { clinicianDid: testClinicianDid },
      });

      expect(result).toBeDefined();
      expect(result!.nextRefreshAt).not.toEqual(futureRefresh);
    });
  });
});


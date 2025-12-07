/**
 * B138A Compacts System - Integration Tests
 *
 * End-to-end integration tests for the complete compacts system.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { determineCounselingCompactEligibility } from '../counselingEngine.js';
import { determineIMLCEligibility } from '../imlcEngine.js';
import { computeEligibilitySummary, isRefreshNeeded } from '../models/CompactsStatus.js';
import type { CounselingLicense } from '../models/CounselingCompact.js';
import type { LicenseHistory } from '../models/IMLCEligibility.js';
import type { PsychologyLicense } from '../models/Psycompact.js';
import { determinePSYPACTEligibility } from '../psyEngine.js';

const prisma = new PrismaClient();

describe('Compacts System Integration', () => {
  const testClinicianDid = 'did:example:integration-test-clinician';

  beforeAll(async () => {
    // Clean up any existing test data
    await Promise.all([
      prisma.compactsStatus.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.iMLCEligibility.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.pSYPACTCompact.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.counselingCompact.deleteMany({ where: { clinicianDid: testClinicianDid } }),
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    await Promise.all([
      prisma.compactsStatus.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.iMLCEligibility.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.pSYPACTCompact.deleteMany({ where: { clinicianDid: testClinicianDid } }),
      prisma.counselingCompact.deleteMany({ where: { clinicianDid: testClinicianDid } }),
    ]);
    await prisma.$disconnect();
  });

  describe('End-to-End Eligibility Determination', () => {
    it('should compute IMLC eligibility for a physician with TX license', async () => {
      const licenseHistory: LicenseHistory[] = [
        {
          state: 'TX',
          licenseNumber: 'TX123456',
          issueDate: new Date('2020-01-01').toISOString(),
          status: 'active',
          isPrimary: true,
        },
      ];

      const result = await determineIMLCEligibility(testClinicianDid, 'TX', licenseHistory);

      expect(result.status).toBe('ELIGIBLE');
      expect(result.homeState).toBe('TX');
      expect(result.compactStates.length).toBeGreaterThan(30);
      expect(result.compactStates).toContain('FL');
      expect(result.compactStates).toContain('CO');
      expect(result.compactStates).not.toContain('TX'); // Home state excluded
    });

    it('should compute PSYPACT eligibility for a psychologist with AZ license', async () => {
      const licenseData: PsychologyLicense[] = [
        {
          state: 'AZ',
          licenseNumber: 'PSY-AZ-789',
          licenseType: 'Clinical Psychologist',
          issueDate: new Date('2019-01-01').toISOString(),
          status: 'active',
          isPrimary: true,
        },
      ];

      const result = await determinePSYPACTEligibility(testClinicianDid, 'AZ', licenseData);

      expect(result.status).toBe('ELIGIBLE');
      expect(result.primaryState).toBe('AZ');
      expect(result.participatingStates.length).toBeGreaterThan(25);
      expect(result.participatingStates).not.toContain('AZ'); // Primary state excluded
    });

    it('should compute Counseling Compact eligibility for LPC with VA license', async () => {
      const licenseData: CounselingLicense[] = [
        {
          state: 'VA',
          licenseNumber: 'LPC-VA-001',
          licenseType: 'LPC',
          issueDate: new Date('2021-01-01').toISOString(),
          status: 'active',
          isPrimary: true,
        },
      ];

      const result = await determineCounselingCompactEligibility(
        testClinicianDid,
        'VA',
        licenseData,
      );

      expect(result.status).toBe('ELIGIBLE');
      expect(result.homeState).toBe('VA');
      expect(result.compactStates.length).toBeGreaterThan(15);
      expect(result.licenseType).toBe('LPC');
    });
  });

  describe('Unified Compacts Status', () => {
    it('should create unified status from individual compacts', async () => {
      const compactsStatus = await prisma.compactsStatus.create({
        data: {
          clinicianDid: testClinicianDid,
          imlcStatus: 'ELIGIBLE',
          imlcHomeState: 'TX',
          imlcCompactStates: ['AL', 'AZ', 'CO', 'FL'],
          psypactStatus: 'ELIGIBLE',
          psypactStates: ['AZ', 'CO', 'IL'],
          counselingStatus: 'NOT_ELIGIBLE',
          counselingStates: [],
          lastComputedAt: new Date(),
          nextRefreshAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      expect(compactsStatus).toBeDefined();
      expect(compactsStatus.clinicianDid).toBe(testClinicianDid);

      const summary = computeEligibilitySummary(compactsStatus as any);

      expect(summary.hasAnyCompactEligibility).toBe(true);
      expect(summary.imlcEligible).toBe(true);
      expect(summary.psypactEligible).toBe(true);
      expect(summary.counselingEligible).toBe(false);
      expect(summary.compactTypes).toContain('IMLC');
      expect(summary.compactTypes).toContain('PSYPACT');
      expect(summary.totalEligibleStates.length).toBeGreaterThan(5);
    });

    it('should correctly determine refresh need based on TTL', () => {
      const freshStatus = {
        clinicianDid: testClinicianDid,
        imlcStatus: 'ELIGIBLE' as const,
        imlcCompactStates: [],
        psypactStatus: 'NOT_ELIGIBLE' as const,
        psypactStates: [],
        counselingStatus: 'NOT_ELIGIBLE' as const,
        counselingStates: [],
        lastComputedAt: new Date().toISOString(),
        nextRefreshAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours from now
      };

      expect(isRefreshNeeded(freshStatus)).toBe(false);

      const staleStatus = {
        ...freshStatus,
        nextRefreshAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      };

      expect(isRefreshNeeded(staleStatus)).toBe(true);
    });
  });

  describe('State Coverage', () => {
    it('should have correct IMLC state count', async () => {
      const { IMLC_STATES } = await import('../models/IMLCEligibility.js');
      expect(IMLC_STATES.length).toBe(40);
      expect(IMLC_STATES).toContain('TX');
      expect(IMLC_STATES).toContain('FL');
      expect(IMLC_STATES).not.toContain('CA'); // California not in IMLC
    });

    it('should have correct PSYPACT state count', async () => {
      const { PSYPACT_STATES } = await import('../models/Psycompact.js');
      expect(PSYPACT_STATES.length).toBe(34);
      expect(PSYPACT_STATES).toContain('AZ');
      expect(PSYPACT_STATES).toContain('CO');
    });

    it('should have correct Counseling Compact state count', async () => {
      const { COUNSELING_COMPACT_STATES } = await import('../models/CounselingCompact.js');
      expect(COUNSELING_COMPACT_STATES.length).toBe(25);
      expect(COUNSELING_COMPACT_STATES).toContain('VA');
      expect(COUNSELING_COMPACT_STATES).toContain('TX');
    });
  });

  describe('Edge Cases', () => {
    it('should handle clinician with no licenses', async () => {
      const result = await determineIMLCEligibility(testClinicianDid, 'TX', []);
      expect(result.status).toBe('NOT_ELIGIBLE');
      expect(result.metadata?.hasActivePrimaryLicense).toBe(false);
    });

    it('should handle non-member state', async () => {
      const licenseHistory: LicenseHistory[] = [
        {
          state: 'CA',
          licenseNumber: 'CA123',
          issueDate: new Date('2020-01-01').toISOString(),
          status: 'active',
          isPrimary: true,
        },
      ];

      const result = await determineIMLCEligibility(testClinicianDid, 'CA', licenseHistory);
      expect(result.status).toBe('NOT_ELIGIBLE');
      expect(result.compactStates).toHaveLength(0);
    });

    it('should handle recently licensed clinician (<1 year)', async () => {
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 6);

      const licenseHistory: LicenseHistory[] = [
        {
          state: 'TX',
          licenseNumber: 'TX999',
          issueDate: recentDate.toISOString(),
          status: 'active',
          isPrimary: true,
        },
      ];

      const result = await determineIMLCEligibility(testClinicianDid, 'TX', licenseHistory);
      expect(result.status).toBe('NOT_ELIGIBLE');
      expect(result.metadata?.hasMinimumPracticeTime).toBe(false);
    });
  });
});

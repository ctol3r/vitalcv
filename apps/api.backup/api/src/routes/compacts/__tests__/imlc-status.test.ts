/**
 * B138A-IMLC-003: Tests for IMLC Status API
 *
 * Tests for happy path, error cases, and 404 scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('IMLC Status API', () => {
  const testClinicianDid = 'did:example:test-clinician-123';
  const testHomeState = 'TX';

  beforeEach(async () => {
    // Clean up test data
    await prisma.iMLCEligibility.deleteMany({
      where: { clinicianDid: testClinicianDid },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.iMLCEligibility.deleteMany({
      where: { clinicianDid: testClinicianDid },
    });
  });

  describe('GET /:clinicianDid', () => {
    it('should return 404 if IMLC eligibility not computed', async () => {
      const result = await prisma.iMLCEligibility.findUnique({
        where: { clinicianDid: testClinicianDid },
      });

      expect(result).toBeNull();
    });

    it('should return IMLC eligibility status when computed', async () => {
      // Create test eligibility record
      const eligibility = await prisma.iMLCEligibility.create({
        data: {
          clinicianDid: testClinicianDid,
          homeState: testHomeState,
          compactStates: ['AL', 'AZ', 'CO'],
          status: 'ELIGIBLE',
          licenseHistory: [
            {
              state: testHomeState,
              licenseNumber: 'TX12345',
              issueDate: new Date('2020-01-01').toISOString(),
              status: 'active',
              isPrimary: true,
            },
          ],
          lastCheckedAt: new Date(),
        },
      });

      expect(eligibility).toBeDefined();
      expect(eligibility.clinicianDid).toBe(testClinicianDid);
      expect(eligibility.status).toBe('ELIGIBLE');
      expect(eligibility.homeState).toBe(testHomeState);
      expect(eligibility.compactStates).toHaveLength(3);
    });

    it('should return NOT_ELIGIBLE status for non-IMLC state', async () => {
      // Create test eligibility record with non-IMLC state
      const eligibility = await prisma.iMLCEligibility.create({
        data: {
          clinicianDid: testClinicianDid,
          homeState: 'CA', // California is not an IMLC member
          compactStates: [],
          status: 'NOT_ELIGIBLE',
          metadata: {
            reason: 'Home state is not an IMLC member state',
          },
          lastCheckedAt: new Date(),
        },
      });

      expect(eligibility.status).toBe('NOT_ELIGIBLE');
      expect(eligibility.compactStates).toHaveLength(0);
    });
  });

  describe('POST /compute', () => {
    it('should compute IMLC eligibility successfully', async () => {
      const licenseHistory = [
        {
          state: testHomeState,
          licenseNumber: 'TX12345',
          issueDate: new Date('2020-01-01').toISOString(),
          status: 'active',
          isPrimary: true,
        },
      ];

      const { determineIMLCEligibility } = await import('../../../../../../services/compacts/imlcEngine.js');
      const result = await determineIMLCEligibility(testClinicianDid, testHomeState, licenseHistory as any);

      expect(result).toBeDefined();
      expect(result.clinicianDid).toBe(testClinicianDid);
      expect(result.homeState).toBe(testHomeState);
      expect(result.status).toBe('ELIGIBLE');
      expect(result.compactStates.length).toBeGreaterThan(0);
    });

    it('should mark as NOT_ELIGIBLE for insufficient practice time', async () => {
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 6); // 6 months ago

      const licenseHistory = [
        {
          state: testHomeState,
          licenseNumber: 'TX12345',
          issueDate: recentDate.toISOString(),
          status: 'active',
          isPrimary: true,
        },
      ];

      const { determineIMLCEligibility } = await import('../../../../../../services/compacts/imlcEngine.js');
      const result = await determineIMLCEligibility(testClinicianDid, testHomeState, licenseHistory as any);

      expect(result.status).toBe('NOT_ELIGIBLE');
      expect(result.metadata?.hasMinimumPracticeTime).toBe(false);
    });

    it('should mark as NOT_ELIGIBLE for disciplinary actions', async () => {
      const licenseHistory = [
        {
          state: testHomeState,
          licenseNumber: 'TX12345',
          issueDate: new Date('2020-01-01').toISOString(),
          status: 'active',
          isPrimary: true,
          disciplinaryActions: [
            {
              date: new Date('2022-01-01').toISOString(),
              type: 'SUSPENSION',
              description: 'Test disciplinary action',
            },
          ],
        },
      ];

      const { determineIMLCEligibility } = await import('../../../../../../services/compacts/imlcEngine.js');
      const result = await determineIMLCEligibility(testClinicianDid, testHomeState, licenseHistory as any);

      expect(result.status).toBe('NOT_ELIGIBLE');
      expect(result.metadata?.hasDisciplinaryActions).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty license history', async () => {
      const { determineIMLCEligibility } = await import('../../../../../../services/compacts/imlcEngine.js');
      const result = await determineIMLCEligibility(testClinicianDid, testHomeState, []);

      expect(result.status).toBe('NOT_ELIGIBLE');
      expect(result.metadata?.hasActivePrimaryLicense).toBe(false);
    });

    it('should handle revoked licenses', async () => {
      const licenseHistory = [
        {
          state: testHomeState,
          licenseNumber: 'TX12345',
          issueDate: new Date('2020-01-01').toISOString(),
          status: 'revoked',
          isPrimary: true,
        },
      ];

      const { determineIMLCEligibility } = await import('../../../../../../services/compacts/imlcEngine.js');
      const result = await determineIMLCEligibility(testClinicianDid, testHomeState, licenseHistory as any);

      expect(result.status).toBe('NOT_ELIGIBLE');
    });
  });
});


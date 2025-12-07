/**
 * Unit tests for S72-D1-B-003: PSV orchestrator service
 *
 * Tests orchestration of license and sanctions checks
 * with mock clinician data
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { runPSV, getPSVResult, getPSVResultsForClinician, enqueuePSVRun, PSVOrchestratorInput } from '../../../../services/psv/psvOrchestrator.js';

jest.mock('../../../../services/queue/producer.js', () => ({
  enqueueJob: jest.fn().mockResolvedValue('job-test'),
}));

const prisma = new PrismaClient();

describe('PSV Orchestrator Service', () => {
  const testClinicianId = 'test-clinician-123';

  beforeEach(async () => {
    // Clean up test data
    await prisma.pSVResult.deleteMany({
      where: { clinicianId: testClinicianId },
    });
    await prisma.pSVLicenseCheck.deleteMany({
      where: { npi: { in: ['1234567890', '0987654321', '6666666666'] } },
    });
    await prisma.pSVSanctionsCheck.deleteMany({
      where: { npi: { in: ['1234567890', '0987654321', '6666666666'] } },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.pSVResult.deleteMany({
      where: { clinicianId: testClinicianId },
    });
    await prisma.pSVLicenseCheck.deleteMany({
      where: { npi: { in: ['1234567890', '0987654321', '6666666666'] } },
    });
    await prisma.pSVSanctionsCheck.deleteMany({
      where: { npi: { in: ['1234567890', '0987654321', '6666666666'] } },
    });
  });

  describe('runPSV', () => {
    it('should return PASS for active license and no sanctions', async () => {
      const result = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      expect(result.overallStatus).toBe('PASS');
      expect(result.clinicianId).toBe(testClinicianId);
      expect(result.npi).toBe('1234567890');
      expect(result.licenseCheck.status).toBe('ACTIVE');
      expect(result.sanctionsCheck.sanctioned).toBe(false);
      expect(result.isFresh).toBe(true);
      expect(result.summary).toContain('All PSV checks passed');
    });

    it('should return FAIL for inactive license', async () => {
      const result = await runPSV({
        clinicianId: testClinicianId,
        npi: '0987654321',
        state: 'NY',
        licenseNumber: '789012',
      });

      expect(result.overallStatus).toBe('FAIL');
      expect(result.licenseCheck.status).toBe('INACTIVE');
      expect(result.sanctionsCheck.sanctioned).toBe(false);
      expect(result.summary).toContain('License status: INACTIVE');
    });

    it('should return FAIL for sanctioned provider', async () => {
      const result = await runPSV({
        clinicianId: testClinicianId,
        npi: '6666666666',
        state: 'CA',
        licenseNumber: '123456',
      });

      expect(result.overallStatus).toBe('FAIL');
      expect(result.sanctionsCheck.sanctioned).toBe(true);
      expect(result.summary).toContain('OIG exclusion list');
    });

    it('should set freshness to 120 days from now', async () => {
      const result = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const checkedAt = new Date(result.checkedAt);
      const freshUntil = new Date(result.freshUntil);
      const daysDiff = Math.floor((freshUntil.getTime() - checkedAt.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBe(120);
      expect(result.isFresh).toBe(true);
    });

    it('should store PSV result in database', async () => {
      const result = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const stored = await prisma.pSVResult.findUnique({
        where: { id: result.psvResultId },
      });

      expect(stored).toBeDefined();
      expect(stored?.clinicianId).toBe(testClinicianId);
      expect(stored?.overallStatus).toBe('PASS');
    });

    it('should create license check record', async () => {
      const result = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const licenseCheck = await prisma.pSVLicenseCheck.findUnique({
        where: { id: result.licenseCheck.checkId },
      });

      expect(licenseCheck).toBeDefined();
      expect(licenseCheck?.npi).toBe('1234567890');
      expect(licenseCheck?.status).toBe('ACTIVE');
    });

    it('should create sanctions check record', async () => {
      const result = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const sanctionsCheck = await prisma.pSVSanctionsCheck.findUnique({
        where: { id: result.sanctionsCheck.checkId },
      });

      expect(sanctionsCheck).toBeDefined();
      expect(sanctionsCheck?.npi).toBe('1234567890');
      expect(sanctionsCheck?.sanctioned).toBe(false);
    });

    it('should include source URLs', async () => {
      const result = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      expect(result.licenseCheck.sourceUrl).toContain('stateboard.ca.gov');
      expect(result.sanctionsCheck.sourceUrl).toContain('oig.hhs.gov');
    });
  });

  describe('getPSVResult', () => {
    it('should retrieve PSV result by ID', async () => {
      const created = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const retrieved = await getPSVResult(created.psvResultId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.psvResultId).toBe(created.psvResultId);
      expect(retrieved?.overallStatus).toBe('PASS');
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await getPSVResult('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getPSVResultsForClinician', () => {
    it('should retrieve all PSV results for a clinician', async () => {
      // Create multiple PSV results
      await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      await runPSV({
        clinicianId: testClinicianId,
        npi: '0987654321',
        state: 'NY',
        licenseNumber: '789012',
      });

      const results = await getPSVResultsForClinician(testClinicianId);

      expect(results).toHaveLength(2);
      expect(results[0].clinicianId).toBe(testClinicianId);
      expect(results[1].clinicianId).toBe(testClinicianId);
    });

    it('should return results in reverse chronological order', async () => {
      const first = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 100));

      const second = await runPSV({
        clinicianId: testClinicianId,
        npi: '0987654321',
        state: 'NY',
        licenseNumber: '789012',
      });

      const results = await getPSVResultsForClinician(testClinicianId);

      expect(results[0].psvResultId).toBe(second.psvResultId);
      expect(results[1].psvResultId).toBe(first.psvResultId);
    });

    it('should return empty array for clinician with no results', async () => {
      const results = await getPSVResultsForClinician('non-existent-clinician');
      expect(results).toEqual([]);
    });
  });
});


describe('enqueuePSVRun', () => {
  it('enqueues PSV job payload via queue producer', async () => {
    const payload = {
      clinicianId: 'queue-clinician-1',
      npi: '5555555555',
      state: 'CA',
      licenseNumber: 'CA-QUEUE-1234',
    } satisfies PSVOrchestratorInput;

    const { enqueueJob } = require('../../../../services/queue/producer.js') as {
      enqueueJob: jest.Mock;
    };

    enqueueJob.mockResolvedValueOnce('job-queue-001');

    const result = await enqueuePSVRun(payload);

    expect(enqueueJob).toHaveBeenCalledWith('PSV_RUN', payload);
    expect(result.jobId).toBe('job-queue-001');
  });
});

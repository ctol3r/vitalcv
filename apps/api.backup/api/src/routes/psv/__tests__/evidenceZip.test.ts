/**
 * Unit tests for S72-D1-B-006: ZIP exporter
 *
 * Tests ZIP structure with manifest.json and proof.txt
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { runPSV } from '../../../../../../services/psv/psvOrchestrator.js';
import { buildEvidenceBundle } from '../../../services/evidenceBundle';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Mock Express request/response
const mockRequest = (body: any = {}, params: any = {}) => ({
  body,
  params,
});

const mockResponse = () => {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  res.setHeader = (name: string, value: string) => {
    if (!res.headers) res.headers = {};
    res.headers[name] = value;
    return res;
  };
  return res;
};

describe('PSV Evidence ZIP Exporter', () => {
  const testClinicianId = 'test-clinician-zip';

  beforeEach(async () => {
    // Clean up test data
    await prisma.pSVEvidenceBundle.deleteMany({});
    await prisma.pSVResult.deleteMany({
      where: { clinicianId: testClinicianId },
    });
    await prisma.pSVLicenseCheck.deleteMany({
      where: { npi: '1234567890' },
    });
    await prisma.pSVSanctionsCheck.deleteMany({
      where: { npi: '1234567890' },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.pSVEvidenceBundle.deleteMany({});
    await prisma.pSVResult.deleteMany({
      where: { clinicianId: testClinicianId },
    });
    await prisma.pSVLicenseCheck.deleteMany({
      where: { npi: '1234567890' },
    });
    await prisma.pSVSanctionsCheck.deleteMany({
      where: { npi: '1234567890' },
    });
  });

  describe('GET /psv/evidence/:id/info', () => {
    it('should return evidence bundle information', async () => {
      // Create PSV result and evidence bundle
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);

      const evidenceZipRouter = (await import('../evidenceZip')).default;
      const handler = evidenceZipRouter.stack.find((s: any) => s.route?.path === '/:id/info')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({}, { id: bundle.bundleId });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.bundleId).toBe(bundle.bundleId);
      expect(res.jsonData.manifest).toBeDefined();
      expect(res.jsonData.manifest.clinicianId).toBe(testClinicianId);
    });

    it('should return 404 for non-existent bundle', async () => {
      const evidenceZipRouter = (await import('../evidenceZip')).default;
      const handler = evidenceZipRouter.stack.find((s: any) => s.route?.path === '/:id/info')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({}, { id: 'non-existent-id' });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData.error).toBe('not_found');
    });
  });

  describe('POST /psv/evidence/:id/regenerate', () => {
    it('should trigger ZIP regeneration', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);

      const evidenceZipRouter = (await import('../evidenceZip')).default;
      const handler = evidenceZipRouter.stack.find((s: any) => s.route?.path === '/:id/regenerate')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({}, { id: bundle.bundleId });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.message).toContain('regeneration');
    });

    it('should return 404 for non-existent bundle', async () => {
      const evidenceZipRouter = (await import('../evidenceZip')).default;
      const handler = evidenceZipRouter.stack.find((s: any) => s.route?.path === '/:id/regenerate')?.route
        ?.stack[0]?.handle;

      const req = mockRequest({}, { id: 'non-existent-id' });
      const res = mockResponse();

      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData.error).toBe('not_found');
    });
  });

  describe('Evidence Bundle Structure', () => {
    it('should create evidence bundle with required fields', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId, 'test-vc-id');

      expect(bundle.manifest.bundleId).toBeDefined();
      expect(bundle.manifest.clinicianId).toBe(testClinicianId);
      expect(bundle.manifest.vcId).toBe('test-vc-id');
      expect(bundle.manifest.psvResultId).toBe(psvResult.psvResultId);
      expect(bundle.manifest.timestamp).toBeDefined();
      expect(bundle.manifest.results.licenseCheck).toBeDefined();
      expect(bundle.manifest.results.sanctionsCheck).toBeDefined();
      expect(bundle.manifest.overallStatus).toBe('PASS');
      expect(bundle.manifest.sourceUrls).toHaveLength(2);
    });

    it('should include metadata fields', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);

      expect(bundle.manifest.metadata).toBeDefined();
      expect(bundle.manifest.metadata.ncqaCompliance).toBe('CR1-CR5');
      expect(bundle.manifest.metadata.freshnessStatus).toBe('FRESH');
      expect(bundle.manifest.metadata.generatedAt).toBeDefined();
    });

    it('should write manifest.json to temp directory', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);

      // Check manifest file exists
      expect(fs.existsSync(bundle.manifestPath)).toBe(true);

      // Read and parse manifest
      const manifestContent = fs.readFileSync(bundle.manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.clinicianId).toBe(testClinicianId);
      expect(manifest.results).toBeDefined();
    });
  });
});


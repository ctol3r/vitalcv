/**
 * Unit tests for S72-D1-B-007: Anchor stub service
 *
 * Tests hash computation and fake block height generation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  anchorEvidence,
  verifyAnchor,
  getAnchorInfo,
  batchAnchorEvidence,
  getAnchorStatistics,
  computeHash,
  isValidHashFormat,
} from '../anchorStub';
import { buildEvidenceBundle } from '../evidenceBundle';
import { runPSV } from '../../../../services/psv/psvOrchestrator.js';

const prisma = new PrismaClient();

describe('Anchor Stub Service', () => {
  const testClinicianId = 'test-clinician-anchor';

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

  describe('computeHash', () => {
    it('should compute SHA-256 hash of JSON data', () => {
      const data = { test: 'data', value: 123 };
      const hash = computeHash(data);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes for same data', () => {
      const data = { test: 'data', value: 123 };
      const hash1 = computeHash(data);
      const hash2 = computeHash(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', () => {
      const data1 = { test: 'data1' };
      const data2 = { test: 'data2' };

      const hash1 = computeHash(data1);
      const hash2 = computeHash(data2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isValidHashFormat', () => {
    it('should validate SHA-256 hash format', () => {
      const validHash = 'a'.repeat(64);
      expect(isValidHashFormat(validHash)).toBe(true);
    });

    it('should reject invalid hash lengths', () => {
      expect(isValidHashFormat('abc')).toBe(false);
      expect(isValidHashFormat('a'.repeat(63))).toBe(false);
      expect(isValidHashFormat('a'.repeat(65))).toBe(false);
    });

    it('should reject non-hex characters', () => {
      expect(isValidHashFormat('g'.repeat(64))).toBe(false);
      expect(isValidHashFormat('Z'.repeat(64))).toBe(false);
    });
  });

  describe('anchorEvidence', () => {
    it('should anchor evidence bundle with hash and block height', async () => {
      // Create PSV result and evidence bundle
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);

      // Anchor the bundle
      const anchorResult = await anchorEvidence(bundle.bundleId);

      expect(anchorResult.evidenceId).toBe(bundle.bundleId);
      expect(anchorResult.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(anchorResult.blockHeight).toBeGreaterThan(1000000);
      expect(anchorResult.blockHeight).toBeLessThan(10000000);
      expect(anchorResult.chainType).toBe('stub');
      expect(anchorResult.anchorId).toContain('anchor-');
    });

    it('should throw error for non-existent evidence bundle', async () => {
      await expect(anchorEvidence('non-existent-id')).rejects.toThrow();
    });

    it('should store anchor info in database', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);
      await anchorEvidence(bundle.bundleId);

      const stored = await prisma.pSVEvidenceBundle.findUnique({
        where: { id: bundle.bundleId },
      });

      expect(stored?.anchorHash).toBeDefined();
      expect(stored?.blockHeight).toBeDefined();
      expect(stored?.anchorId).toBeDefined();
    });
  });

  describe('verifyAnchor', () => {
    it('should verify anchor hash matches evidence bundle', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);
      await anchorEvidence(bundle.bundleId);

      const verified = await verifyAnchor(bundle.bundleId);

      expect(verified).toBe(true);
    });

    it('should throw error for non-existent evidence bundle', async () => {
      await expect(verifyAnchor('non-existent-id')).rejects.toThrow();
    });

    it('should throw error for unanchored evidence bundle', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);

      await expect(verifyAnchor(bundle.bundleId)).rejects.toThrow('not anchored');
    });
  });

  describe('getAnchorInfo', () => {
    it('should retrieve anchor information', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);
      const anchorResult = await anchorEvidence(bundle.bundleId);

      const info = await getAnchorInfo(bundle.bundleId);

      expect(info).toBeDefined();
      expect(info?.evidenceId).toBe(bundle.bundleId);
      expect(info?.hash).toBe(anchorResult.hash);
      expect(info?.blockHeight).toBe(anchorResult.blockHeight);
      expect(info?.chainType).toBe('stub');
    });

    it('should return null for unanchored evidence bundle', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);
      const info = await getAnchorInfo(bundle.bundleId);

      expect(info).toBeNull();
    });

    it('should throw error for non-existent evidence bundle', async () => {
      await expect(getAnchorInfo('non-existent-id')).rejects.toThrow();
    });
  });

  describe('batchAnchorEvidence', () => {
    it('should anchor multiple evidence bundles', async () => {
      const psvResult1 = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const psvResult2 = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'NY',
        licenseNumber: '789012',
      });

      const bundle1 = await buildEvidenceBundle(psvResult1.psvResultId);
      const bundle2 = await buildEvidenceBundle(psvResult2.psvResultId);

      const results = await batchAnchorEvidence([bundle1.bundleId, bundle2.bundleId]);

      expect(results).toHaveLength(2);
      expect(results[0].evidenceId).toBe(bundle1.bundleId);
      expect(results[1].evidenceId).toBe(bundle2.bundleId);
    });

    it('should handle errors gracefully', async () => {
      const psvResult = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const bundle = await buildEvidenceBundle(psvResult.psvResultId);

      // Include non-existent ID
      const results = await batchAnchorEvidence([bundle.bundleId, 'non-existent-id']);

      expect(results).toHaveLength(1);
      expect(results[0].evidenceId).toBe(bundle.bundleId);
    });
  });

  describe('getAnchorStatistics', () => {
    it('should return anchor statistics', async () => {
      const psvResult1 = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'CA',
        licenseNumber: '123456',
      });

      const psvResult2 = await runPSV({
        clinicianId: testClinicianId,
        npi: '1234567890',
        state: 'NY',
        licenseNumber: '789012',
      });

      const bundle1 = await buildEvidenceBundle(psvResult1.psvResultId);
      const bundle2 = await buildEvidenceBundle(psvResult2.psvResultId);

      // Anchor only one bundle
      await anchorEvidence(bundle1.bundleId);

      const stats = await getAnchorStatistics();

      expect(stats.totalBundles).toBe(2);
      expect(stats.anchoredBundles).toBe(1);
      expect(stats.unanchoredBundles).toBe(1);
      expect(stats.averageBlockHeight).toBeGreaterThan(0);
    });
  });
});


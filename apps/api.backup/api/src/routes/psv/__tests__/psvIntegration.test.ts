/**
 * Integration test for S72-D1: Complete PSV Workflow
 *
 * Tests the entire PSV process from license/sanctions checks
 * through evidence bundle creation, anchoring, and ZIP export
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { runPSV, getPSVResult } from '../../../../../../services/psv/psvOrchestrator.js';
import { buildEvidenceBundle, getEvidenceBundle, generateProofText } from '../../../services/evidenceBundle';
import { anchorEvidence, verifyAnchor, getAnchorInfo } from '../../../services/anchorStub';
import { isFresh, getDaysRemaining, getLatestFreshPSVResult } from '../../../services/psvFreshness';
import * as fs from 'fs';

const prisma = new PrismaClient();

describe('PSV Integration Test - Complete Workflow', () => {
  const testClinicianId = 'integration-test-clinician';
  const testNpi = '1234567890';
  const testState = 'CA';
  const testLicenseNumber = '123456';
  const testVcId = 'vc-credential-integration-test';

  beforeEach(async () => {
    // Clean up test data
    await prisma.pSVEvidenceBundle.deleteMany({});
    await prisma.pSVResult.deleteMany({
      where: { clinicianId: testClinicianId },
    });
    await prisma.pSVLicenseCheck.deleteMany({
      where: { npi: testNpi },
    });
    await prisma.pSVSanctionsCheck.deleteMany({
      where: { npi: testNpi },
    });
  });

  afterEach(async () => {
    // Clean up test data and temp files
    const bundles = await prisma.pSVEvidenceBundle.findMany({});
    for (const bundle of bundles) {
      if (bundle.zipPath && fs.existsSync(bundle.zipPath)) {
        try {
          fs.unlinkSync(bundle.zipPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }

    await prisma.pSVEvidenceBundle.deleteMany({});
    await prisma.pSVResult.deleteMany({
      where: { clinicianId: testClinicianId },
    });
    await prisma.pSVLicenseCheck.deleteMany({
      where: { npi: testNpi },
    });
    await prisma.pSVSanctionsCheck.deleteMany({
      where: { npi: testNpi },
    });
  });

  it('should complete full PSV workflow: check → orchestrate → bundle → anchor → verify', async () => {
    // ===== STEP 1: Run PSV (orchestrates license + sanctions) =====
    console.log('Step 1: Running PSV orchestrator...');
    const psvResult = await runPSV({
      clinicianId: testClinicianId,
      npi: testNpi,
      state: testState,
      licenseNumber: testLicenseNumber,
    });

    // Verify PSV result
    expect(psvResult.overallStatus).toBe('PASS');
    expect(psvResult.clinicianId).toBe(testClinicianId);
    expect(psvResult.npi).toBe(testNpi);
    expect(psvResult.licenseCheck.status).toBe('ACTIVE');
    expect(psvResult.sanctionsCheck.sanctioned).toBe(false);
    expect(psvResult.isFresh).toBe(true);

    console.log(`✓ PSV Result: ${psvResult.overallStatus}`);
    console.log(`✓ License: ${psvResult.licenseCheck.status}`);
    console.log(`✓ Sanctions: ${psvResult.sanctionsCheck.sanctioned ? 'FLAGGED' : 'CLEAR'}`);

    // ===== STEP 2: Check freshness =====
    console.log('Step 2: Checking PSV freshness...');
    const freshCheck = isFresh({ checkedAt: psvResult.checkedAt });
    const daysRemaining = getDaysRemaining({ checkedAt: psvResult.checkedAt });

    expect(freshCheck).toBe(true);
    expect(daysRemaining).toBe(120);

    console.log(`✓ Fresh: ${freshCheck}`);
    console.log(`✓ Days remaining: ${daysRemaining}`);

    // ===== STEP 3: Build evidence bundle =====
    console.log('Step 3: Building evidence bundle...');
    const evidenceBundle = await buildEvidenceBundle(
      psvResult.psvResultId,
      testVcId
    );

    // Verify evidence bundle
    expect(evidenceBundle.manifest.clinicianId).toBe(testClinicianId);
    expect(evidenceBundle.manifest.vcId).toBe(testVcId);
    expect(evidenceBundle.manifest.psvResultId).toBe(psvResult.psvResultId);
    expect(evidenceBundle.manifest.overallStatus).toBe('PASS');
    expect(evidenceBundle.manifest.sourceUrls).toHaveLength(2);
    expect(evidenceBundle.manifest.metadata.ncqaCompliance).toBe('CR1-CR5');
    expect(evidenceBundle.manifest.metadata.freshnessStatus).toBe('FRESH');

    console.log(`✓ Bundle ID: ${evidenceBundle.bundleId}`);
    console.log(`✓ Manifest path: ${evidenceBundle.manifestPath}`);

    // Verify manifest file exists
    expect(fs.existsSync(evidenceBundle.manifestPath)).toBe(true);

    // ===== STEP 4: Anchor evidence =====
    console.log('Step 4: Anchoring evidence...');
    const anchorResult = await anchorEvidence(evidenceBundle.bundleId);

    // Verify anchor
    expect(anchorResult.evidenceId).toBe(evidenceBundle.bundleId);
    expect(anchorResult.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(anchorResult.blockHeight).toBeGreaterThan(1000000);
    expect(anchorResult.blockHeight).toBeLessThan(10000000);
    expect(anchorResult.chainType).toBe('stub');

    console.log(`✓ Anchor ID: ${anchorResult.anchorId}`);
    console.log(`✓ Hash: ${anchorResult.hash.substring(0, 16)}...`);
    console.log(`✓ Block Height: ${anchorResult.blockHeight}`);

    // ===== STEP 5: Verify anchor =====
    console.log('Step 5: Verifying anchor...');
    const verificationResult = await verifyAnchor(evidenceBundle.bundleId);

    expect(verificationResult).toBe(true);

    console.log(`✓ Anchor verified: ${verificationResult}`);

    // ===== STEP 6: Retrieve anchor info =====
    console.log('Step 6: Retrieving anchor info...');
    const anchorInfo = await getAnchorInfo(evidenceBundle.bundleId);

    expect(anchorInfo).toBeDefined();
    expect(anchorInfo?.hash).toBe(anchorResult.hash);
    expect(anchorInfo?.blockHeight).toBe(anchorResult.blockHeight);

    console.log(`✓ Retrieved anchor info successfully`);

    // ===== STEP 7: Retrieve evidence bundle =====
    console.log('Step 7: Retrieving evidence bundle...');
    const retrievedBundle = await getEvidenceBundle(evidenceBundle.bundleId);

    expect(retrievedBundle).toBeDefined();
    expect(retrievedBundle?.clinicianId).toBe(testClinicianId);

    console.log(`✓ Retrieved evidence bundle successfully`);

    // ===== STEP 8: Generate proof text =====
    console.log('Step 8: Generating proof text...');
    const proofText = generateProofText(evidenceBundle.manifest);

    expect(proofText).toContain('PRIMARY SOURCE VERIFICATION PROOF');
    expect(proofText).toContain(testClinicianId);
    expect(proofText).toContain(testNpi);
    expect(proofText).toContain('ACTIVE');
    expect(proofText).toContain('stateboard.ca.gov');
    expect(proofText).toContain('oig.hhs.gov');

    console.log(`✓ Generated proof text (${proofText.length} chars)`);

    // ===== STEP 9: Verify database persistence =====
    console.log('Step 9: Verifying database persistence...');

    const storedPsvResult = await prisma.pSVResult.findUnique({
      where: { id: psvResult.psvResultId },
      include: {
        licenseCheck: true,
        sanctionsCheck: true,
        evidenceBundles: true,
      },
    });

    expect(storedPsvResult).toBeDefined();
    expect(storedPsvResult?.licenseCheck).toBeDefined();
    expect(storedPsvResult?.sanctionsCheck).toBeDefined();
    expect(storedPsvResult?.evidenceBundles).toHaveLength(1);
    expect(storedPsvResult?.evidenceBundles[0].anchorHash).toBe(anchorResult.hash);

    console.log(`✓ All data persisted correctly in database`);

    // ===== STEP 10: Test retrieval by clinician ID =====
    console.log('Step 10: Testing retrieval by clinician ID...');

    const latestFresh = await getLatestFreshPSVResult(testClinicianId);

    expect(latestFresh).toBeDefined();
    expect(latestFresh?.psvResultId).toBe(psvResult.psvResultId);
    expect(latestFresh?.isFresh).toBe(true);

    console.log(`✓ Retrieved latest fresh PSV result`);

    console.log('\n✅ Complete PSV workflow test PASSED');
  });

  it('should handle FAIL scenario for inactive license', async () => {
    // Run PSV with inactive license (NY state, test data)
    const psvResult = await runPSV({
      clinicianId: testClinicianId,
      npi: '0987654321',
      state: 'NY',
      licenseNumber: '789012',
    });

    expect(psvResult.overallStatus).toBe('FAIL');
    expect(psvResult.licenseCheck.status).toBe('INACTIVE');
    expect(psvResult.summary).toContain('License status: INACTIVE');

    // Build evidence bundle even for FAIL status (for audit trail)
    const evidenceBundle = await buildEvidenceBundle(psvResult.psvResultId);
    expect(evidenceBundle.manifest.overallStatus).toBe('FAIL');

    // Anchor the evidence
    const anchorResult = await anchorEvidence(evidenceBundle.bundleId);
    expect(anchorResult.hash).toBeDefined();

    console.log('✅ FAIL scenario test PASSED');
  });

  it('should handle FAIL scenario for sanctioned provider', async () => {
    // Run PSV with sanctioned provider (test NPI 6666666666)
    const psvResult = await runPSV({
      clinicianId: testClinicianId,
      npi: '6666666666',
      state: 'CA',
      licenseNumber: '123456',
    });

    expect(psvResult.overallStatus).toBe('FAIL');
    expect(psvResult.sanctionsCheck.sanctioned).toBe(true);
    expect(psvResult.summary).toContain('OIG exclusion list');

    // Build and anchor evidence bundle
    const evidenceBundle = await buildEvidenceBundle(psvResult.psvResultId);
    await anchorEvidence(evidenceBundle.bundleId);

    // Verify anchor works for FAIL status too
    const verified = await verifyAnchor(evidenceBundle.bundleId);
    expect(verified).toBe(true);

    console.log('✅ Sanctioned provider test PASSED');
  });

  it('should maintain audit trail through complete workflow', async () => {
    // Run PSV
    const psvResult = await runPSV({
      clinicianId: testClinicianId,
      npi: testNpi,
      state: testState,
      licenseNumber: testLicenseNumber,
    });

    // Build evidence bundle
    const evidenceBundle = await buildEvidenceBundle(psvResult.psvResultId);

    // Anchor evidence
    await anchorEvidence(evidenceBundle.bundleId);

    // Verify complete audit trail
    const auditTrail = await prisma.pSVResult.findUnique({
      where: { id: psvResult.psvResultId },
      include: {
        licenseCheck: true,
        sanctionsCheck: true,
        evidenceBundles: {
          include: {
            psvResult: true,
          },
        },
      },
    });

    expect(auditTrail).toBeDefined();
    expect(auditTrail?.licenseCheck?.rawResponse).toBeDefined();
    expect(auditTrail?.sanctionsCheck?.rawResponse).toBeDefined();
    expect(auditTrail?.evidenceBundles[0].anchorHash).toBeDefined();
    expect(auditTrail?.evidenceBundles[0].blockHeight).toBeDefined();

    // Verify timestamps are in correct order
    const licenseCheckedAt = auditTrail?.licenseCheck?.checkedAt.getTime() || 0;
    const sanctionsCheckedAt = auditTrail?.sanctionsCheck?.checkedAt.getTime() || 0;
    const psvCheckedAt = auditTrail?.checkedAt.getTime() || 0;
    const bundleCreatedAt = auditTrail?.evidenceBundles[0].createdAt.getTime() || 0;

    expect(licenseCheckedAt).toBeLessThanOrEqual(psvCheckedAt);
    expect(sanctionsCheckedAt).toBeLessThanOrEqual(psvCheckedAt);
    expect(psvCheckedAt).toBeLessThanOrEqual(bundleCreatedAt);

    console.log('✅ Audit trail test PASSED');
  });

  it('should support multiple evidence bundles for same PSV result', async () => {
    // Run PSV
    const psvResult = await runPSV({
      clinicianId: testClinicianId,
      npi: testNpi,
      state: testState,
      licenseNumber: testLicenseNumber,
    });

    // Create multiple evidence bundles
    const bundle1 = await buildEvidenceBundle(psvResult.psvResultId, 'vc-1');
    const bundle2 = await buildEvidenceBundle(psvResult.psvResultId, 'vc-2');
    const bundle3 = await buildEvidenceBundle(psvResult.psvResultId, 'vc-3');

    // Anchor all bundles
    await anchorEvidence(bundle1.bundleId);
    await anchorEvidence(bundle2.bundleId);
    await anchorEvidence(bundle3.bundleId);

    // Verify all bundles are linked to same PSV result
    const psvResultWithBundles = await prisma.pSVResult.findUnique({
      where: { id: psvResult.psvResultId },
      include: { evidenceBundles: true },
    });

    expect(psvResultWithBundles?.evidenceBundles).toHaveLength(3);
    expect(psvResultWithBundles?.evidenceBundles.every((b) => b.anchorHash !== null)).toBe(true);

    console.log('✅ Multiple bundles test PASSED');
  });
});


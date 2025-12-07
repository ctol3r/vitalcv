/**
 * S72-D1-B-005: Evidence bundle builder: JSON manifest for PSV run
 *
 * Given PSV result & VC id, builds JSON manifest:
 * {
 *   clinicianId,
 *   results: [...],
 *   timestamp,
 *   sourceUrls: [...]
 * }
 *
 * Returns path to temp directory with manifest
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  EvidenceBundleManifest,
  EvidenceBundleResult,
} from '@domain-common/credentialingContracts';

const prisma = new PrismaClient();

/**
 * Build evidence bundle manifest from PSV result
 *
 * @param psvResultId - PSV result ID
 * @param vcId - Optional VC ID to include in manifest
 * @returns Evidence bundle with manifest and temp directory path
 */
export async function buildEvidenceBundle(
  psvResultId: string,
  vcId?: string
): Promise<EvidenceBundleResult> {
  // Fetch PSV result with related checks
  const psvResult = await prisma.pSVResult.findUnique({
    where: { id: psvResultId },
    include: {
      licenseCheck: true,
      sanctionsCheck: true,
    },
  });

  if (!psvResult) {
    throw new Error(`PSV result not found: ${psvResultId}`);
  }

  if (!psvResult.licenseCheck) {
    throw new Error(`License check not found for PSV result: ${psvResultId}`);
  }

  if (!psvResult.sanctionsCheck) {
    throw new Error(`Sanctions check not found for PSV result: ${psvResultId}`);
  }

  // Create temp directory for bundle
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'psv-evidence-'));

  // Build manifest
  const bundleId = `bundle-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = new Date().toISOString();

  const sourceUrls = [
    psvResult.licenseCheck.sourceUrl || '',
    psvResult.sanctionsCheck.sourceUrl || '',
  ].filter(Boolean);

  const manifest: EvidenceBundleManifest = {
    bundleId,
    clinicianId: psvResult.clinicianId,
    npi: psvResult.npi || undefined,
    vcId,
    psvResultId: psvResult.id,
    timestamp,
    results: {
      licenseCheck: {
        checkId: psvResult.licenseCheck.id,
        npi: psvResult.licenseCheck.npi,
        state: psvResult.licenseCheck.state,
        licenseNumber: psvResult.licenseCheck.licenseNumber,
        status: psvResult.licenseCheck.status,
        sourceUrl: psvResult.licenseCheck.sourceUrl || '',
        checkedAt: psvResult.licenseCheck.checkedAt.toISOString(),
      },
      sanctionsCheck: {
        checkId: psvResult.sanctionsCheck.id,
        npi: psvResult.sanctionsCheck.npi,
        sanctioned: psvResult.sanctionsCheck.sanctioned,
        sourceUrl: psvResult.sanctionsCheck.sourceUrl || '',
        checkedAt: psvResult.sanctionsCheck.checkedAt.toISOString(),
      },
    },
    overallStatus: psvResult.overallStatus,
    sourceUrls,
    metadata: {
      ncqaCompliance: 'CR1-CR5',
      freshnessStatus: psvResult.isFresh ? 'FRESH' : 'STALE',
      generatedAt: timestamp,
    },
  };

  // Write manifest to temp directory
  const manifestPath = path.join(tempDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Store evidence bundle in database
  const evidenceBundle = await prisma.pSVEvidenceBundle.create({
    data: {
      psvResultId: psvResult.id,
      bundleJson: manifest as any,
      anchorId: null,
      anchorHash: null,
      blockHeight: null,
      zipPath: null,
    },
  });

  return {
    bundleId: evidenceBundle.id,
    manifestPath,
    tempDirectory: tempDir,
    manifest,
  };
}

/**
 * Get evidence bundle by ID
 *
 * @param bundleId - Evidence bundle ID
 * @returns Evidence bundle manifest, or null if not found
 */
export async function getEvidenceBundle(bundleId: string): Promise<EvidenceBundleManifest | null> {
  const bundle = await prisma.pSVEvidenceBundle.findUnique({
    where: { id: bundleId },
  });

  if (!bundle) {
    return null;
  }

  return bundle.bundleJson as any as EvidenceBundleManifest;
}

/**
 * Get all evidence bundles for a PSV result
 *
 * @param psvResultId - PSV result ID
 * @returns Array of evidence bundles
 */
export async function getEvidenceBundlesForPSVResult(
  psvResultId: string
): Promise<EvidenceBundleManifest[]> {
  const bundles = await prisma.pSVEvidenceBundle.findMany({
    where: { psvResultId },
    orderBy: { createdAt: 'desc' },
  });

  return bundles.map((b) => b.bundleJson as any as EvidenceBundleManifest);
}

/**
 * Delete evidence bundle and temp files
 *
 * @param bundleId - Evidence bundle ID
 * @param cleanupFiles - Whether to delete temp files (default: true)
 */
export async function deleteEvidenceBundle(bundleId: string, cleanupFiles = true): Promise<void> {
  const bundle = await prisma.pSVEvidenceBundle.findUnique({
    where: { id: bundleId },
  });

  if (!bundle) {
    throw new Error(`Evidence bundle not found: ${bundleId}`);
  }

  // Clean up temp files if requested
  if (cleanupFiles && bundle.zipPath) {
    try {
      if (fs.existsSync(bundle.zipPath)) {
        fs.unlinkSync(bundle.zipPath);
      }
    } catch (error) {
      console.error(`Failed to delete ZIP file: ${bundle.zipPath}`, error);
    }
  }

  // Delete database record
  await prisma.pSVEvidenceBundle.delete({
    where: { id: bundleId },
  });
}

/**
 * Generate proof text for evidence bundle
 * Includes source URLs and verification details
 *
 * @param manifest - Evidence bundle manifest
 * @returns Proof text content
 */
export function generateProofText(manifest: EvidenceBundleManifest): string {
  const lines = [
    '===== PRIMARY SOURCE VERIFICATION PROOF =====',
    '',
    `Bundle ID: ${manifest.bundleId}`,
    `Clinician ID: ${manifest.clinicianId}`,
    `NPI: ${manifest.npi || 'N/A'}`,
    `VC ID: ${manifest.vcId || 'N/A'}`,
    `PSV Result ID: ${manifest.psvResultId}`,
    `Generated: ${manifest.metadata.generatedAt}`,
    '',
    '===== LICENSE VERIFICATION =====',
    `Check ID: ${manifest.results.licenseCheck.checkId}`,
    `NPI: ${manifest.results.licenseCheck.npi}`,
    `State: ${manifest.results.licenseCheck.state}`,
    `License Number: ${manifest.results.licenseCheck.licenseNumber}`,
    `Status: ${manifest.results.licenseCheck.status}`,
    `Verified At: ${manifest.results.licenseCheck.checkedAt}`,
    `Source: ${manifest.results.licenseCheck.sourceUrl}`,
    '',
    '===== SANCTIONS CHECK =====',
    `Check ID: ${manifest.results.sanctionsCheck.checkId}`,
    `NPI: ${manifest.results.sanctionsCheck.npi}`,
    `Sanctioned: ${manifest.results.sanctionsCheck.sanctioned ? 'YES' : 'NO'}`,
    `Verified At: ${manifest.results.sanctionsCheck.checkedAt}`,
    `Source: ${manifest.results.sanctionsCheck.sourceUrl}`,
    '',
    '===== OVERALL STATUS =====',
    `Status: ${manifest.overallStatus}`,
    `NCQA Compliance: ${manifest.metadata.ncqaCompliance}`,
    `Freshness: ${manifest.metadata.freshnessStatus}`,
    '',
    '===== SOURCE URLS =====',
    ...manifest.sourceUrls.map((url) => `- ${url}`),
    '',
    '===== END OF PROOF =====',
  ];

  return lines.join('\n');
}


/**
 * S72-D1-B-006: ZIP exporter for evidence bundles
 *
 * GET /psv/evidence/:id returns ZIP with manifest.json + proof.txt
 * proof includes random anchorId
 *
 * Unit test checks structure of ZIP
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateProofText } from '../../services/evidenceBundle';
import { anchorEvidence, getAnchorInfo } from '../../services/anchorStub';
import {
  getCompactEvidenceSummaries,
  getCredentialRiskSummary,
  getNcqaComplianceSnapshot,
  getPecosSummaryForClinician,
  getTrustArtifactsForManifest,
} from 'services/psv/evidenceBundle';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /psv/evidence/:id
 *
 * Download evidence bundle as ZIP file
 *
 * ZIP contains:
 * - manifest.json: Full PSV evidence bundle manifest
 * - proof.txt: Human-readable proof with source URLs and anchor info
 *
 * Response headers:
 * - Content-Type: application/zip
 * - Content-Disposition: attachment; filename="psv-evidence-{id}.zip"
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch evidence bundle
    const evidenceBundle = await prisma.pSVEvidenceBundle.findUnique({
      where: { id },
    });

    if (!evidenceBundle) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Evidence bundle not found',
      });
    }

    const manifest = evidenceBundle.bundleJson as any;

    // Anchor the evidence if not already anchored
    if (!evidenceBundle.anchorId || !evidenceBundle.anchorHash) {
      await anchorEvidence(id);
    }

    // Get anchor info
    const anchorInfo = await getAnchorInfo(id);

    // Generate proof text
    const proofText = generateProofText(manifest);

    // Add anchor info to proof text
    const proofWithAnchor = anchorInfo
      ? `${proofText}\n\n===== ANCHOR INFORMATION =====\nAnchor ID: ${anchorInfo.anchorId}\nHash: ${anchorInfo.hash}\nBlock Height: ${anchorInfo.blockHeight}\nChain Type: ${anchorInfo.chainType}\nTimestamp: ${anchorInfo.timestamp}\n`
      : proofText;

    // Create temp directory for ZIP
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'psv-evidence-zip-'));

    // Write manifest.json
    const manifestPath = path.join(tempDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Write proof.txt
    const proofPath = path.join(tempDir, 'proof.txt');
    fs.writeFileSync(proofPath, proofWithAnchor);

    // Optionally include PECOS lifecycle artifacts
    const pecosFilePaths: string[] = [];
    const compactEvidenceFiles: string[] = [];
    const trustFiles: string[] = [];
    try {
      const pecosSummary = await getPecosSummaryForClinician(manifest.clinicianId);
      if (pecosSummary) {
        const pecosDir = path.join(tempDir, 'pecos');
        fs.mkdirSync(pecosDir, { recursive: true });
        const pecosSummaryPath = path.join(pecosDir, 'summary.json');
        fs.writeFileSync(pecosSummaryPath, JSON.stringify(pecosSummary, null, 2));
        pecosFilePaths.push(pecosSummaryPath);

        if (pecosSummary.enrollments && pecosSummary.enrollments.length > 0) {
          const generatedAt = new Date().toISOString();
          const currentPayload = {
            clinicianId: pecosSummary.clinicianId,
            generatedAt,
            enrollments: pecosSummary.enrollments.map((entry) => ({
              enrollmentType: entry.enrollmentType,
              currentStatus: entry.currentStatus,
              revalidationDueAt: entry.revalidationDueAt,
              lastCheckedAt: entry.lastCheckedAt,
            })),
          };
          const historyPayload = {
            clinicianId: pecosSummary.clinicianId,
            generatedAt,
            enrollments: pecosSummary.enrollments.map((entry) => ({
              enrollmentType: entry.enrollmentType,
              statuses: entry.statuses,
              anomalies: entry.anomalies,
            })),
          };
          const currentPath = path.join(pecosDir, 'current.json');
          const historyPath = path.join(pecosDir, 'history.json');
          fs.writeFileSync(currentPath, JSON.stringify(currentPayload, null, 2));
          fs.writeFileSync(historyPath, JSON.stringify(historyPayload, null, 2));
          pecosFilePaths.push(currentPath, historyPath);
        }
      }
    } catch (summaryError) {
      console.warn('[ZIP Export] Failed to attach PECOS summary', summaryError);
    }

    try {
      const compactSummaries = await getCompactEvidenceSummaries(manifest.clinicianId);
      if (compactSummaries.length > 0) {
        const compactsDir = path.join(tempDir, 'compacts');
        fs.mkdirSync(compactsDir, { recursive: true });
        for (const summary of compactSummaries) {
          const compactPath = path.join(compactsDir, `${summary.compactType}.json`);
          fs.writeFileSync(compactPath, JSON.stringify(summary, null, 2));
          compactEvidenceFiles.push(compactPath);
        }
      }
    } catch (compactError) {
      console.warn('[ZIP Export] Failed to attach compact summaries', compactError);
    }

    // Optionally include credential risk summary
    let riskSummaryPath: string | null = null;
    let ncqaCompliancePath: string | null = null;
    try {
      const riskSummary = await getCredentialRiskSummary(manifest.clinicianId);
      if (riskSummary) {
        const riskDir = path.join(tempDir, 'risk');
        fs.mkdirSync(riskDir, { recursive: true });
        riskSummaryPath = path.join(riskDir, 'summary.json');
        fs.writeFileSync(riskSummaryPath, JSON.stringify(riskSummary, null, 2));
      }
    } catch (riskSummaryError) {
      console.warn('[ZIP Export] Failed to attach credential risk summary', riskSummaryError);
    }

    // Optionally include NCQA compliance snapshot
    try {
      const ncqaSnapshot = await getNcqaComplianceSnapshot(manifest.clinicianId);
      if (ncqaSnapshot) {
        const complianceDir = path.join(tempDir, 'compliance');
        fs.mkdirSync(complianceDir, { recursive: true });
        ncqaCompliancePath = path.join(complianceDir, 'ncqa.json');
        fs.writeFileSync(ncqaCompliancePath, JSON.stringify(ncqaSnapshot, null, 2));
      }
    } catch (ncqaError) {
      console.warn('[ZIP Export] Failed to attach NCQA compliance snapshot', ncqaError);
    }

    try {
      const trustArtifacts = await getTrustArtifactsForManifest(manifest);
      if (trustArtifacts.length > 0) {
        const trustDir = path.join(tempDir, 'trust');
        fs.mkdirSync(trustDir, { recursive: true });
        for (const artifact of trustArtifacts) {
          const trustPath = path.join(trustDir, `${artifact.credential}.json`);
          fs.writeFileSync(trustPath, JSON.stringify(artifact, null, 2));
          trustFiles.push(trustPath);
        }
      }
    } catch (trustError) {
      console.warn('[ZIP Export] Failed to attach trust artifacts', trustError);
    }

    // Create ZIP file
    const zipPath = path.join(tempDir, `psv-evidence-${id}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Handle errors
    archive.on('error', (err) => {
      console.error('[ZIP Export] Archive error:', err);
      throw err;
    });

    // Pipe archive to file
    archive.pipe(output);

    // Add files to archive
    archive.file(manifestPath, { name: 'manifest.json' });
    archive.file(proofPath, { name: 'proof.txt' });
    if (pecosFilePaths.length > 0) {
      for (const pecosPath of pecosFilePaths) {
        archive.file(pecosPath, { name: `pecos/${path.basename(pecosPath)}` });
      }
    }
    if (compactEvidenceFiles.length > 0) {
      for (const compactPath of compactEvidenceFiles) {
        archive.file(compactPath, { name: `compacts/${path.basename(compactPath)}` });
      }
    }
    if (riskSummaryPath) {
      archive.file(riskSummaryPath, { name: 'risk/summary.json' });
    }
    if (ncqaCompliancePath) {
      archive.file(ncqaCompliancePath, { name: 'compliance/ncqa.json' });
    }
    if (trustFiles.length > 0) {
      for (const trustPath of trustFiles) {
        archive.file(trustPath, { name: `trust/${path.basename(trustPath)}` });
      }
    }

    // Finalize archive
    await archive.finalize();

    // Wait for output stream to finish
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    // Update database with ZIP path
    await prisma.pSVEvidenceBundle.update({
      where: { id },
      data: { zipPath },
    });

    // Send ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="psv-evidence-${id}.zip"`);

    const zipStream = fs.createReadStream(zipPath);
    zipStream.pipe(res);

    // Clean up temp files after sending
    zipStream.on('end', () => {
      try {
        fs.unlinkSync(manifestPath);
        fs.unlinkSync(proofPath);
        for (const pecosPath of pecosFilePaths) {
          if (fs.existsSync(pecosPath)) {
            fs.unlinkSync(pecosPath);
          }
        }
        for (const compactPath of compactEvidenceFiles) {
          if (fs.existsSync(compactPath)) {
            fs.unlinkSync(compactPath);
          }
        }
        if (riskSummaryPath && fs.existsSync(riskSummaryPath)) {
          fs.unlinkSync(riskSummaryPath);
        }
        if (ncqaCompliancePath && fs.existsSync(ncqaCompliancePath)) {
          fs.unlinkSync(ncqaCompliancePath);
        }
        for (const trustPath of trustFiles) {
          if (fs.existsSync(trustPath)) {
            fs.unlinkSync(trustPath);
          }
        }
        // Keep ZIP file for now (can be cleaned up later by a background job)
      } catch (error) {
        console.error('[ZIP Export] Cleanup error:', error);
      }
    });
  } catch (error) {
    console.error('[ZIP Export] Error:', error);
    return res.status(500).json({
      error: 'export_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /psv/evidence/:id/regenerate
 *
 * Regenerate ZIP file for evidence bundle
 * Useful if anchor information was updated
 */
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch evidence bundle
    const evidenceBundle = await prisma.pSVEvidenceBundle.findUnique({
      where: { id },
    });

    if (!evidenceBundle) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Evidence bundle not found',
      });
    }

    // Delete old ZIP if exists
    if (evidenceBundle.zipPath && fs.existsSync(evidenceBundle.zipPath)) {
      fs.unlinkSync(evidenceBundle.zipPath);
    }

    // Clear ZIP path in database
    await prisma.pSVEvidenceBundle.update({
      where: { id },
      data: { zipPath: null },
    });

    return res.status(200).json({
      message: 'ZIP regeneration triggered',
      evidenceId: id,
      note: 'Download the evidence bundle to generate new ZIP',
    });
  } catch (error) {
    console.error('[ZIP Regenerate] Error:', error);
    return res.status(500).json({
      error: 'regenerate_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /psv/evidence/:id/info
 *
 * Get evidence bundle information without downloading ZIP
 */
router.get('/:id/info', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const evidenceBundle = await prisma.pSVEvidenceBundle.findUnique({
      where: { id },
      include: {
        psvResult: {
          include: {
            licenseCheck: true,
            sanctionsCheck: true,
          },
        },
      },
    });

    if (!evidenceBundle) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Evidence bundle not found',
      });
    }

    const manifest = evidenceBundle.bundleJson as any;

    return res.status(200).json({
      bundleId: evidenceBundle.id,
      psvResultId: evidenceBundle.psvResultId,
      manifest,
      anchor: {
        anchorId: evidenceBundle.anchorId,
        hash: evidenceBundle.anchorHash,
        blockHeight: evidenceBundle.blockHeight,
      },
      zipPath: evidenceBundle.zipPath,
      createdAt: evidenceBundle.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[Evidence Info] Error:', error);
    return res.status(500).json({
      error: 'info_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


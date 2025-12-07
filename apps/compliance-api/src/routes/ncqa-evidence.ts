/**
 * B119A-PSV-007: NCQA Evidence ZIP export
 *
 * Generates ZIP archives containing:
 * - API endpoint configurations
 * - Policy excerpts
 * - Reviewer sign-offs
 * - Audit evidence (CR1-CR5)
 * - Verification history
 */

import express, { Request, Response } from 'express';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID, createHash } from 'crypto';
import archiver from 'archiver';
import { getPSVRegistry, VerificationType } from '../../../services/psv/registry';
// B121B-AUD-013: Import AuditScrapbook and PolkadotService for anchoring
// Note: Adjust import paths based on actual project structure
let AuditScrapbook: any;
let PolkadotService: any;
try {
  // Try relative path from compliance-api
  AuditScrapbook = require('../../../backend/src/blockchain/audit_scrapbook').AuditScrapbook;
  PolkadotService = require('../../../backend/src/blockchain/polkadot_service').PolkadotService;
} catch (e) {
  // Fallback: create minimal implementation if imports fail
  console.warn('AuditScrapbook/PolkadotService not available, using fallback');
}

const router = express.Router();
const registry = getPSVRegistry();

/**
 * POST /compliance/ncqa/evidence/export
 * Generate NCQA evidence ZIP export
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { crTypes, startDate, endDate, includePolicy } = req.body;

    // Filter evidence by CR types if specified
    const crTypeFilter: VerificationType[] = crTypes || ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'];
    const evidence = registry.getAuditEvidence().filter(e => crTypeFilter.includes(e.crType));

    // Filter by date range if specified
    let filteredEvidence = evidence;
    if (startDate || endDate) {
      filteredEvidence = evidence.filter(e => {
        const timestamp = e.timestamp.getTime();
        if (startDate && timestamp < new Date(startDate).getTime()) return false;
        if (endDate && timestamp > new Date(endDate).getTime()) return false;
        return true;
      });
    }

    // Create temporary ZIP file
    const zipId = randomUUID();
    const zipPath = join(tmpdir(), `ncqa-evidence-${zipId}.zip`);
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise<void>((resolve, reject) => {
      archive.pipe(output);

      // Add API endpoints manifest
      const endpoints = registry.listEndpoints({ active: true });
      archive.append(JSON.stringify({
        exportDate: new Date().toISOString(),
        endpoints: endpoints.map(e => ({
          id: e.id,
          name: e.name,
          endpoint: e.endpoint,
          method: e.method,
          authType: e.authType,
          verificationTypes: e.verificationTypes,
          provider: e.provider,
          lastVerified: e.lastVerified,
        })),
      }, null, 2), { name: 'api-endpoints.json' });

      // B122A-NCQA-010: Add policy excerpts with hash
      let policyHash: string | null = null;
      if (includePolicy !== false) {
        const policyExcerpt = {
          policyVersion: '1.0',
          policyDate: new Date().toISOString(),
          excerpts: {
            primarySourceVerification: {
              description: 'All credentials must be verified directly from the primary source',
              requirements: [
                'CR1: Primary source verification of credentials',
                'CR2: Verification of licensure',
                'CR3: Verification of education',
                'CR4: Verification of board certification',
                'CR5: Verification of work history',
              ],
            },
            auditTrail: {
              description: 'All verification requests must be logged with evidence hash',
              requirements: [
                'SHA256 hash of verification evidence',
                'Timestamp of verification',
                'Endpoint used for verification',
                'Reviewer sign-off for audit compliance',
              ],
            },
          },
        };

        // B122A-NCQA-010: Compute policy excerpt hash
        const policyJson = JSON.stringify(policyExcerpt, null, 2);
        policyHash = createHash('sha256').update(policyJson).digest('hex');

        // Add policy excerpt with hash
        archive.append(JSON.stringify({
          ...policyExcerpt,
          policyHash, // B122A-NCQA-010: Policy hash included
          policyHashAlgorithm: 'SHA256',
        }, null, 2), { name: 'policy-excerpts.json' });
      }

      // Add audit evidence by CR type
      for (const crType of crTypeFilter) {
        const crEvidence = filteredEvidence.filter(e => e.crType === crType);
        if (crEvidence.length > 0) {
          archive.append(JSON.stringify({
            crType,
            count: crEvidence.length,
            evidence: crEvidence.map(e => ({
              verificationId: e.verificationId,
              endpointId: e.endpointId,
              endpointName: e.endpointName,
              subjectId: e.subjectId,
              timestamp: e.timestamp,
              evidenceHash: e.evidenceHash,
              reviewerSignOff: e.reviewerSignOff ? {
                reviewerId: e.reviewerSignOff.reviewerId,
                reviewerName: e.reviewerSignOff.reviewerName,
                signedAt: e.reviewerSignOff.signedAt,
                signature: e.reviewerSignOff.signature,
              } : null,
              evidenceData: e.evidenceData,
            })),
          }, null, 2), { name: `evidence-${crType}.json` });
        }
      }

      // B122A-NCQA-010: Add reviewer attestation JSON with signatures
      const signedOffEvidence = filteredEvidence.filter(e => e.reviewerSignOff !== null);

      // B121B-AUD-013: Hash reviewer IDs for privacy
      const reviewerIdHashes = new Map<string, string>();
      const hashReviewerId = (reviewerId: string): string => {
        if (!reviewerIdHashes.has(reviewerId)) {
          reviewerIdHashes.set(reviewerId, createHash('sha256').update(reviewerId).digest('hex'));
        }
        return reviewerIdHashes.get(reviewerId)!;
      };

      // B122A-NCQA-010: Reviewer attestation JSON with signatures
      const reviewerAttestations = signedOffEvidence.map(e => ({
        crType: e.crType,
        verificationId: e.verificationId,
        endpointId: e.endpointId,
        endpointName: e.endpointName,
        subjectId: e.subjectId,
        evidenceHash: e.evidenceHash,
        reviewerIdHash: hashReviewerId(e.reviewerSignOff!.reviewerId),
        reviewerName: e.reviewerSignOff!.reviewerName,
        signature: e.reviewerSignOff!.signature, // B122A-NCQA-010: Reviewer signature present
        signedAt: e.reviewerSignOff!.signedAt.toISOString(),
        timestamp: e.timestamp.toISOString(),
      }));

      archive.append(JSON.stringify({
        totalSignOffs: signedOffEvidence.length,
        attestations: reviewerAttestations, // B122A-NCQA-010: Reviewer attestation JSON
        attestationHash: createHash('sha256').update(JSON.stringify(reviewerAttestations)).digest('hex'),
        attestationHashAlgorithm: 'SHA256',
      }, null, 2), { name: 'reviewer-attestations.json' });

      // Add verification history summary
      const verifications = registry.getVerificationHistory();
      archive.append(JSON.stringify({
        totalVerifications: verifications.length,
        byStatus: {
          success: verifications.filter(v => v.status === 'success').length,
          failed: verifications.filter(v => v.status === 'failed').length,
          pending: verifications.filter(v => v.status === 'pending').length,
          timeout: verifications.filter(v => v.status === 'timeout').length,
        },
        byCRType: {
          CR1: verifications.filter(v => v.verificationType === 'CR1').length,
          CR2: verifications.filter(v => v.verificationType === 'CR2').length,
          CR3: verifications.filter(v => v.verificationType === 'CR3').length,
          CR4: verifications.filter(v => v.verificationType === 'CR4').length,
          CR5: verifications.filter(v => v.verificationType === 'CR5').length,
        },
      }, null, 2), { name: 'verification-summary.json' });

      // B122A-NCQA-010: Add export manifest with policy hash
      archive.append(JSON.stringify({
        exportId: zipId,
        exportDate: new Date().toISOString(),
        exportedBy: (req as any).user?.id || 'system',
        crTypes: crTypeFilter,
        dateRange: {
          start: startDate || null,
          end: endDate || null,
        },
        evidenceCount: filteredEvidence.length,
        endpointsCount: endpoints.length,
        includePolicy: includePolicy !== false,
        policyHash: policyHash || null, // B122A-NCQA-010: Policy hash in manifest
      }, null, 2), { name: 'export-manifest.json' });

      archive.finalize();

      output.on('close', async () => {
        // B121B-AUD-013: Calculate SHA256 hash of ZIP file and anchor to AuditScrapbook
        try {
          const fs = require('fs');
          const zipBuffer = fs.readFileSync(zipPath);
          const zipHash = createHash('sha256').update(zipBuffer).digest('hex');

          // B121B-AUD-013: Anchor ZIP hash to AuditScrapbook
          const reviewerIdHashesArray = Array.from(reviewerIdHashes.entries()).map(([id, hash]) => ({
            originalId: id.substring(0, 8) + '...', // Partial ID for reference (not full ID)
            hash,
          }));

          const auditMetadata = {
            zipId,
            evidenceCount: filteredEvidence.length,
            exportedAt: new Date().toISOString(),
            exportedBy: (req as any).user?.id || 'system',
          };

          // Anchor to AuditScrapbook if available
          if (AuditScrapbook && PolkadotService) {
            try {
              const polkadotService = new PolkadotService();
              const auditScrapbook = new AuditScrapbook(polkadotService);

              // Anchor evidence hash
              const txHash = await auditScrapbook.anchorEvidenceHash(
                zipHash,
                reviewerIdHashesArray,
                auditMetadata
              );

              console.log(`[AUDIT] NCQA evidence ZIP anchored: ${zipId}, hash: ${zipHash}, tx: ${txHash}`);
            } catch (anchorErr) {
              console.error('Failed to anchor to AuditScrapbook:', anchorErr);
            }
          } else {
            // Log audit event even if AuditScrapbook not available
            console.log(`[AUDIT] NCQA evidence ZIP exported: ${zipId}, hash: ${zipHash}`);
            console.log(`[AUDIT] Reviewer ID hashes: ${reviewerIdHashesArray.length} reviewers`);
          }

          // B122A-NCQA-010: Store the hash in response headers and body
          res.setHeader('X-Evidence-ZIP-Hash', zipHash);
          res.setHeader('X-Evidence-ZIP-Hash-Algorithm', 'SHA256');

          // B122A-NCQA-010: Return SHA hash in response
          res.setHeader('Content-Type', 'application/json');
          res.json({
            success: true,
            zipId,
            sha256: zipHash, // B122A-NCQA-010: SHA returned
            downloadUrl: `/compliance/ncqa/evidence/download/${zipId}`,
            policyHash: policyHash || null,
            evidenceCount: filteredEvidence.length,
          });
          return;
        } catch (anchorError) {
          console.error('Failed to anchor ZIP hash to AuditScrapbook:', anchorError);
          // Continue with download even if anchoring fails
        }

        // Note: Response already sent as JSON above with hash
        // If download is needed, use separate endpoint
        // For now, return JSON with hash as per B122A-NCQA-010 requirements
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error: any) {
    console.error('NCQA evidence export error:', error);
    res.status(500).json({
      error: 'export_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /compliance/ncqa/evidence/preview
 * Preview evidence export without generating ZIP
 */
router.get('/preview', (req: Request, res: Response) => {
  try {
    const { crTypes, startDate, endDate } = req.query;

    const crTypeFilter: VerificationType[] = (crTypes as string)?.split(',') as VerificationType[] || ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'];
    const evidence = registry.getAuditEvidence().filter(e => crTypeFilter.includes(e.crType));

    let filteredEvidence = evidence;
    if (startDate || endDate) {
      filteredEvidence = evidence.filter(e => {
        const timestamp = e.timestamp.getTime();
        if (startDate && timestamp < new Date(startDate as string).getTime()) return false;
        if (endDate && timestamp > new Date(endDate as string).getTime()) return false;
        return true;
      });
    }

    const endpoints = registry.listEndpoints({ active: true });
    const statistics = registry.getStatistics();

    res.json({
      preview: {
        evidenceCount: filteredEvidence.length,
        endpointsCount: endpoints.length,
        crTypes: crTypeFilter,
        dateRange: {
          start: startDate || null,
          end: endDate || null,
        },
      },
      statistics: {
        ...statistics,
        filteredEvidenceCount: filteredEvidence.length,
      },
      estimatedSize: '~' + Math.ceil(filteredEvidence.length * 2) + 'KB',
    });
  } catch (error: any) {
    console.error('Evidence preview error:', error);
    res.status(500).json({
      error: 'preview_failed',
      error_description: error.message,
    });
  }
});

export default router;


/**
 * B128A-NCQA-010: Evidence ZIP generation
 * Policy excerpt + hash + reviewer attestation JSON; return SHA
 */

import express, { Request, Response } from 'express';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { Readable } from 'stream';

const router = express.Router();

export interface PolicyExcerpt {
  policyId: string;
  policyName: string;
  version: string;
  excerpt: string;
  effectiveDate: string;
  applicableSections: string[];
}

export interface ReviewerAttestation {
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  reviewDate: string;
  attestationStatement: string;
  signature: string; // Digital signature
  publicKey?: string;
}

export interface EvidenceZipMetadata {
  evidenceId: string;
  providerId: string;
  providerName: string;
  checkDate: string;
  policyExcerpt: PolicyExcerpt;
  reviewerAttestation: ReviewerAttestation;
  generatedAt: string;
  generatedBy: string;
}

/**
 * B128A-NCQA-010: Compute SHA-256 hash of file content
 */
function computeFileSHA256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * B128A-NCQA-010: Create policy excerpt from full policy
 * Extracts relevant sections and computes hash
 */
function createPolicyExcerpt(
  policyId: string,
  policyName: string,
  fullPolicy: string,
  applicableSections: string[]
): PolicyExcerpt & { hash: string } {
  // Extract excerpt from full policy (for demo, using first 500 chars)
  const excerpt = fullPolicy.substring(0, 500) + '...';

  const policyExcerpt: PolicyExcerpt = {
    policyId,
    policyName,
    version: '1.0.0',
    excerpt,
    effectiveDate: new Date().toISOString(),
    applicableSections,
  };

  // B128A-NCQA-010: Compute hash of policy excerpt
  const hash = computeFileSHA256(JSON.stringify(policyExcerpt));

  return { ...policyExcerpt, hash };
}

/**
 * B128A-NCQA-010: Create reviewer attestation with signature
 */
async function createReviewerAttestation(
  reviewerId: string,
  reviewerName: string,
  reviewerRole: string,
  evidenceId: string,
  providerId: string
): Promise<ReviewerAttestation & { hash: string }> {
  const attestation: ReviewerAttestation = {
    reviewerId,
    reviewerName,
    reviewerRole,
    reviewDate: new Date().toISOString(),
    attestationStatement: `I, ${reviewerName}, hereby attest that I have reviewed the evidence for provider ${providerId} (evidence ID: ${evidenceId}) and confirm its accuracy and completeness in accordance with NCQA standards.`,
    signature: 'mock-digital-signature', // In production, use real digital signature
    publicKey: 'mock-public-key', // In production, include actual public key for verification
  };

  // B128A-NCQA-010: Compute hash of attestation
  const hash = computeFileSHA256(JSON.stringify(attestation));

  return { ...attestation, hash };
}

/**
 * B128A-NCQA-010: Generate evidence ZIP archive
 * Includes policy excerpt + hash, reviewer attestation JSON
 * Returns SHA-256 hash of ZIP file
 */
router.post('/evidence-zip', async (req: Request, res: Response) => {
  try {
    const {
      evidenceId,
      providerId,
      providerName,
      policyId,
      policyName,
      fullPolicy,
      applicableSections,
      reviewerId,
      reviewerName,
      reviewerRole,
    } = req.body;

    // Validate required fields
    if (!evidenceId || !providerId || !policyId || !reviewerId) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required fields: evidenceId, providerId, policyId, reviewerId',
      });
    }

    // B128A-NCQA-010: Create policy excerpt with hash
    const policyExcerpt = createPolicyExcerpt(
      policyId,
      policyName || 'NCQA Credentialing Policy',
      fullPolicy || 'Mock policy content for demonstration...',
      applicableSections || ['Section 1: Provider Verification', 'Section 2: License Validation']
    );

    // B128A-NCQA-010: Create reviewer attestation with signature
    const reviewerAttestation = await createReviewerAttestation(
      reviewerId,
      reviewerName || 'Jane Reviewer',
      reviewerRole || 'Compliance Officer',
      evidenceId,
      providerId
    );

    // Create metadata
    const metadata: EvidenceZipMetadata = {
      evidenceId,
      providerId,
      providerName: providerName || 'Unknown Provider',
      checkDate: new Date().toISOString(),
      policyExcerpt: {
        policyId: policyExcerpt.policyId,
        policyName: policyExcerpt.policyName,
        version: policyExcerpt.version,
        excerpt: policyExcerpt.excerpt,
        effectiveDate: policyExcerpt.effectiveDate,
        applicableSections: policyExcerpt.applicableSections,
      },
      reviewerAttestation: {
        reviewerId: reviewerAttestation.reviewerId,
        reviewerName: reviewerAttestation.reviewerName,
        reviewerRole: reviewerAttestation.reviewerRole,
        reviewDate: reviewerAttestation.reviewDate,
        attestationStatement: reviewerAttestation.attestationStatement,
        signature: reviewerAttestation.signature,
        publicKey: reviewerAttestation.publicKey,
      },
      generatedAt: new Date().toISOString(),
      generatedBy: (req as any).user?.id || 'system',
    };

    // B128A-NCQA-010: Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Collect ZIP data in buffer
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    // B128A-NCQA-010: Add policy excerpt to ZIP
    archive.append(JSON.stringify(policyExcerpt, null, 2), {
      name: 'policy-excerpt.json',
    });

    // B128A-NCQA-010: Add policy excerpt hash
    archive.append(policyExcerpt.hash, {
      name: 'policy-excerpt.sha256',
    });

    // B128A-NCQA-010: Add reviewer attestation to ZIP
    archive.append(JSON.stringify(reviewerAttestation, null, 2), {
      name: 'reviewer-attestation.json',
    });

    // B128A-NCQA-010: Add attestation hash
    archive.append(reviewerAttestation.hash, {
      name: 'reviewer-attestation.sha256',
    });

    // Add metadata
    archive.append(JSON.stringify(metadata, null, 2), {
      name: 'metadata.json',
    });

    // Add README
    const readme = `# NCQA Evidence Package

Evidence ID: ${evidenceId}
Provider ID: ${providerId}
Generated: ${metadata.generatedAt}

## Contents

- policy-excerpt.json: Relevant policy sections
- policy-excerpt.sha256: SHA-256 hash of policy excerpt
- reviewer-attestation.json: Reviewer attestation with digital signature
- reviewer-attestation.sha256: SHA-256 hash of attestation
- metadata.json: Complete metadata

## Verification

To verify the integrity of this evidence package:

1. Verify policy excerpt hash:
   \`\`\`bash
   sha256sum policy-excerpt.json
   cat policy-excerpt.sha256
   \`\`\`

2. Verify attestation hash:
   \`\`\`bash
   sha256sum reviewer-attestation.json
   cat reviewer-attestation.sha256
   \`\`\`

3. Verify reviewer signature using public key in reviewer-attestation.json

## Reviewer Attestation

Reviewer: ${reviewerAttestation.reviewerName}
Role: ${reviewerAttestation.reviewerRole}
Date: ${reviewerAttestation.reviewDate}
`;

    archive.append(readme, {
      name: 'README.md',
    });

    // Finalize archive
    await archive.finalize();

    // Wait for all data to be written
    await new Promise<void>((resolve) => {
      archive.on('end', () => resolve());
    });

    // Concatenate all chunks
    const zipBuffer = Buffer.concat(chunks);

    // B128A-NCQA-010: Compute SHA-256 hash of ZIP file
    const zipSHA256 = computeFileSHA256(zipBuffer);

    console.info(`[NCQA] Evidence ZIP generated: ${evidenceId}, SHA-256: ${zipSHA256}`);

    // B128A-NCQA-010: Return SHA-256 hash and ZIP file
    res.json({
      success: true,
      evidenceId,
      sha256: zipSHA256,
      size: zipBuffer.length,
      generatedAt: metadata.generatedAt,
      policyExcerptHash: policyExcerpt.hash,
      attestationHash: reviewerAttestation.hash,
      downloadUrl: `/api/compliance/evidence-zip/${evidenceId}/download`,
    });

    // Store ZIP file for later download (in production, store in S3/cloud storage)
    // For demo, store in memory or temporary location
    // TODO: Implement actual storage
  } catch (error) {
    console.error('[NCQA] Evidence ZIP generation failed:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * B128A-NCQA-010: Download evidence ZIP by ID
 */
router.get('/evidence-zip/:evidenceId/download', async (req: Request, res: Response) => {
  const { evidenceId } = req.params;

  // TODO: Retrieve stored ZIP file
  // For demo, generate a new one (in production, retrieve from storage)

  res.status(200).json({
    message: 'ZIP download endpoint - implementation pending',
    evidenceId,
  });
});

/**
 * Verify evidence ZIP integrity
 */
router.post('/evidence-zip/:evidenceId/verify', async (req: Request, res: Response) => {
  const { evidenceId } = req.params;
  const { providedSHA256 } = req.body;

  // TODO: Retrieve stored ZIP and verify hash
  // For demo, return verification result

  res.json({
    evidenceId,
    verified: false,
    message: 'Verification endpoint - implementation pending',
  });
});

export default router;

// Export helper functions for testing
export { computeFileSHA256, createPolicyExcerpt, createReviewerAttestation };

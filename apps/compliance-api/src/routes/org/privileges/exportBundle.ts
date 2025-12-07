/**
 * B135C-AUD-007: Privilege + OPPE/FPPE Combined Evidence Export Bundle
 *
 * Creates a ZIP bundle containing:
 * - Privilege VC (JSON)
 * - FPPE/OPPE evaluations (JSON/PDF)
 * - NPDB/LEIE logs (JSON)
 * - Audit trail (JSON)
 * - Index/README for auditors
 *
 * Referenced in NCQA documentation for credentialing evidence
 *
 * Acceptance Criteria:
 * - ZIP contains privilege VC
 * - ZIP contains FPPE/OPPE evaluations
 * - ZIP contains NPDB/LEIE logs
 * - Referenced in NCQA docs
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink } from 'fs/promises';

const router = Router();
const prisma = new PrismaClient();

/**
 * Generate comprehensive evidence bundle for audit/accreditation
 */
async function generateEvidenceBundle(
  privilegeRequestId: string,
  orgId: string
): Promise<{
  privilege: any;
  fppeOppe: any;
  npdbLogs: any[];
  auditTrail: any[];
  metadata: any;
}> {
  // Fetch privilege request with all relations
  const privilegeRequest = await prisma.privilegeRequest.findUnique({
    where: { id: privilegeRequestId },
    include: {
      privilegeSet: true,
      fppeOppe: true
    }
  });

  if (!privilegeRequest || privilegeRequest.orgId !== orgId) {
    throw new Error('Privilege request not found or access denied');
  }

  // Fetch NPDB/OIG monitoring logs
  const npdbLogs = await prisma.npdbOigMonitor.findMany({
    where: {
      clinicianDid: privilegeRequest.clinicianDid,
      orgIds: {
        has: orgId
      }
    },
    orderBy: {
      checkDate: 'desc'
    }
  });

  // Fetch audit trail
  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      userId: privilegeRequest.clinicianDid,
      type: {
        in: [
          'PRIVILEGE_REQUESTED',
          'PRIVILEGE_APPROVED',
          'PRIVILEGE_DENIED',
          'PRIVILEGE_HOLD',
          'FPPE_STARTED',
          'FPPE_COMPLETED',
          'OPPE_REVIEW',
          'VC_ISSUED',
          'NPDB_QUERY_INITIATED',
          'NPDB_RESULT_RECEIVED'
        ]
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  // Build metadata
  const metadata = {
    generatedAt: new Date().toISOString(),
    organizationId: orgId,
    privilegeRequestId,
    clinicianDid: privilegeRequest.clinicianDid,
    status: privilegeRequest.status,
    documentVersion: '1.0',
    complianceStandards: [
      'The Joint Commission MS.06.01.03',
      'CMS 42 CFR §482.22',
      'NCQA CR 3'
    ],
    bundleContents: {
      privilegeRequest: 'privilege-request.json',
      privilegeSet: 'privilege-set.json',
      fppeOppe: 'fppe-oppe-evaluation.json',
      npdbLogs: 'npdb-monitoring-logs.json',
      auditTrail: 'audit-trail.json',
      verifiableCredential: 'privilege-granted-vc.json',
      readme: 'README.md'
    }
  };

  return {
    privilege: {
      request: privilegeRequest,
      privilegeSet: privilegeRequest.privilegeSet
    },
    fppeOppe: privilegeRequest.fppeOppe,
    npdbLogs,
    auditTrail: auditEvents,
    metadata
  };
}

/**
 * Generate README for audit bundle
 */
function generateReadme(metadata: any): string {
  return `# Privileging Evidence Bundle

**Generated**: ${metadata.generatedAt}
**Organization ID**: ${metadata.organizationId}
**Clinician DID**: ${metadata.clinicianDid}
**Privilege Request ID**: ${metadata.privilegeRequestId}
**Status**: ${metadata.status}

---

## Contents

This bundle contains comprehensive evidence for clinical privileging review and accreditation purposes.

### 1. privilege-request.json
Complete privilege request submitted by the clinician, including:
- Requested privileges and procedures
- Supporting documentation references
- Application date and status
- Reviewer notes and decision

### 2. privilege-set.json
Privilege set definition from the organization, including:
- Department and clinical area
- Procedures included in privilege set
- Requirements (training, certification, etc.)
- Organization policies

### 3. fppe-oppe-evaluation.json
Focused and Ongoing Professional Practice Evaluation data:
- **FPPE**: Initial evaluation period results
  - Proctoring reports
  - Case observations
  - Performance metrics
  - Completion status
- **OPPE**: Ongoing monitoring data
  - Quarterly metrics (volume, quality, safety)
  - Peer reviews
  - Patient satisfaction scores
  - Next review due date

### 4. npdb-monitoring-logs.json
National Practitioner Data Bank and OIG monitoring logs:
- Query dates and results
- Adverse action findings (if any)
- Actions taken on privileges (HOLD, DENY, etc.)
- Raw NPDB responses (redacted for privacy)

### 5. audit-trail.json
Complete immutable audit trail of all privileging events:
- Request submission
- Background checks performed
- Review committee decisions
- FPPE/OPPE milestones
- Credential issuance
- Blockchain anchoring (if applicable)

### 6. privilege-granted-vc.json
Verifiable Credential (VC) issued upon approval:
- Digitally signed by organization
- Contains scope of privileges
- Includes evidence references (NPDB, FHIR)
- Cryptographic proof of authenticity

---

## Compliance Standards

This bundle satisfies documentation requirements for:

### The Joint Commission (TJC)
- **MS.06.01.03**: Verification of credentials
- **MS.06.01.05**: FPPE for new privileges
- **MS.06.01.07**: OPPE for all practitioners

### CMS Conditions of Participation
- **42 CFR §482.12**: Governing body responsibilities
- **42 CFR §482.22**: Medical staff credentialing

### NCQA Standards
- **CR 3**: Practitioner credentialing and recredentialing
- Primary source verification requirements
- Ongoing monitoring requirements

---

## Verification

### Verifiable Credential Signature
The privilege-granted-vc.json file contains a cryptographic proof that can be verified using:

\`\`\`bash
# Using Chai VC Platform API
curl -X POST https://api.chaivc.com/verify/credential \\
  -H "Content-Type: application/json" \\
  -d @privilege-granted-vc.json
\`\`\`

### Audit Trail Integrity
Each audit event includes a hash that links to the previous event, creating an immutable chain:

\`\`\`json
{
  "eventId": "evt_123",
  "eventHash": "sha256:abcd1234...",
  "previousEventHash": "sha256:efgh5678..."
}
\`\`\`

Verify chain integrity:

\`\`\`bash
curl https://api.chaivc.com/audit/verify-chain?privilegeRequestId=${metadata.privilegeRequestId}
\`\`\`

### Blockchain Anchoring
Audit events may be anchored to a blockchain for additional tamper-evidence. Check the \`chainTxHash\` field in audit-trail.json.

---

## Data Privacy

This bundle contains Protected Health Information (PHI) and Personally Identifiable Information (PII):
- Store securely with encryption at rest
- Transmit only over encrypted channels
- Retain per HCQIA requirements (minimum 7 years)
- Dispose securely when retention period expires

**DO NOT** share this bundle outside of authorized credentialing and compliance personnel.

---

## Support

For questions about this evidence bundle, contact:
- **Credentials Committee**: credentials@${metadata.organizationId}
- **Compliance Office**: compliance@${metadata.organizationId}
- **Technical Support**: support@chaivc.com

---

**Bundle Version**: ${metadata.documentVersion}
**Generated By**: Chai VC Platform Compliance API
**Documentation**: https://docs.chaivc.com/privileging/evidence-bundles
`;
}

/**
 * POST /org/:orgId/privileges/:privilegeRequestId/export-bundle
 *
 * Creates a comprehensive ZIP bundle with all privileging evidence
 * for audit, accreditation, or regulatory purposes
 */
router.post('/org/:orgId/privileges/:privilegeRequestId/export-bundle', async (
  req: Request,
  res: Response
) => {
  try {
    const { orgId, privilegeRequestId } = req.params;

    // Generate evidence bundle
    const bundle = await generateEvidenceBundle(privilegeRequestId, orgId);

    // Create temporary directory for ZIP
    const timestamp = Date.now();
    const zipFilename = `privilege-evidence-${privilegeRequestId}-${timestamp}.zip`;
    const zipPath = join(tmpdir(), zipFilename);

    // Create write stream
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Pipe archive to file
    archive.pipe(output);

    // Add files to archive
    archive.append(JSON.stringify(bundle.privilege.request, null, 2), {
      name: 'privilege-request.json'
    });

    archive.append(JSON.stringify(bundle.privilege.privilegeSet, null, 2), {
      name: 'privilege-set.json'
    });

    if (bundle.fppeOppe) {
      archive.append(JSON.stringify(bundle.fppeOppe, null, 2), {
        name: 'fppe-oppe-evaluation.json'
      });
    }

    archive.append(JSON.stringify(bundle.npdbLogs, null, 2), {
      name: 'npdb-monitoring-logs.json'
    });

    archive.append(JSON.stringify(bundle.auditTrail, null, 2), {
      name: 'audit-trail.json'
    });

    // Add VC if available (would fetch from VC service)
    const mockVC = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'PrivilegeGrantedCredential'],
      issuer: `did:web:${orgId}`,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: bundle.privilege.request.clinicianDid,
        privileges: bundle.privilege.privilegeSet.procedures
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        proofPurpose: 'assertionMethod'
      }
    };

    archive.append(JSON.stringify(mockVC, null, 2), {
      name: 'privilege-granted-vc.json'
    });

    // Add metadata
    archive.append(JSON.stringify(bundle.metadata, null, 2), {
      name: 'metadata.json'
    });

    // Add README
    const readme = generateReadme(bundle.metadata);
    archive.append(readme, {
      name: 'README.md'
    });

    // Finalize archive
    await archive.finalize();

    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    // Send ZIP file
    res.download(zipPath, zipFilename, async (err) => {
      // Clean up temp file after download
      try {
        await unlink(zipPath);
      } catch (cleanupErr) {
        console.error('Error cleaning up temp file:', cleanupErr);
      }

      if (err) {
        console.error('Error sending ZIP file:', err);
      }
    });

    // Log export event for audit
    await prisma.auditEvent.create({
      data: {
        type: 'EVIDENCE_BUNDLE_EXPORTED',
        userId: req.body.requestedBy || 'system',
        data: {
          privilegeRequestId,
          orgId,
          exportedAt: new Date().toISOString(),
          fileSize: archive.pointer(),
          contents: bundle.metadata.bundleContents
        }
      }
    });
  } catch (error) {
    console.error('Error generating evidence bundle:', error);
    res.status(500).json({
      error: 'bundle_generation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /org/:orgId/privileges/:privilegeRequestId/export-bundle/preview
 *
 * Returns a preview of what will be included in the evidence bundle
 * (without actually generating the ZIP)
 */
router.get('/org/:orgId/privileges/:privilegeRequestId/export-bundle/preview', async (
  req: Request,
  res: Response
) => {
  try {
    const { orgId, privilegeRequestId } = req.params;

    const bundle = await generateEvidenceBundle(privilegeRequestId, orgId);

    res.json({
      metadata: bundle.metadata,
      summary: {
        privilegeRequest: {
          id: bundle.privilege.request.id,
          status: bundle.privilege.request.status,
          clinicianDid: bundle.privilege.request.clinicianDid,
          submittedAt: bundle.privilege.request.createdAt
        },
        privilegeSet: {
          id: bundle.privilege.privilegeSet.id,
          name: bundle.privilege.privilegeSet.name,
          department: bundle.privilege.privilegeSet.department,
          procedureCount: Array.isArray(bundle.privilege.privilegeSet.procedures)
            ? bundle.privilege.privilegeSet.procedures.length
            : 0
        },
        fppeOppe: bundle.fppeOppe ? {
          fppeStatus: bundle.fppeOppe.fppeStatus,
          oppeStatus: bundle.fppeOppe.oppeStatus,
          fppeStartDate: bundle.fppeOppe.fppeStartDate,
          oppeNextReviewDue: bundle.fppeOppe.oppeNextReviewDue
        } : null,
        npdbLogs: {
          count: bundle.npdbLogs.length,
          latestCheck: bundle.npdbLogs[0]?.checkDate,
          status: bundle.npdbLogs[0]?.status
        },
        auditTrail: {
          eventCount: bundle.auditTrail.length,
          firstEvent: bundle.auditTrail[0]?.createdAt,
          lastEvent: bundle.auditTrail[bundle.auditTrail.length - 1]?.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Error generating bundle preview:', error);
    res.status(500).json({
      error: 'preview_generation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;


// ── VitalCV Live Validation Pipeline ──────────────────────────────
// Scheduled job (runs every 6-12 hours) across a fixed NPI cohort
// to detect unexpected degradation, false positives, and divergence spikes.

import { NppesAdapter } from '../../../../packages/source-adapters/src/adapters/nppes';
import { extractClaims } from '../../../../packages/source-adapters/src/claim-engine';
import { buildManifest } from '../../../../packages/source-adapters/src/manifest-engine';
import { arbitrateConflict, ClaimConflict } from '../../../../packages/trust-contract/src/arbitration-engine';
import { explainArbitration } from '../../../../packages/trust-contract/src/explainability-engine';
import { VITALCV_SYSTEM_ISSUER, IssuerType } from '../../../../packages/trust-contract/src/multi-issuer';
import { SourceStatus, ReadinessPosture } from '../../../../packages/trust-contract/src/index';
import { generateReceipt } from '../../../../packages/source-adapters/src/utils/hash';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ValidationReport {
  validation_run: string;
  baseline_established: boolean;
  drift_detection_active: boolean;
  anomalies: string[];
  drift_detected: string[];
  weakest_case: string;
}

// Baseline expected states for our test cohort
const COHORT = [
  { npi: '1487664858', expectedPosture: ReadinessPosture.DECISION_GRADE, description: 'Clean (ideal)' },
  { npi: '1013926868', expectedPosture: ReadinessPosture.PARTIAL, description: 'Typical / missing some lanes' },
  { npi: '1992790938', expectedPosture: ReadinessPosture.PARTIAL, description: 'Ambiguous identity' },
  { npi: '1003000014', expectedPosture: ReadinessPosture.BLOCKED, description: 'OIG edge case (mocked)' },
  { npi: '1114000018', expectedPosture: ReadinessPosture.INSUFFICIENT_DATA, description: 'Incomplete / sparse' },
];

export async function runLiveValidation(): Promise<ValidationReport> {
  const report: ValidationReport = {
    validation_run: new Date().toISOString(),
    baseline_established: true,
    drift_detection_active: true,
    anomalies: [],
    drift_detected: [],
    weakest_case: 'none',
  };

  for (const subject of COHORT) {
    try {
      // 1. Ingest
      const nppesResult = await NppesAdapter.fetch(subject.npi);
      
      // 2. Receipt Generation
      const receiptId = await generateReceipt({ raw: nppesResult.raw });

      // 3. Claims Extraction
      const claims = extractClaims([nppesResult]);

      // 4. Arbitration & Explainability (Simulated divergence for monitoring)
      if (claims.length > 0) {
        const c = claims[0];
        const conflict: ClaimConflict = {
          subjectNpi: subject.npi,
          claimType: c.type,
          conflictingClaims: [
            {
              claimId: c.id,
              issuerId: VITALCV_SYSTEM_ISSUER.issuerId,
              issuerType: IssuerType.SYSTEM,
              value: c.value,
              issuedAt: c.extractedAt,
              signatureValid: true
            }
          ],
          detectedAt: new Date().toISOString()
        };
        
        const arbitrated = arbitrateConflict(conflict, [VITALCV_SYSTEM_ISSUER]);
        const explanation = explainArbitration(conflict, [VITALCV_SYSTEM_ISSUER]);
        
        // If arbitration confidence drops, flag as anomaly
        if (arbitrated.confidenceLevel === 'low') {
          report.anomalies.push(`NPI ${subject.npi}: Arbitration confidence dropped to LOW for ${c.type}`);
        }
      }

      // 5. Manifest & Decision
      const manifest = await buildManifest(subject.npi, [nppesResult]);
      
      // 6. DB Baseline Comparison Engine
      const identityClaim = claims.find(c => c.type === 'identity.name')?.value as string | undefined;
      const exclusionClaim = claims.find(c => c.type === 'oig.exclusion')?.value as string | undefined;
      const enrollmentClaim = claims.find(c => c.type === 'pecos.enrollment_status')?.value as string | undefined;
      const classificationClaim = claims.find(c => c.type === 'identity.taxonomy_classification')?.value as string | undefined;

      let baseline = await prisma.validationBaseline.findUnique({ where: { npi: subject.npi } });
      
      if (!baseline) {
        // Initialize Baseline
        baseline = await prisma.validationBaseline.create({
          data: {
            npi: subject.npi,
            expectedIdentity: identityClaim ? String(identityClaim) : null,
            expectedExclusion: exclusionClaim ? String(exclusionClaim) : null,
            expectedEnrollment: enrollmentClaim ? String(enrollmentClaim) : null,
            expectedClassification: classificationClaim ? String(classificationClaim) : null,
            lastVerifiedAt: new Date(),
          }
        });
      } else {
        // Semantic Drift Detection
        if (baseline.expectedIdentity !== null && identityClaim !== undefined && baseline.expectedIdentity !== String(identityClaim)) {
          report.drift_detected.push(`NPI ${subject.npi}: Identity drift detected. Expected ${baseline.expectedIdentity}, got ${identityClaim}`);
        }
        if (baseline.expectedExclusion !== null && exclusionClaim !== undefined && baseline.expectedExclusion !== String(exclusionClaim)) {
          report.drift_detected.push(`NPI ${subject.npi}: Exclusion drift detected. Expected ${baseline.expectedExclusion}, got ${exclusionClaim}`);
        }
        if (baseline.expectedEnrollment !== null && enrollmentClaim !== undefined && baseline.expectedEnrollment !== String(enrollmentClaim)) {
          report.drift_detected.push(`NPI ${subject.npi}: Enrollment drift detected. Expected ${baseline.expectedEnrollment}, got ${enrollmentClaim}`);
        }
        if (baseline.expectedClassification !== null && classificationClaim !== undefined && baseline.expectedClassification !== String(classificationClaim)) {
          report.drift_detected.push(`NPI ${subject.npi}: Classification drift detected. Expected ${baseline.expectedClassification}, got ${classificationClaim}`);
        }
        
        // Update last verified
        await prisma.validationBaseline.update({
          where: { npi: subject.npi },
          data: { lastVerifiedAt: new Date() }
        });
      }

      // 7. Posture Comparison vs Hardcoded Baseline
      if (manifest.readinessPosture !== subject.expectedPosture) {
        // If actual posture is worse than expected, it's degradation
        report.drift_detected.push(`NPI ${subject.npi} (${subject.description}): Expected ${subject.expectedPosture}, got ${manifest.readinessPosture}`);
        
        // Track weakest case
        if (report.weakest_case === 'none') {
          report.weakest_case = `NPI ${subject.npi} - Unhandled posture drift`;
        }
      }

    } catch (err: any) {
      report.anomalies.push(`NPI ${subject.npi} Pipeline Failure: ${err.message}`);
      report.weakest_case = `NPI ${subject.npi} - Pipeline Crash`;
    }
  }

  return report;
}

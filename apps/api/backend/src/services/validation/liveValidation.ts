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

export interface ValidationReport {
  validation_run: string;
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
      
      // 6. Compare Output vs Baseline
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

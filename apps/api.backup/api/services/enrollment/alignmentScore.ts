/**
 * B212B-ENROLL-010: Alignment Score (PECOS ↔ Medicaid ↔ Payers)
 *
 * Detects misalignments between enrollment systems and reduces score accordingly.
 * Example: PECOS enrolled but Medicaid terminated
 */

import type { PECOSEnrollment } from './enrollmentCompleteness.js';
import type { MedicaidEnrollment } from './enrollmentCompleteness.js';
import type { PayerEnrollment } from './enrollmentCompleteness.js';

export interface AlignmentScoreResult {
  score: number; // 0-1, where 1 is perfect alignment
  misalignments: AlignmentIssue[];
}

export interface AlignmentIssue {
  type: 'PECOS_MEDICAID' | 'PECOS_PAYER' | 'MEDICAID_PAYER' | 'MULTIPLE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  impact: number; // 0-1, how much this reduces the score
}

/**
 * Calculate alignment score between PECOS, Medicaid, and Payer enrollments
 */
export function calculateAlignmentScore(input: {
  pecos?: PECOSEnrollment | null;
  medicaid?: MedicaidEnrollment[];
  payers?: PayerEnrollment[];
}): AlignmentScoreResult {
  const misalignments: AlignmentIssue[] = [];

  // Check PECOS ↔ Medicaid alignment
  if (input.pecos && input.medicaid && input.medicaid.length > 0) {
    const pecosActive = isPecosActive(input.pecos);
    const medicaidActive = input.medicaid.some((m) => m.status === 'ENROLLED');

    if (pecosActive && !medicaidActive) {
      misalignments.push({
        type: 'PECOS_MEDICAID',
        severity: 'HIGH',
        description: 'PECOS enrolled but Medicaid not enrolled',
        impact: 0.2,
      });
    }

    if (!pecosActive && medicaidActive) {
      misalignments.push({
        type: 'PECOS_MEDICAID',
        severity: 'MEDIUM',
        description: 'Medicaid enrolled but PECOS not active',
        impact: 0.15,
      });
    }
  }

  // Check PECOS ↔ Payer alignment
  if (input.pecos && input.payers && input.payers.length > 0) {
    const pecosActive = isPecosActive(input.pecos);
    const requiredPayersEnrolled = input.payers.filter(
      (p) => p.isRequired && p.status === 'ENROLLED'
    );

    if (pecosActive && requiredPayersEnrolled.length === 0) {
      misalignments.push({
        type: 'PECOS_PAYER',
        severity: 'HIGH',
        description: 'PECOS enrolled but no required payers enrolled',
        impact: 0.25,
      });
    }

    // Check for terminated payers when PECOS is active
    const terminatedPayers = input.payers.filter(
      (p) => p.isRequired && (p.status === 'REJECTED' || p.status === 'PANEL_FULL')
    );
    if (pecosActive && terminatedPayers.length > 0) {
      misalignments.push({
        type: 'PECOS_PAYER',
        severity: 'MEDIUM',
        description: `PECOS active but ${terminatedPayers.length} required payer(s) terminated`,
        impact: 0.1 * terminatedPayers.length,
      });
    }
  }

  // Check Medicaid ↔ Payer alignment
  if (input.medicaid && input.medicaid.length > 0 && input.payers && input.payers.length > 0) {
    const medicaidActive = input.medicaid.some((m) => m.status === 'ENROLLED');
    const requiredPayersEnrolled = input.payers.filter(
      (p) => p.isRequired && p.status === 'ENROLLED'
    );

    if (medicaidActive && requiredPayersEnrolled.length === 0) {
      misalignments.push({
        type: 'MEDICAID_PAYER',
        severity: 'MEDIUM',
        description: 'Medicaid enrolled but no required payers enrolled',
        impact: 0.15,
      });
    }
  }

  // Check for multiple misalignments (critical)
  if (misalignments.length >= 2) {
    const criticalMisalignment: AlignmentIssue = {
      type: 'MULTIPLE',
      severity: 'CRITICAL',
      description: `Multiple enrollment misalignments detected (${misalignments.length} issues)`,
      impact: 0.3,
    };
    misalignments.push(criticalMisalignment);
  }

  // Calculate score: start at 1.0 and subtract impact of each misalignment
  let score = 1.0;
  for (const issue of misalignments) {
    score = Math.max(0, score - issue.impact);
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    misalignments,
  };
}

/**
 * Check if PECOS enrollment is considered active
 */
function isPecosActive(pecos: PECOSEnrollment): boolean {
  if (pecos.status === 'ENROLLED') {
    // Check if expired
    if (pecos.expiryDate && pecos.expiryDate < new Date()) {
      return false;
    }
    return true;
  }
  if (pecos.status === 'PENDING' || pecos.status === 'REVALIDATION_DUE') {
    return true; // Consider pending/revalidation as active
  }
  return false;
}


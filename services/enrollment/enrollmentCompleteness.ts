/**
 * B212B-ENROLL-006: EnrollmentCompletenessCalculator (Rewritten)
 *
 * Scores PECOS+Medicaid+payer readiness with configurable weights.
 * Includes state-specific Medicaid rules, PECOS v2 status mapping,
 * payer network mismatch penalties, and alignment scoring.
 */

import { getPecosStatusScore } from './pecosStatusMap.js';
import {
  getMedicaidPenaltyMultiplier,
  requiresMedicaidForSpecialty,
  stateRequiresMedicaid,
} from './stateRules/medicaidRules.js';
import { calculateAlignmentScore } from './alignmentScore.js';
import type { PayerNetworkGraph } from '../payer/networkGraph.js';

/**
 * Weight constants for enrollment completeness calculation
 * These can be adjusted to change the relative importance of each component
 */
export const ENROLLMENT_WEIGHTS = {
  PECOS: 0.4,
  MEDICAID: 0.2,
  REQUIRED_PAYERS: 0.3,
  OPTIONAL_PAYERS: 0.1,
} as const;

export interface PECOSEnrollment {
  status: 'ENROLLED' | 'PENDING' | 'DEACTIVATED' | 'REVOKED' | 'REVALIDATION_DUE' | 'UNKNOWN';
  enrollmentDate?: Date;
  expiryDate?: Date;
}

export interface MedicaidEnrollment {
  state: string;
  status: 'ENROLLED' | 'PENDING' | 'REJECTED' | 'UNKNOWN';
  enrollmentDate?: Date;
  expiryDate?: Date;
}

export interface PayerEnrollment {
  payerId: string;
  payerName: string;
  status: 'ENROLLED' | 'PENDING' | 'REJECTED' | 'PANEL_FULL' | 'UNKNOWN';
  enrollmentDate?: Date;
  expiryDate?: Date;
  isRequired?: boolean; // Whether this payer is required for the clinician's practice
}

export interface EnrollmentCompletenessInput {
  pecos?: PECOSEnrollment | null;
  medicaid?: MedicaidEnrollment[];
  payers?: PayerEnrollment[];
  // Optional context for advanced scoring
  practiceStates?: string[]; // States where the clinician practices
  specialty?: string; // Clinician's specialty code
  payerNetworkGraph?: PayerNetworkGraph | null; // For network mismatch penalty
}

export interface EnrollmentCompletenessResult {
  completeness: number; // 0-1 normalized score
  pecosScore: number; // 0-1
  medicaidScore: number; // 0-1
  requiredPayerScore: number; // 0-1
  optionalPayerScore: number; // 0-1
  alignmentScore: number; // 0-1, from alignmentScore.ts
  networkMismatchPenalty: number; // 0-1, penalty applied (0 = no penalty, 1 = max penalty)
  missingRequiredPayers: string[]; // List of required payers that are missing
  missingRequiredMedicaid: string[]; // States requiring Medicaid but not enrolled
  breakdown: {
    pecos: { status: string; score: number };
    medicaid: { enrolledStates: number; totalStates: number; score: number; penaltyApplied: boolean };
    requiredPayers: { enrolled: number; required: number; score: number };
    optionalPayers: { enrolled: number; total: number; score: number };
    alignment: { score: number; misalignments: number };
    networkMismatch: { penalty: number; coverageRatio?: number };
  };
}

/**
 * Calculate enrollment completeness with new weights and features
 */
export class EnrollmentCompletenessCalculator {
  /**
   * Score PECOS enrollment using PECOS v2 status mapping
   */
  private scorePECOS(pecos: PECOSEnrollment | null): number {
    if (!pecos) return 0;
    return getPecosStatusScore(pecos.status);
  }

  /**
   * Score Medicaid enrollment with state-specific rules
   */
  private scoreMedicaid(
    medicaidEnrollments: MedicaidEnrollment[],
    practiceStates?: string[],
    specialty?: string
  ): {
    score: number;
    enrolledStates: number;
    totalStates: number;
    penaltyApplied: boolean;
    missingRequired: string[];
  } {
    if (medicaidEnrollments.length === 0) {
      const requiredStates = practiceStates?.filter((state) =>
        stateRequiresMedicaid(state)
      ) ?? [];
      return {
        score: requiredStates.length > 0 ? 0 : 0,
        enrolledStates: 0,
        totalStates: 0,
        penaltyApplied: requiredStates.length > 0,
        missingRequired: requiredStates,
      };
    }

    const stateSet = new Set(medicaidEnrollments.map((m) => m.state));
    const totalStates = stateSet.size;

    if (totalStates === 0) {
      return { score: 0, enrolledStates: 0, totalStates: 0, penaltyApplied: false, missingRequired: [] };
    }

    let enrolledCount = 0;
    let pendingCount = 0;
    const missingRequired: string[] = [];

    // Check for required Medicaid enrollments
    const statesToCheck = practiceStates ?? Array.from(stateSet);
    for (const state of statesToCheck) {
      if (requiresMedicaidForSpecialty(state, specialty)) {
        const enrollment = medicaidEnrollments.find((m) => m.state.toUpperCase() === state.toUpperCase());
        if (!enrollment || enrollment.status !== 'ENROLLED') {
          missingRequired.push(state);
        }
      }
    }

    for (const enrollment of medicaidEnrollments) {
      switch (enrollment.status) {
        case 'ENROLLED':
          // Check if expired
          if (enrollment.expiryDate && enrollment.expiryDate < new Date()) {
            pendingCount++; // Expired counts as pending
          } else {
            enrolledCount++;
          }
          break;
        case 'PENDING':
          pendingCount++;
          break;
        case 'REJECTED':
          // Rejected doesn't count
          break;
        case 'UNKNOWN':
          pendingCount += 0.5; // Partial credit
          break;
      }
    }

    // Score: full credit for enrolled, half credit for pending
    let score = (enrolledCount + pendingCount * 0.5) / totalStates;

    // Apply state-specific penalty if required Medicaid is missing
    if (missingRequired.length > 0) {
      const penaltyMultiplier = getMedicaidPenaltyMultiplier(
        missingRequired[0],
        specialty ?? null,
        false
      );
      score *= penaltyMultiplier;
    }

    return {
      score: Math.min(1, score),
      enrolledStates: enrolledCount,
      totalStates,
      penaltyApplied: missingRequired.length > 0,
      missingRequired,
    };
  }

  /**
   * Score payer enrollments (separate required and optional)
   */
  private scorePayers(payerEnrollments: PayerEnrollment[]): {
    requiredScore: number;
    optionalScore: number;
    requiredEnrolled: number;
    optionalEnrolled: number;
    enrolled: number;
    required: number;
    total: number;
    missingRequired: string[];
  } {
    if (payerEnrollments.length === 0) {
      return {
        requiredScore: 0,
        optionalScore: 0,
        requiredEnrolled: 0,
        optionalEnrolled: 0,
        enrolled: 0,
        required: 0,
        total: 0,
        missingRequired: [],
      };
    }

    const requiredPayers = payerEnrollments.filter((p) => p.isRequired === true);
    const optionalPayers = payerEnrollments.filter((p) => p.isRequired !== true);
    const totalRequired = requiredPayers.length;
    const totalOptional = optionalPayers.length;
    const totalPayers = payerEnrollments.length;

    let requiredEnrolledCount = 0;
    let optionalEnrolledCount = 0;
    const missingRequired: string[] = [];

    for (const payer of requiredPayers) {
      const isEnrolled =
        payer.status === 'ENROLLED' && (!payer.expiryDate || payer.expiryDate >= new Date());

      if (isEnrolled) {
        requiredEnrolledCount++;
      } else {
        missingRequired.push(payer.payerName || payer.payerId);
      }
    }

    for (const payer of optionalPayers) {
      const isEnrolled =
        payer.status === 'ENROLLED' && (!payer.expiryDate || payer.expiryDate >= new Date());

      if (isEnrolled) {
        optionalEnrolledCount++;
      }
    }

    const requiredScore = totalRequired > 0 ? requiredEnrolledCount / totalRequired : 0;
    const optionalScore = totalOptional > 0 ? optionalEnrolledCount / totalOptional : 0;

    return {
      requiredScore: Math.min(1, requiredScore),
      optionalScore: Math.min(1, optionalScore),
      requiredEnrolled: requiredEnrolledCount,
      optionalEnrolled: optionalEnrolledCount,
      enrolled: requiredEnrolledCount + optionalEnrolledCount,
      required: totalRequired,
      total: totalPayers,
      missingRequired,
    };
  }

  /**
   * Calculate payer network mismatch penalty
   * If clinician payer coverage < region baseline, apply penalty
   */
  private calculateNetworkMismatchPenalty(
    payerNetworkGraph: PayerNetworkGraph | null | undefined,
    payerEnrollments: PayerEnrollment[]
  ): { penalty: number; coverageRatio?: number } {
    if (!payerNetworkGraph) {
      return { penalty: 0 };
    }

    // Calculate clinician's coverage ratio
    const enrolledPayers = payerEnrollments.filter(
      (p) => p.status === 'ENROLLED' && (!p.expiryDate || p.expiryDate >= new Date())
    ).length;
    const totalPayers = payerEnrollments.length;
    const clinicianCoverage = totalPayers > 0 ? enrolledPayers / totalPayers : 0;

    // Calculate baseline coverage from network graph
    // Use summary.activeEnrollments / summary.totalPayers as baseline
    const baselineCoverage =
      payerNetworkGraph.summary.totalPayers > 0
        ? payerNetworkGraph.summary.activeEnrollments / payerNetworkGraph.summary.totalPayers
        : 0.8; // Default baseline of 80%

    // If clinician coverage is below baseline, apply penalty
    if (clinicianCoverage < baselineCoverage) {
      const gap = baselineCoverage - clinicianCoverage;
      // Penalty is proportional to the gap, max 0.3 (30% reduction)
      const penalty = Math.min(0.3, gap * 0.5);
      return { penalty, coverageRatio: clinicianCoverage };
    }

    return { penalty: 0, coverageRatio: clinicianCoverage };
  }

  /**
   * Calculate overall enrollment completeness
   */
  calculate(input: EnrollmentCompletenessInput): EnrollmentCompletenessResult {
    const pecosScore = this.scorePECOS(input.pecos || null);
    const medicaidResult = this.scoreMedicaid(
      input.medicaid || [],
      input.practiceStates,
      input.specialty
    );
    const payerResult = this.scorePayers(input.payers || []);

    // Calculate alignment score
    const alignmentResult = calculateAlignmentScore({
      pecos: input.pecos || null,
      medicaid: input.medicaid,
      payers: input.payers,
    });

    // Calculate network mismatch penalty
    const networkMismatch = this.calculateNetworkMismatchPenalty(
      input.payerNetworkGraph,
      input.payers || []
    );

    // Calculate weighted scores
    const requiredPayerWeighted = payerResult.requiredScore * ENROLLMENT_WEIGHTS.REQUIRED_PAYERS;
    const optionalPayerWeighted = payerResult.optionalScore * ENROLLMENT_WEIGHTS.OPTIONAL_PAYERS;
    const pecosWeighted = pecosScore * ENROLLMENT_WEIGHTS.PECOS;
    const medicaidWeighted = medicaidResult.score * ENROLLMENT_WEIGHTS.MEDICAID;

    // Base completeness before penalties
    let completeness =
      pecosWeighted + medicaidWeighted + requiredPayerWeighted + optionalPayerWeighted;

    // Apply alignment penalty (reduces score based on misalignments)
    completeness *= alignmentResult.score;

    // Apply network mismatch penalty
    completeness *= 1 - networkMismatch.penalty;

    // Apply Medicaid penalty if required Medicaid is missing
    if (medicaidResult.penaltyApplied) {
      // Already applied in medicaidResult.score, but ensure it's reflected
      completeness = Math.max(0, completeness);
    }

    return {
      completeness: Math.min(1, Math.max(0, completeness)),
      pecosScore,
      medicaidScore: medicaidResult.score,
      requiredPayerScore: payerResult.requiredScore,
      optionalPayerScore: payerResult.optionalScore,
      alignmentScore: alignmentResult.score,
      networkMismatchPenalty: networkMismatch.penalty,
      missingRequiredPayers: payerResult.missingRequired,
      missingRequiredMedicaid: medicaidResult.missingRequired,
      breakdown: {
        pecos: {
          status: input.pecos?.status || 'UNKNOWN',
          score: pecosScore,
        },
        medicaid: {
          enrolledStates: medicaidResult.enrolledStates,
          totalStates: medicaidResult.totalStates,
          score: medicaidResult.score,
          penaltyApplied: medicaidResult.penaltyApplied,
        },
        requiredPayers: {
          enrolled: payerResult.requiredEnrolled,
          required: payerResult.required,
          score: payerResult.requiredScore,
        },
        optionalPayers: {
          enrolled: payerResult.optionalEnrolled,
          total: payerResult.total - payerResult.required,
          score: payerResult.optionalScore,
        },
        alignment: {
          score: alignmentResult.score,
          misalignments: alignmentResult.misalignments.length,
        },
        networkMismatch: {
          penalty: networkMismatch.penalty,
          coverageRatio: networkMismatch.coverageRatio,
        },
      },
    };
  }
}

/**
 * Default calculator instance
 */
export const enrollmentCompletenessCalculator = new EnrollmentCompletenessCalculator();


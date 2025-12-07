/**
 * B205A-CCI-003: CaseComplexityCalculator
 *
 * Weights procedures by risk/complexity using privilege code categories.
 * Integrates safety signals + outcomes.
 */

import type { PrivilegeCategory } from '@prisma/client';

/**
 * Risk/complexity weights by privilege category
 */
const CATEGORY_WEIGHTS: Record<PrivilegeCategory, number> = {
  surgical: 1.0, // Highest complexity
  procedural: 0.7, // Medium-high complexity
  diagnostic: 0.4, // Medium complexity
  admin: 0.1, // Lowest complexity
};

/**
 * Safety signal severity weights
 */
const SAFETY_SIGNAL_WEIGHTS = {
  CRITICAL: 1.0,
  HIGH: 0.7,
  MED: 0.4,
  LOW: 0.1,
} as const;

export interface ProcedureCase {
  privilegeCode: string;
  category: PrivilegeCategory;
  caseCount: number;
  complicationCount?: number;
  safetySignals?: Array<{
    severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
    type: string;
  }>;
  outcomes?: {
    successRate?: number; // 0-1
    adverseEvents?: number;
  };
}

export interface CaseComplexityResult {
  complexityIndex: number; // 0-1 normalized
  weightedCaseVolume: number;
  totalCases: number;
  totalComplications: number;
  safetySignalCount: number;
  breakdown: {
    byCategory: Record<PrivilegeCategory, { cases: number; weighted: number }>;
  };
}

/**
 * Calculate case complexity index
 */
export class CaseComplexityCalculator {
  /**
   * Calculate complexity for a set of procedures/cases
   */
  calculate(procedures: ProcedureCase[]): CaseComplexityResult {
    if (procedures.length === 0) {
      return {
        complexityIndex: 0,
        weightedCaseVolume: 0,
        totalCases: 0,
        totalComplications: 0,
        safetySignalCount: 0,
        breakdown: {
          byCategory: {
            surgical: { cases: 0, weighted: 0 },
            procedural: { cases: 0, weighted: 0 },
            diagnostic: { cases: 0, weighted: 0 },
            admin: { cases: 0, weighted: 0 },
          },
        },
      };
    }

    let totalCases = 0;
    let totalComplications = 0;
    let weightedCaseVolume = 0;
    let safetySignalCount = 0;
    const categoryBreakdown: Record<PrivilegeCategory, { cases: number; weighted: number }> = {
      surgical: { cases: 0, weighted: 0 },
      procedural: { cases: 0, weighted: 0 },
      diagnostic: { cases: 0, weighted: 0 },
      admin: { cases: 0, weighted: 0 },
    };

    for (const procedure of procedures) {
      const categoryWeight = CATEGORY_WEIGHTS[procedure.category];
      const caseCount = procedure.caseCount || 0;
      const complicationCount = procedure.complicationCount || 0;

      totalCases += caseCount;
      totalComplications += complicationCount;

      // Weight cases by category complexity
      const weightedCases = caseCount * categoryWeight;
      weightedCaseVolume += weightedCases;

      // Track by category
      categoryBreakdown[procedure.category].cases += caseCount;
      categoryBreakdown[procedure.category].weighted += weightedCases;

      // Count safety signals with severity weighting
      if (procedure.safetySignals) {
        for (const signal of procedure.safetySignals) {
          const signalWeight = SAFETY_SIGNAL_WEIGHTS[signal.severity];
          safetySignalCount += signalWeight;
        }
      }

      // Adjust for outcomes if available
      if (procedure.outcomes) {
        const successRate = procedure.outcomes.successRate ?? 1.0;
        const adverseEvents = procedure.outcomes.adverseEvents || 0;

        // Reduce complexity score for poor outcomes
        if (successRate < 0.7) {
          weightedCaseVolume *= 0.8; // Penalize poor success rate
        }

        // Increase complexity perception for adverse events
        if (adverseEvents > 0) {
          weightedCaseVolume += adverseEvents * 0.1;
        }
      }
    }

    // Normalize complexity index (0-1)
    // Use logarithmic scaling to handle wide ranges
    const maxExpectedWeightedVolume = 1000; // Adjust based on typical max
    const rawComplexity = Math.min(1, weightedCaseVolume / maxExpectedWeightedVolume);

    // Apply logarithmic scaling for better distribution
    const complexityIndex = Math.log10(1 + rawComplexity * 9) / Math.log10(10);

    // Normalize safety signals (0-1)
    const maxSafetySignals = 20; // Max expected weighted signals
    const normalizedSafetySignals = Math.min(1, safetySignalCount / maxSafetySignals);

    // Combine complexity with safety signals
    // Higher safety signals increase perceived complexity
    const finalComplexityIndex = Math.min(1, complexityIndex * 0.7 + normalizedSafetySignals * 0.3);

    return {
      complexityIndex: finalComplexityIndex,
      weightedCaseVolume,
      totalCases,
      totalComplications,
      safetySignalCount,
      breakdown: {
        byCategory: categoryBreakdown,
      },
    };
  }

  /**
   * Calculate complexity for a single procedure
   */
  calculateSingle(procedure: ProcedureCase): number {
    const result = this.calculate([procedure]);
    return result.complexityIndex;
  }
}

/**
 * Default calculator instance
 */
export const caseComplexityCalculator = new CaseComplexityCalculator();


/**
 * B207B-LIFE-008: WhatIfLifecycleEngine
 *
 * Simulates interventions: renew license, expand privileges, improve OPPE, fix enrollment;
 * updates future state projections based on intervention scenarios.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import type {
  ClinicianCurrentState,
  FutureStateProbabilities,
} from '../model/transitionModel.js';
import { calculateTransitionProbabilities } from '../model/transitionModel.js';
import type { TrajectorySimulationResult } from './trajectorySimulator.js';
import { simulateTrajectories } from './trajectorySimulator.js';

const prisma = new PrismaClient();
const log = getServiceLogger('services/lifecycle/whatIf');

export type InterventionType =
  | 'renew_license'
  | 'expand_privileges'
  | 'improve_oppe'
  | 'fix_enrollment'
  | 'complete_fppe'
  | 'renew_credential'
  | 'improve_safety_score'
  | 'revalidate_pecos';

export interface Intervention {
  type: InterventionType;
  description: string;
  parameters?: Record<string, unknown>;
  expectedImpact?: {
    riskReduction?: number; // 0-1
    privilegeReadinessIncrease?: number; // 0-1
    enrollmentStabilityIncrease?: number; // 0-1
    safetyScoreIncrease?: number; // 0-100
    oppeTrendImprovement?: number; // -1 to 1
  };
}

export interface WhatIfScenario {
  scenarioId: string;
  clinicianId: string;
  baselineState: ClinicianCurrentState;
  baselineProjections: FutureStateProbabilities;
  interventions: Intervention[];
  projectedState: ClinicianCurrentState;
  projectedProjections: FutureStateProbabilities;
  impact: {
    riskChange: {
      licenseExpiryRisk: number;
      credentialLapseRisk: number;
      safetySignalRisk: number;
      qualityRisk: number;
      enrollmentDisruptionRisk: number;
    };
    privilegeReadinessChange: {
      currentPrivilegeStability: number;
      privilegeExpansionReadiness: number;
      fppeCompletionLikelihood: number;
      oppeSustainedSuccess: number;
    };
    enrollmentStabilityChange: {
      payerEnrollmentStability: number;
      pecosRevalidationSuccess: number;
      enrollmentDisruptionProbability: number;
    };
    compactEligibilityChange: {
      imlcMaintenanceProbability: number;
      psypactMaintenanceProbability: number;
      counselingMaintenanceProbability: number;
      compactLossRisk: number;
    };
    safetyEventsChange: {
      safetySignalProbability30d: number;
      safetySignalProbability90d: number;
      qualityIssueProbability30d: number;
      qualityIssueProbability90d: number;
      driftEventProbability30d: number;
      driftEventProbability90d: number;
    };
  };
  trajectoryComparison?: {
    baseline: TrajectorySimulationResult;
    projected: TrajectorySimulationResult;
  };
  createdAt: Date;
}

/**
 * Simulate "what-if" intervention scenarios
 */
export async function simulateInterventions(
  currentState: ClinicianCurrentState,
  interventions: Intervention[]
): Promise<WhatIfScenario> {
  const scenarioId = `whatif_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  log.info('Simulating what-if scenario', {
    scenarioId,
    clinicianId: currentState.clinicianId,
    interventionCount: interventions.length,
    interventionTypes: interventions.map((i) => i.type),
  });

  // Calculate baseline projections
  const baselineProjections = await calculateTransitionProbabilities(currentState);

  // Apply interventions to create projected state
  const projectedState = applyInterventions(currentState, interventions);

  // Calculate projected probabilities
  const projectedProjections = await calculateTransitionProbabilities(projectedState);

  // Calculate impact (difference between baseline and projected)
  const impact = calculateImpact(baselineProjections, projectedProjections);

  // Optionally run trajectory comparisons
  const trajectoryComparison = await compareTrajectories(
    currentState,
    projectedState,
    { numTrajectories: 50, horizonDays: 365 }
  );

  const scenario: WhatIfScenario = {
    scenarioId,
    clinicianId: currentState.clinicianId,
    baselineState: currentState,
    baselineProjections,
    interventions,
    projectedState,
    projectedProjections,
    impact,
    trajectoryComparison,
    createdAt: new Date(),
  };

  log.info('What-if scenario complete', {
    scenarioId,
    riskReduction: impact.riskChange.licenseExpiryRisk + impact.riskChange.safetySignalRisk,
    privilegeReadinessIncrease: impact.privilegeReadinessChange.privilegeExpansionReadiness,
  });

  return scenario;
}

/**
 * Apply interventions to current state to create projected state
 */
function applyInterventions(
  state: ClinicianCurrentState,
  interventions: Intervention[]
): ClinicianCurrentState {
  let projectedState = { ...state };

  for (const intervention of interventions) {
    projectedState = applyIntervention(projectedState, intervention);
  }

  return projectedState;
}

/**
 * Apply a single intervention to state
 */
function applyIntervention(
  state: ClinicianCurrentState,
  intervention: Intervention
): ClinicianCurrentState {
  const newState = { ...state };
  const impact = intervention.expectedImpact || {};

  switch (intervention.type) {
    case 'renew_license':
      // Extend license expiry dates
      newState.licenses = newState.licenses.map((license) => {
        if (license.status === 'ACTIVE' || license.status === 'EXPIRING') {
          const renewalYears = (intervention.parameters?.renewalYears as number) || 2;
          const newExpiryDate = new Date(license.expiryDate);
          newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalYears);
          return { ...license, expiryDate: newExpiryDate, status: 'ACTIVE' };
        }
        return license;
      });
      break;

    case 'renew_credential':
      // Extend credential expiry dates
      newState.boardCerts = newState.boardCerts.map((cert) => {
        if (cert.status === 'ACTIVE' && cert.expiryDate) {
          const renewalYears = (intervention.parameters?.renewalYears as number) || 2;
          const newExpiryDate = new Date(cert.expiryDate);
          newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalYears);
          return { ...cert, expiryDate: newExpiryDate, status: 'ACTIVE' };
        }
        return cert;
      });
      newState.deaRegistrations = newState.deaRegistrations.map((dea) => {
        if (dea.status === 'ACTIVE' && dea.expiryDate) {
          const renewalYears = (intervention.parameters?.renewalYears as number) || 3;
          const newExpiryDate = new Date(dea.expiryDate);
          newExpiryDate.setFullYear(newExpiryDate.getFullYear() + renewalYears);
          return { ...dea, expiryDate: newExpiryDate, status: 'ACTIVE' };
        }
        return dea;
      });
      break;

    case 'expand_privileges':
      // Improve privilege expansion readiness indicators
      // This affects the state indirectly through privilege readiness calculations
      if (impact.privilegeReadinessIncrease) {
        // Improve FPPE status
        newState.privileges = newState.privileges.map((priv) => {
          if (priv.fppeStatus === 'IN_PROGRESS') {
            return { ...priv, fppeStatus: 'COMPLETED' };
          }
          return priv;
        });
      }
      break;

    case 'improve_oppe':
      // Improve OPPE trend and metrics
      const oppeImprovement = impact.oppeTrendImprovement || 0.3;
      newState.oppeTrend = Math.min(1, newState.oppeTrend + oppeImprovement);
      newState.privileges = newState.privileges.map((priv) => {
        if (priv.oppeStatus === 'HOLD' || priv.oppeStatus === 'NOT_STARTED') {
          return { ...priv, oppeStatus: 'ACTIVE' };
        }
        return priv;
      });
      // Reduce recent drift events
      newState.recentDriftEvents = Math.max(0, newState.recentDriftEvents - 1);
      break;

    case 'complete_fppe':
      // Mark FPPE as completed
      newState.privileges = newState.privileges.map((priv) => {
        if (priv.fppeStatus === 'IN_PROGRESS' || priv.fppeStatus === 'NOT_STARTED') {
          return { ...priv, fppeStatus: 'COMPLETED' };
        }
        return priv;
      });
      break;

    case 'fix_enrollment':
      // Fix enrollment issues
      newState.payerEnrollments = newState.payerEnrollments.map((enrollment) => {
        if (enrollment.status === 'PENDING' || enrollment.status === 'DENIED') {
          return { ...enrollment, status: 'APPROVED' };
        }
        // Extend revalidation due dates
        if (enrollment.revalidationDueAt) {
          const newRevalidationDate = new Date(enrollment.revalidationDueAt);
          newRevalidationDate.setFullYear(newRevalidationDate.getFullYear() + 1);
          return { ...enrollment, revalidationDueAt: newRevalidationDate };
        }
        return enrollment;
      });
      break;

    case 'improve_safety_score':
      // Improve safety score
      const safetyIncrease = impact.safetyScoreIncrease || 15;
      newState.safetyScore = Math.min(100, newState.safetyScore + safetyIncrease);
      // Reduce recent safety signals
      newState.recentSafetySignals = Math.max(0, newState.recentSafetySignals - 1);
      break;

    case 'revalidate_pecos':
      // Update PECOS enrollment status
      newState.pecosEnrollments = newState.pecosEnrollments.map((enrollment) => {
        if (enrollment.status === 'PENDING' || enrollment.status === 'REJECTED') {
          return { ...enrollment, status: 'ENROLLED' };
        }
        // Extend revalidation due dates
        if (enrollment.revalidationDueAt) {
          const newRevalidationDate = new Date(enrollment.revalidationDueAt);
          newRevalidationDate.setFullYear(newRevalidationDate.getFullYear() + 5);
          return { ...enrollment, revalidationDueAt: newRevalidationDate };
        }
        return enrollment;
      });
      break;
  }

  return newState;
}

/**
 * Calculate impact (difference) between baseline and projected projections
 */
function calculateImpact(
  baseline: FutureStateProbabilities,
  projected: FutureStateProbabilities
): WhatIfScenario['impact'] {
  return {
    riskChange: {
      licenseExpiryRisk: projected.risk.licenseExpiryRisk - baseline.risk.licenseExpiryRisk,
      credentialLapseRisk: projected.risk.credentialLapseRisk - baseline.risk.credentialLapseRisk,
      safetySignalRisk: projected.risk.safetySignalRisk - baseline.risk.safetySignalRisk,
      qualityRisk: projected.risk.qualityRisk - baseline.risk.qualityRisk,
      enrollmentDisruptionRisk: projected.risk.enrollmentDisruptionRisk - baseline.risk.enrollmentDisruptionRisk,
    },
    privilegeReadinessChange: {
      currentPrivilegeStability: projected.privilegeReadiness.currentPrivilegeStability - baseline.privilegeReadiness.currentPrivilegeStability,
      privilegeExpansionReadiness: projected.privilegeReadiness.privilegeExpansionReadiness - baseline.privilegeReadiness.privilegeExpansionReadiness,
      fppeCompletionLikelihood: projected.privilegeReadiness.fppeCompletionLikelihood - baseline.privilegeReadiness.fppeCompletionLikelihood,
      oppeSustainedSuccess: projected.privilegeReadiness.oppeSustainedSuccess - baseline.privilegeReadiness.oppeSustainedSuccess,
    },
    enrollmentStabilityChange: {
      payerEnrollmentStability: projected.enrollmentStability.payerEnrollmentStability - baseline.enrollmentStability.payerEnrollmentStability,
      pecosRevalidationSuccess: projected.enrollmentStability.pecosRevalidationSuccess - baseline.enrollmentStability.pecosRevalidationSuccess,
      enrollmentDisruptionProbability: projected.enrollmentStability.enrollmentDisruptionProbability - baseline.enrollmentStability.enrollmentDisruptionProbability,
    },
    compactEligibilityChange: {
      imlcMaintenanceProbability: projected.compactEligibility.imlcMaintenanceProbability - baseline.compactEligibility.imlcMaintenanceProbability,
      psypactMaintenanceProbability: projected.compactEligibility.psypactMaintenanceProbability - baseline.compactEligibility.psypactMaintenanceProbability,
      counselingMaintenanceProbability: projected.compactEligibility.counselingMaintenanceProbability - baseline.compactEligibility.counselingMaintenanceProbability,
      compactLossRisk: projected.compactEligibility.compactLossRisk - baseline.compactEligibility.compactLossRisk,
    },
    safetyEventsChange: {
      safetySignalProbability30d: projected.safetyEvents.safetySignalProbability30d - baseline.safetyEvents.safetySignalProbability30d,
      safetySignalProbability90d: projected.safetyEvents.safetySignalProbability90d - baseline.safetyEvents.safetySignalProbability90d,
      qualityIssueProbability30d: projected.safetyEvents.qualityIssueProbability30d - baseline.safetyEvents.qualityIssueProbability30d,
      qualityIssueProbability90d: projected.safetyEvents.qualityIssueProbability90d - baseline.safetyEvents.qualityIssueProbability90d,
      driftEventProbability30d: projected.safetyEvents.driftEventProbability30d - baseline.safetyEvents.driftEventProbability30d,
      driftEventProbability90d: projected.safetyEvents.driftEventProbability90d - baseline.safetyEvents.driftEventProbability90d,
    },
  };
}

/**
 * Compare trajectories between baseline and projected states
 */
async function compareTrajectories(
  baselineState: ClinicianCurrentState,
  projectedState: ClinicianCurrentState,
  options: { numTrajectories?: number; horizonDays?: number }
): Promise<WhatIfScenario['trajectoryComparison']> {
  try {
    const [baseline, projected] = await Promise.all([
      simulateTrajectories(baselineState, {
        numTrajectories: options.numTrajectories || 50,
        horizonDays: options.horizonDays || 365,
        simulationType: 'monte_carlo',
      }),
      simulateTrajectories(projectedState, {
        numTrajectories: options.numTrajectories || 50,
        horizonDays: options.horizonDays || 365,
        simulationType: 'monte_carlo',
      }),
    ]);

    return { baseline, projected };
  } catch (error) {
    log.error('Error comparing trajectories', { error });
    return undefined;
  }
}

/**
 * Common intervention templates
 */
export const InterventionTemplates: Record<string, Omit<Intervention, 'parameters'>> = {
  renewLicense: {
    type: 'renew_license',
    description: 'Renew expiring licenses',
    expectedImpact: {
      riskReduction: 0.5,
    },
  },
  expandPrivileges: {
    type: 'expand_privileges',
    description: 'Expand clinical privileges',
    expectedImpact: {
      privilegeReadinessIncrease: 0.3,
    },
  },
  improveOPPE: {
    type: 'improve_oppe',
    description: 'Improve OPPE performance',
    expectedImpact: {
      oppeTrendImprovement: 0.3,
      riskReduction: 0.2,
    },
  },
  fixEnrollment: {
    type: 'fix_enrollment',
    description: 'Fix payer enrollment issues',
    expectedImpact: {
      enrollmentStabilityIncrease: 0.4,
    },
  },
  completeFPPE: {
    type: 'complete_fppe',
    description: 'Complete FPPE requirements',
    expectedImpact: {
      privilegeReadinessIncrease: 0.2,
    },
  },
  renewCredential: {
    type: 'renew_credential',
    description: 'Renew expiring credentials',
    expectedImpact: {
      riskReduction: 0.3,
    },
  },
  improveSafetyScore: {
    type: 'improve_safety_score',
    description: 'Improve safety score through remediation',
    expectedImpact: {
      safetyScoreIncrease: 15,
      riskReduction: 0.25,
    },
  },
  revalidatePECOS: {
    type: 'revalidate_pecos',
    description: 'Complete PECOS revalidation',
    expectedImpact: {
      enrollmentStabilityIncrease: 0.2,
    },
  },
};


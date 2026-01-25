/**
 * B207B-LIFE-010: Lifecycle → SupervisorAgent Integration
 *
 * Supervisor uses lifecycle predictions to schedule preventive tasks:
 * - PSV before expiry clusters
 * - FPPE prep
 * - License renewal reminders
 * - Enrollment revalidation alerts
 * - OPPE improvement plans
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import type { PlannedTask } from '../planner/plannerTypes.js';
// Note: SupervisorTaskType enum should include these values:
// PSV_CHECK, FPPE_PREP, LICENSE_RENEWAL, ENROLLMENT_REVALIDATION, OPPE_REVIEW,
// CREDENTIAL_RENEWAL, PECOS_REVALIDATION, COMPACT_MONITORING, SAFETY_REVIEW
// If not available, use generic string types or add these to the enum
type SupervisorTaskType = string;
import type {
  ClinicianCurrentState,
  FutureStateProbabilities,
} from '../../lifecycle/model/transitionModel.js';
import { calculateTransitionProbabilities } from '../../lifecycle/model/transitionModel.js';

const prisma = new PrismaClient();
const log = getServiceLogger('services/supervisor/integration/lifecycle');

export interface LifecycleTaskRecommendation {
  taskType: SupervisorTaskType;
  priority: number;
  triggeredBy: string;
  reason: string;
  metadata: {
    clinicianId: string;
    issueType: string;
    probability: number;
    horizonDays: number;
    recommendedIntervention?: string;
  };
  scheduledFor?: Date; // When task should be executed
}

/**
 * Generate supervisor tasks based on lifecycle predictions
 */
export async function generateLifecycleTasks(
  clinicianId: string,
  projections?: FutureStateProbabilities
): Promise<LifecycleTaskRecommendation[]> {
  log.debug('Generating lifecycle tasks', { clinicianId });

  // If projections not provided, calculate them
  if (!projections) {
    const currentState = await buildCurrentState(clinicianId);
    projections = await calculateTransitionProbabilities(currentState);
  }

  const tasks: LifecycleTaskRecommendation[] = [];

  // Schedule PSV before license expiry clusters
  if (projections.risk.licenseExpiryRisk > 0.3) {
    const horizonDays = estimateHorizonDays(projections.risk.licenseExpiryRisk);
    if (horizonDays > 0 && horizonDays <= 180) {
      tasks.push({
        taskType: SupervisorTaskType.PSV_CHECK,
        priority: projections.risk.licenseExpiryRisk > 0.7 ? 9 : 6,
        triggeredBy: 'lifecycle_orchestrator',
        reason: `High license expiry risk (${(projections.risk.licenseExpiryRisk * 100).toFixed(0)}%)`,
        metadata: {
          clinicianId,
          issueType: 'license_expiry',
          probability: projections.risk.licenseExpiryRisk,
          horizonDays,
          recommendedIntervention: 'renew_license',
        },
        scheduledFor: new Date(Date.now() + (horizonDays - 60) * 24 * 60 * 60 * 1000), // 60 days before expiry
      });
    }
  }

  // Schedule FPPE prep tasks
  if (projections.privilegeReadiness.fppeCompletionLikelihood < 0.6) {
    tasks.push({
      taskType: SupervisorTaskType.FPPE_PREP,
      priority: 7,
      triggeredBy: 'lifecycle_orchestrator',
      reason: `Low FPPE completion likelihood (${(projections.privilegeReadiness.fppeCompletionLikelihood * 100).toFixed(0)}%)`,
      metadata: {
        clinicianId,
        issueType: 'fppe_risk',
        probability: 1 - projections.privilegeReadiness.fppeCompletionLikelihood,
        horizonDays: 90,
        recommendedIntervention: 'complete_fppe',
      },
    });
  }

  // Schedule license renewal reminders
  if (projections.risk.licenseExpiryRisk > 0.2) {
    const horizonDays = estimateHorizonDays(projections.risk.licenseExpiryRisk);
    if (horizonDays > 0 && horizonDays <= 90) {
      tasks.push({
        taskType: SupervisorTaskType.LICENSE_RENEWAL,
        priority: projections.risk.licenseExpiryRisk > 0.6 ? 10 : 7,
        triggeredBy: 'lifecycle_orchestrator',
        reason: `License renewal needed (expiry risk: ${(projections.risk.licenseExpiryRisk * 100).toFixed(0)}%)`,
        metadata: {
          clinicianId,
          issueType: 'license_expiry',
          probability: projections.risk.licenseExpiryRisk,
          horizonDays,
          recommendedIntervention: 'renew_license',
        },
        scheduledFor: new Date(Date.now() + Math.max(0, horizonDays - 30) * 24 * 60 * 60 * 1000), // 30 days before expiry
      });
    }
  }

  // Schedule enrollment revalidation alerts
  if (projections.risk.enrollmentDisruptionRisk > 0.3) {
    const horizonDays = estimateHorizonDays(projections.risk.enrollmentDisruptionRisk);
    tasks.push({
      taskType: SupervisorTaskType.ENROLLMENT_REVALIDATION,
      priority: projections.risk.enrollmentDisruptionRisk > 0.6 ? 8 : 5,
      triggeredBy: 'lifecycle_orchestrator',
      reason: `High enrollment disruption risk (${(projections.risk.enrollmentDisruptionRisk * 100).toFixed(0)}%)`,
      metadata: {
        clinicianId,
        issueType: 'enrollment_disruption',
        probability: projections.risk.enrollmentDisruptionRisk,
        horizonDays: horizonDays || 180,
        recommendedIntervention: 'fix_enrollment',
      },
      scheduledFor: horizonDays > 0 ? new Date(Date.now() + (horizonDays - 60) * 24 * 60 * 60 * 1000) : undefined,
    });
  }

  // Schedule OPPE improvement plans
  if (projections.privilegeReadiness.oppeSustainedSuccess < 0.6) {
    tasks.push({
      taskType: SupervisorTaskType.OPPE_REVIEW,
      priority: 6,
      triggeredBy: 'lifecycle_orchestrator',
      reason: `Low OPPE sustained success probability (${(projections.privilegeReadiness.oppeSustainedSuccess * 100).toFixed(0)}%)`,
      metadata: {
        clinicianId,
        issueType: 'oppe_risk',
        probability: 1 - projections.privilegeReadiness.oppeSustainedSuccess,
        horizonDays: 180,
        recommendedIntervention: 'improve_oppe',
      },
    });
  }

  // Schedule credential renewal reminders
  if (projections.risk.credentialLapseRisk > 0.2) {
    const horizonDays = estimateHorizonDays(projections.risk.credentialLapseRisk);
    if (horizonDays > 0 && horizonDays <= 90) {
      tasks.push({
        taskType: SupervisorTaskType.CREDENTIAL_RENEWAL,
        priority: projections.risk.credentialLapseRisk > 0.6 ? 9 : 6,
        triggeredBy: 'lifecycle_orchestrator',
        reason: `Credential renewal needed (lapse risk: ${(projections.risk.credentialLapseRisk * 100).toFixed(0)}%)`,
        metadata: {
          clinicianId,
          issueType: 'credential_lapse',
          probability: projections.risk.credentialLapseRisk,
          horizonDays,
          recommendedIntervention: 'renew_credential',
        },
        scheduledFor: new Date(Date.now() + Math.max(0, horizonDays - 30) * 24 * 60 * 60 * 1000),
      });
    }
  }

  // Schedule PECOS revalidation alerts
  if (projections.enrollmentStability.pecosRevalidationSuccess < 0.7) {
    tasks.push({
      taskType: SupervisorTaskType.PECOS_REVALIDATION,
      priority: 7,
      triggeredBy: 'lifecycle_orchestrator',
      reason: `Low PECOS revalidation success probability (${(projections.enrollmentStability.pecosRevalidationSuccess * 100).toFixed(0)}%)`,
      metadata: {
        clinicianId,
        issueType: 'pecos_risk',
        probability: 1 - projections.enrollmentStability.pecosRevalidationSuccess,
        horizonDays: 180,
        recommendedIntervention: 'revalidate_pecos',
      },
    });
  }

  // Schedule compact eligibility monitoring
  if (projections.compactEligibility.compactLossRisk > 0.3) {
    tasks.push({
      taskType: SupervisorTaskType.COMPACT_MONITORING,
      priority: 5,
      triggeredBy: 'lifecycle_orchestrator',
      reason: `High compact eligibility loss risk (${(projections.compactEligibility.compactLossRisk * 100).toFixed(0)}%)`,
      metadata: {
        clinicianId,
        issueType: 'compact_loss',
        probability: projections.compactEligibility.compactLossRisk,
        horizonDays: 365,
        recommendedIntervention: 'renew_license',
      },
    });
  }

  // Schedule safety signal prevention tasks
  if (projections.safetyEvents.safetySignalProbability30d > 0.25) {
    tasks.push({
      taskType: SupervisorTaskType.SAFETY_REVIEW,
      priority: projections.safetyEvents.safetySignalProbability30d > 0.5 ? 9 : 6,
      triggeredBy: 'lifecycle_orchestrator',
      reason: `High safety signal probability (${(projections.safetyEvents.safetySignalProbability30d * 100).toFixed(0)}% in 30 days)`,
      metadata: {
        clinicianId,
        issueType: 'safety_signal',
        probability: projections.safetyEvents.safetySignalProbability30d,
        horizonDays: 30,
        recommendedIntervention: 'improve_safety_score',
      },
    });
  }

  log.debug('Generated lifecycle tasks', {
    clinicianId,
    taskCount: tasks.length,
    tasks: tasks.map((t) => ({ type: t.taskType, priority: t.priority })),
  });

  return tasks;
}

/**
 * Convert lifecycle task recommendations to supervisor planned tasks
 */
export function convertToPlannedTasks(
  recommendations: LifecycleTaskRecommendation[]
): PlannedTask[] {
  return recommendations.map((rec) => ({
    taskType: rec.taskType,
    priority: rec.priority,
    triggeredBy: rec.triggeredBy,
    metadata: {
      reason: rec.reason,
      ...rec.metadata,
      scheduledFor: rec.scheduledFor?.toISOString(),
    },
  }));
}

/**
 * Build current state for a clinician (stub - same as orchestrator)
 */
async function buildCurrentState(clinicianId: string): Promise<ClinicianCurrentState> {
  // TODO: Implement based on actual database schema
  log.debug('Building current state', { clinicianId });

  return {
    clinicianId,
    licenses: [],
    boardCerts: [],
    deaRegistrations: [],
    privileges: [],
    payerEnrollments: [],
    pecosEnrollments: [],
    compactEligibility: {
      imlcStatus: 'UNKNOWN',
      psypactStatus: 'UNKNOWN',
      counselingStatus: 'UNKNOWN',
    },
    oppeTrend: 0,
    safetyScore: 75,
    recentDriftEvents: 0,
    recentSafetySignals: 0,
  };
}

/**
 * Estimate horizon days from probability (heuristic)
 */
function estimateHorizonDays(probability: number): number {
  // Higher probability = closer horizon
  // This is a heuristic - actual implementation should use expiry dates
  if (probability > 0.8) return 30;
  if (probability > 0.6) return 60;
  if (probability > 0.4) return 90;
  if (probability > 0.2) return 180;
  return 365;
}


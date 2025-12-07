/**
 * B207B-LIFE-009: LifecycleOrchestrator
 *
 * Runs monthly; regenerates projections; watches for major predicted issues;
 * triggers alerts and preventive actions.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../services/logging/serviceLogger.js';
import type { ClinicianCurrentState } from '../../services/lifecycle/model/transitionModel.js';
import { calculateTransitionProbabilities } from '../../services/lifecycle/model/transitionModel.js';
import { simulateTrajectories } from '../../services/lifecycle/simulator/trajectorySimulator.js';
import { simulateInterventions } from '../../services/lifecycle/simulator/whatIf.js';

const prisma = new PrismaClient();
const log = getServiceLogger('jobs/lifecycle/orchestrator');

export interface LifecycleOrchestratorResult {
  cliniciansProcessed: number;
  projectionsUpdated: number;
  issuesDetected: number;
  preventiveActionsTriggered: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

export interface PredictedIssue {
  clinicianId: string;
  issueType: 'license_expiry' | 'credential_lapse' | 'safety_signal' | 'enrollment_disruption' | 'privilege_risk' | 'compact_loss';
  severity: 'low' | 'med' | 'high' | 'critical';
  probability: number;
  horizonDays: number;
  description: string;
  recommendedActions: string[];
}

/**
 * Run monthly lifecycle orchestrator job
 */
export async function runLifecycleOrchestrator(
  referenceDate = new Date()
): Promise<LifecycleOrchestratorResult> {
  const startedAt = new Date();
  const errors: string[] = [];
  let cliniciansProcessed = 0;
  let projectionsUpdated = 0;
  let issuesDetected = 0;
  let preventiveActionsTriggered = 0;

  log.info('Starting lifecycle orchestrator job', { startedAt, referenceDate });

  try {
    // Get all active clinicians (simplified query - adjust based on actual schema)
    const clinicians = await getActiveClinicians();

    log.info('Processing clinicians', { count: clinicians.length });

    for (const clinicianId of clinicians) {
      try {
        // Build current state for clinician
        const currentState = await buildCurrentState(clinicianId);

        // Calculate transition probabilities
        const projections = await calculateTransitionProbabilities(currentState);

        // Store projections (TODO: implement when schema is available)
        await storeProjections(clinicianId, projections);
        projectionsUpdated++;

        // Run trajectory simulation for high-risk clinicians
        const highRisk = isHighRisk(projections);
        if (highRisk) {
          log.debug('Running trajectory simulation for high-risk clinician', {
            clinicianId,
          });

          await simulateTrajectories(currentState, {
            numTrajectories: 100,
            horizonDays: 365,
            simulationType: 'monte_carlo',
          });
        }

        // Detect predicted issues
        const issues = detectPredictedIssues(clinicianId, projections);
        if (issues.length > 0) {
          issuesDetected += issues.length;
          log.warn('Predicted issues detected', {
            clinicianId,
            issueCount: issues.length,
            issues: issues.map((i) => ({ type: i.issueType, severity: i.severity })),
          });

          // Trigger preventive actions for critical/high issues
          const criticalIssues = issues.filter((i) => i.severity === 'critical' || i.severity === 'high');
          if (criticalIssues.length > 0) {
            await triggerPreventiveActions(clinicianId, criticalIssues, currentState);
            preventiveActionsTriggered += criticalIssues.length;
          }

          // Store issues for monitoring
          await storePredictedIssues(clinicianId, issues);
        }

        cliniciansProcessed++;
      } catch (error) {
        const errorMsg = `Error processing clinician ${clinicianId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        log.error('Error processing clinician', {
          clinicianId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const finishedAt = new Date();
    const duration = finishedAt.getTime() - startedAt.getTime();

    log.info('Lifecycle orchestrator job complete', {
      cliniciansProcessed,
      projectionsUpdated,
      issuesDetected,
      preventiveActionsTriggered,
      errors: errors.length,
      durationMs: duration,
    });

    return {
      cliniciansProcessed,
      projectionsUpdated,
      issuesDetected,
      preventiveActionsTriggered,
      errors,
      startedAt,
      finishedAt,
    };
  } catch (error) {
    log.error('Lifecycle orchestrator job failed', { error });
    throw error;
  }
}

/**
 * Get all active clinicians (stub - implement based on actual schema)
 */
async function getActiveClinicians(): Promise<string[]> {
  // TODO: Implement based on actual database schema
  // For now, return empty array
  // Example query when schema is available:
  // const clinicians = await prisma.privilegeGranted.findMany({
  //   where: { status: 'ACTIVE' },
  //   distinct: ['clinicianDid'],
  //   select: { clinicianDid: true },
  // });
  // return clinicians.map((c) => c.clinicianDid);

  log.warn('getActiveClinicians not implemented - returning empty array');
  return [];
}

/**
 * Build current state for a clinician
 */
async function buildCurrentState(clinicianId: string): Promise<ClinicianCurrentState> {
  // TODO: Implement based on actual database schema
  // This is a stub that returns a default state structure

  // Fetch data from database and build state object
  // Example queries:
  // - Licenses from StateLicenseVerification
  // - Board certs from Credential where type = 'BoardCertification'
  // - DEA from Credential where type = 'DEARegistration'
  // - Privileges from PrivilegeGranted
  // - Payer enrollments from PayerEnrollment
  // - PECOS from PECOSEnrollment
  // - Compact eligibility from CompactsStatus
  // - OPPE trend from recent FppeOppe records
  // - Safety score from SafetyFeatureVector
  // - Drift events from DriftEvent
  // - Safety signals from PrivilegeSafetySignal

  log.debug('Building current state', { clinicianId });

  // Return stub state - replace with actual data fetching
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
 * Check if projections indicate high risk
 */
function isHighRisk(projections: ReturnType<typeof calculateTransitionProbabilities> extends Promise<infer T> ? T : never): boolean {
  return (
    projections.risk.licenseExpiryRisk > 0.5 ||
    projections.risk.safetySignalRisk > 0.5 ||
    projections.risk.enrollmentDisruptionRisk > 0.5 ||
    projections.safetyEvents.safetySignalProbability30d > 0.3
  );
}

/**
 * Detect predicted issues from projections
 */
function detectPredictedIssues(
  clinicianId: string,
  projections: Awaited<ReturnType<typeof calculateTransitionProbabilities>>
): PredictedIssue[] {
  const issues: PredictedIssue[] = [];
  const thresholds = {
    critical: 0.8,
    high: 0.6,
    med: 0.4,
    low: 0.2,
  };

  // License expiry risk
  if (projections.risk.licenseExpiryRisk > thresholds.low) {
    const severity = determineSeverity(projections.risk.licenseExpiryRisk, thresholds);
    issues.push({
      clinicianId,
      issueType: 'license_expiry',
      severity,
      probability: projections.risk.licenseExpiryRisk,
      horizonDays: 365,
      description: 'High probability of license expiry within 365 days',
      recommendedActions: ['renew_license', 'monitor_expiry_dates'],
    });
  }

  // Credential lapse risk
  if (projections.risk.credentialLapseRisk > thresholds.low) {
    const severity = determineSeverity(projections.risk.credentialLapseRisk, thresholds);
    issues.push({
      clinicianId,
      issueType: 'credential_lapse',
      severity,
      probability: projections.risk.credentialLapseRisk,
      horizonDays: 365,
      description: 'High probability of credential lapse within 365 days',
      recommendedActions: ['renew_credential', 'monitor_expiry_dates'],
    });
  }

  // Safety signal risk
  if (projections.safetyEvents.safetySignalProbability30d > thresholds.low) {
    const severity = determineSeverity(projections.safetyEvents.safetySignalProbability30d, thresholds);
    issues.push({
      clinicianId,
      issueType: 'safety_signal',
      severity,
      probability: projections.safetyEvents.safetySignalProbability30d,
      horizonDays: 30,
      description: 'High probability of safety signal within 30 days',
      recommendedActions: ['improve_safety_score', 'review_oppe_metrics'],
    });
  }

  // Enrollment disruption risk
  if (projections.risk.enrollmentDisruptionRisk > thresholds.low) {
    const severity = determineSeverity(projections.risk.enrollmentDisruptionRisk, thresholds);
    issues.push({
      clinicianId,
      issueType: 'enrollment_disruption',
      severity,
      probability: projections.risk.enrollmentDisruptionRisk,
      horizonDays: 365,
      description: 'High probability of enrollment disruption within 365 days',
      recommendedActions: ['fix_enrollment', 'revalidate_pecos'],
    });
  }

  // Privilege risk
  if (projections.privilegeReadiness.currentPrivilegeStability < 0.5) {
    const riskLevel = 1 - projections.privilegeReadiness.currentPrivilegeStability;
    const severity = determineSeverity(riskLevel, thresholds);
    issues.push({
      clinicianId,
      issueType: 'privilege_risk',
      severity,
      probability: riskLevel,
      horizonDays: 180,
      description: 'Low privilege stability - risk of privilege restriction',
      recommendedActions: ['improve_oppe', 'complete_fppe'],
    });
  }

  // Compact loss risk
  if (projections.compactEligibility.compactLossRisk > thresholds.low) {
    const severity = determineSeverity(projections.compactEligibility.compactLossRisk, thresholds);
    issues.push({
      clinicianId,
      issueType: 'compact_loss',
      severity,
      probability: projections.compactEligibility.compactLossRisk,
      horizonDays: 365,
      description: 'High probability of losing compact eligibility',
      recommendedActions: ['renew_license', 'maintain_compact_requirements'],
    });
  }

  return issues;
}

/**
 * Determine severity from probability and thresholds
 */
function determineSeverity(
  probability: number,
  thresholds: { critical: number; high: number; med: number; low: number }
): 'low' | 'med' | 'high' | 'critical' {
  if (probability >= thresholds.critical) return 'critical';
  if (probability >= thresholds.high) return 'high';
  if (probability >= thresholds.med) return 'med';
  return 'low';
}

/**
 * Trigger preventive actions for detected issues
 */
async function triggerPreventiveActions(
  clinicianId: string,
  issues: PredictedIssue[],
  currentState: ClinicianCurrentState
): Promise<void> {
  log.info('Triggering preventive actions', {
    clinicianId,
    issueCount: issues.length,
  });

  // Group issues by type and recommend interventions
  const interventions = issues.flatMap((issue) =>
    issue.recommendedActions.map((action) => ({
      type: action as any,
      description: `Preventive action for ${issue.issueType}`,
    }))
  );

  // Simulate interventions to show impact
  try {
    await simulateInterventions(currentState, interventions);
  } catch (error) {
    log.error('Error simulating interventions', {
      clinicianId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // TODO: Trigger actual supervisor tasks or notifications
  // Example:
  // - Create SupervisorTask entries
  // - Send notifications
  // - Schedule PSV checks
  // - Trigger OPPE reviews
}

/**
 * Store projections (stub - implement when schema is available)
 */
async function storeProjections(
  clinicianId: string,
  projections: Awaited<ReturnType<typeof calculateTransitionProbabilities>>
): Promise<void> {
  // TODO: Implement database storage when schema is available
  log.debug('Storing projections', { clinicianId });
}

/**
 * Store predicted issues (stub - implement when schema is available)
 */
async function storePredictedIssues(clinicianId: string, issues: PredictedIssue[]): Promise<void> {
  // TODO: Implement database storage when schema is available
  log.debug('Storing predicted issues', {
    clinicianId,
    issueCount: issues.length,
  });
}

/**
 * Standalone execution (for cron jobs)
 */
if (require.main === module) {
  runLifecycleOrchestrator()
    .then((result) => {
      console.log('[LifecycleOrchestrator] Job complete', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[LifecycleOrchestrator] Job failed', error);
      process.exit(1);
    });
}


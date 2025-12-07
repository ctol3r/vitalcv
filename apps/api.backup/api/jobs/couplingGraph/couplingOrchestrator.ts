/**
 * B210B-COUP-010: CouplingOrchestrator job
 *
 * Runs weekly + on critical events → updates system-wide impact predictions + Timeline.
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { joinCrossDomainImpact, type CrossDomainData } from '../../services/couplingGraph/joiners/crossDomainImpact.js';
import { simulateScenario, type ScenarioEvent } from '../../services/couplingGraph/simulator/rippleSimulator.js';
import { logCredentialTimelineEvent } from '../../services/timeline/logCredentialTimelineEvent.js';
import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
} from '@prisma/client';

// Import domain services
import { detectRootCauses } from '../../services/causalGraph/rootCauseDetector.js';
import type { CausalEventType } from '../../services/causalGraph/types.js';

const prisma = new PrismaClient();
const logger = createLogger({ service: 'coupling-orchestrator' });

export interface CouplingOrchestratorOptions {
  runOnStartup?: boolean;
  cronSchedule?: string; // Default: '0 3 * * 0' (3 AM every Sunday)
  processCriticalEvents?: boolean; // Whether to process critical events in real-time
}

/**
 * Run the coupling orchestrator
 */
export async function runCouplingOrchestrator(
  options: CouplingOrchestratorOptions = {}
): Promise<void> {
  logger.info('Starting coupling orchestrator run');

  try {
    // Step 1: Collect cross-domain data
    const crossDomainData = await collectCrossDomainData();
    logger.info('Collected cross-domain data', {
      causalEvents: crossDomainData.causalEvents?.length || 0,
      safetySignals: crossDomainData.safetySignals?.length || 0,
      hasWorkforceForecast: !!crossDomainData.workforceForecast,
      competencyData: crossDomainData.competencyData?.length || 0,
      enrollmentData: crossDomainData.enrollmentData?.length || 0,
    });

    // Step 2: Join cross-domain impact
    const unifiedImpact = await joinCrossDomainImpact(crossDomainData);
    logger.info('Computed unified system impact', {
      overallScore: unifiedImpact.systemPerformance.overallScore,
      departmentsAffected: unifiedImpact.departmentImpacts.length,
      fragileAreas: unifiedImpact.sensitivityResults.filter((r) => r.fragilityScore > 0.5).length,
    });

    // Step 3: Simulate critical scenarios
    const scenarioResults = await simulateCriticalScenarios(unifiedImpact);
    logger.info('Simulated critical scenarios', {
      scenariosRun: scenarioResults.length,
    });

    // Step 4: Update timeline with impact predictions
    await updateTimelineWithImpactPredictions(unifiedImpact, scenarioResults);

    // Step 5: Store results (optional - could persist to database)
    await storeImpactResults(unifiedImpact);

    logger.info('Coupling orchestrator run completed successfully');
  } catch (error) {
    logger.error('Error in coupling orchestrator run', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Collect cross-domain data from various services
 */
async function collectCrossDomainData(): Promise<CrossDomainData> {
  const data: CrossDomainData = {};

  try {
    // Collect causal events
    const recentCausalEvents = await detectRootCauses('RISK_SPIKE' as CausalEventType, {
      maxDepth: 3,
      minConfidence: 0.5,
    });
    data.causalEvents = recentCausalEvents.rootCauses.map((rc) => rc.eventType);

    // Collect safety signals (simplified - would query actual safety service)
    // data.safetySignals = await getRecentSafetySignals();

    // Collect workforce forecast (simplified - would query workforceForecast service)
    // data.workforceForecast = await getLatestWorkforceForecast();

    // Collect competency data (simplified - would query competency service)
    // data.competencyData = await getRecentCompetencyData();

    // Collect enrollment data
    try {
      // Query enrollment data from database
      // This is a placeholder - adjust based on your actual schema
      const enrollments = await prisma.$queryRaw<Array<{
        providerId: string;
        payerId: string;
        status: string;
        enrolledAt: Date | null;
        expiresAt: Date | null;
      }>>`
        SELECT DISTINCT
          provider_id as "providerId",
          payer_id as "payerId",
          status,
          enrolled_at as "enrolledAt",
          expires_at as "expiresAt"
        FROM enrollments
        WHERE status IN ('ACTIVE', 'PENDING', 'EXPIRED', 'SUSPENDED')
        LIMIT 1000
      `.catch(() => []);

      data.enrollmentData = enrollments.map((e) => ({
        providerId: e.providerId,
        payerId: e.payerId,
        status: e.status as 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'SUSPENDED',
        enrolledAt: e.enrolledAt || undefined,
        expiresAt: e.expiresAt || undefined,
      }));
    } catch (error) {
      logger.warn('Error collecting enrollment data', { error });
    }
  } catch (error) {
    logger.warn('Error collecting cross-domain data', { error });
  }

  return data;
}

/**
 * Simulate critical scenarios
 */
async function simulateCriticalScenarios(
  unifiedImpact: Awaited<ReturnType<typeof joinCrossDomainImpact>>
): Promise<Array<{ scenario: ScenarioEvent; impacts: import('../../services/couplingGraph/types.js').DepartmentImpact[] }>> {
  const scenarios: ScenarioEvent[] = [
    {
      type: 'DEA_MASS_EXPIRY',
      affectedNodeIds: Array.from(unifiedImpact.rippleScores.keys()).slice(0, 10),
      severity: 0.8,
      metadata: { simulated: true },
    },
    {
      type: 'PAYER_NETWORK_FAILURE',
      affectedNodeIds: Array.from(unifiedImpact.rippleScores.keys()).slice(0, 5),
      severity: 0.7,
      metadata: { simulated: true },
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    try {
      const impacts = await simulateScenario(scenario, {
        maxDepth: 5,
        minImpactThreshold: 0.01,
        includeRecoveryTime: true,
      });
      results.push({ scenario, impacts });
    } catch (error) {
      logger.warn('Error simulating scenario', {
        scenarioType: scenario.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Update timeline with impact predictions
 */
async function updateTimelineWithImpactPredictions(
  unifiedImpact: Awaited<ReturnType<typeof joinCrossDomainImpact>>,
  scenarioResults: Array<{ scenario: ScenarioEvent; impacts: import('../../services/couplingGraph/types.js').DepartmentImpact[] }>
): Promise<void> {
  // Log timeline events for top fragile areas
  const topFragile = unifiedImpact.sensitivityResults
    .filter((r) => r.fragilityScore > 0.7)
    .slice(0, 10);

  for (const fragile of topFragile) {
    try {
      await logCredentialTimelineEvent({
        clinicianId: fragile.nodeId, // Adjust based on your schema
        eventType: CredentialTimelineEventType.SUPERVISOR_TRIGGER,
        severity: TimelineEventSeverity.WARNING,
        metadata: {
          couplingAnalysis: {
            nodeId: fragile.nodeId,
            nodeName: fragile.nodeName,
            fragilityScore: fragile.fragilityScore,
            sensitivity: fragile.sensitivity,
            affectedDepartments: fragile.affectedDepartments,
            recommendations: fragile.recommendations,
          },
        },
      });
    } catch (error) {
      logger.warn('Error logging timeline event', {
        nodeId: fragile.nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Log timeline events for high-impact scenarios
  for (const { scenario, impacts } of scenarioResults) {
    const topImpact = impacts[0];
    if (topImpact && topImpact.impactScore > 0.5) {
      try {
        await logCredentialTimelineEvent({
          clinicianId: topImpact.departmentId, // Adjust based on your schema
          eventType: CredentialTimelineEventType.SUPERVISOR_TRIGGER,
          severity: TimelineEventSeverity.HIGH,
          metadata: {
            scenarioSimulation: {
              scenarioType: scenario.type,
              departmentId: topImpact.departmentId,
              departmentName: topImpact.departmentName,
              impactScore: topImpact.impactScore,
              affectedNodes: topImpact.affectedNodes.length,
              estimatedRecoveryTime: topImpact.estimatedRecoveryTime,
            },
          },
        });
      } catch (error) {
        logger.warn('Error logging scenario timeline event', {
          scenarioType: scenario.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

/**
 * Store impact results (optional persistence)
 */
async function storeImpactResults(
  unifiedImpact: Awaited<ReturnType<typeof joinCrossDomainImpact>>
): Promise<void> {
  // Optionally persist to database
  // For now, we'll just log the summary
  logger.info('Impact results summary', {
    timestamp: unifiedImpact.timestamp,
    overallScore: unifiedImpact.systemPerformance.overallScore,
    credentialReadiness: unifiedImpact.systemPerformance.credentialReadiness,
    enrollmentStability: unifiedImpact.systemPerformance.enrollmentStability,
    workforceCapacity: unifiedImpact.systemPerformance.workforceCapacity,
    safetyIndex: unifiedImpact.systemPerformance.safetyIndex,
    nextWeekScore: unifiedImpact.predictions.nextWeek.overallScore,
    nextMonthScore: unifiedImpact.predictions.nextMonth.overallScore,
  });
}

/**
 * Start the coupling orchestrator cron job
 */
export function startCouplingOrchestratorCron(
  options: CouplingOrchestratorOptions = {}
): void {
  const cronSchedule = options.cronSchedule || '0 3 * * 0'; // 3 AM every Sunday
  logger.info(`Starting coupling orchestrator cron with schedule: ${cronSchedule}`);

  if (options.runOnStartup) {
    // Run immediately on startup
    runCouplingOrchestrator(options).catch((error) => {
      logger.error('Error in startup coupling orchestrator run', { error });
    });
  }

  cron.schedule(cronSchedule, async () => {
    try {
      await runCouplingOrchestrator(options);
    } catch (error) {
      logger.error('Error in coupling orchestrator cron run', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * Trigger coupling orchestrator on critical events
 */
export async function triggerCouplingOrchestratorOnEvent(
  eventType: string,
  entityId?: string
): Promise<void> {
  logger.info('Triggering coupling orchestrator on critical event', { eventType, entityId });

  await runCouplingOrchestrator({
    processCriticalEvents: true,
  });
}

export default {
  runCouplingOrchestrator,
  startCouplingOrchestratorCron,
  triggerCouplingOrchestratorOnEvent,
};

if (require.main === module) {
  logger.info('🚀 [CouplingOrchestrator] Running in standalone mode...');
  startCouplingOrchestratorCron({ runOnStartup: true });
  process.on('SIGINT', () => {
    logger.info('\n🛑 [CouplingOrchestrator] Shutting down...');
    process.exit(0);
  });
}


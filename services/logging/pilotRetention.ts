const log = getServiceLogger('logging/pilotRetention');
/**
 * Pilot Log Retention Policy
 * B133A-LOG-010: 30-day retention policy for pilot smoke test and SLO logs
 *
 * This service:
 * 1. Prunes pilot logs older than 30 days
 * 2. Centralizes retention configuration
 * 3. Provides safe deletion with dry-run support
 */

import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { getServiceLogger } from './serviceLogger';

const prisma = new PrismaClient();

/**
 * Retention policy configuration
 */
export interface RetentionPolicyConfig {
  smokeTestLogRetentionDays: number;
  sloEvaluationRetentionDays: number;
  pilotReadinessExecutionRetentionDays: number;
  dryRun: boolean; // If true, don't actually delete
}

/**
 * Default retention policy (30 days for all pilot logs)
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicyConfig = {
  smokeTestLogRetentionDays: 30,
  sloEvaluationRetentionDays: 30,
  pilotReadinessExecutionRetentionDays: 30,
  dryRun: false,
};

/**
 * Get retention policy configuration
 */
export function getRetentionPolicy(): RetentionPolicyConfig {
  return {
    smokeTestLogRetentionDays: parseInt(
      process.env.PILOT_SMOKE_TEST_RETENTION_DAYS ||
      String(DEFAULT_RETENTION_POLICY.smokeTestLogRetentionDays)
    ),
    sloEvaluationRetentionDays: parseInt(
      process.env.PILOT_SLO_EVALUATION_RETENTION_DAYS ||
      String(DEFAULT_RETENTION_POLICY.sloEvaluationRetentionDays)
    ),
    pilotReadinessExecutionRetentionDays: parseInt(
      process.env.PILOT_READINESS_EXECUTION_RETENTION_DAYS ||
      String(DEFAULT_RETENTION_POLICY.pilotReadinessExecutionRetentionDays)
    ),
    dryRun: process.env.PILOT_RETENTION_DRY_RUN === 'true',
  };
}

/**
 * Prune result for a single table
 */
interface PruneResult {
  table: string;
  deletedCount: number;
  oldestDeleted?: Date;
  newestDeleted?: Date;
  error?: string;
}

/**
 * Overall retention job result
 */
interface RetentionJobResult {
  success: boolean;
  dryRun: boolean;
  results: PruneResult[];
  totalDeleted: number;
  duration: number;
  timestamp: string;
}

/**
 * Prune pilot smoke test logs older than retention period
 */
async function pruneSmokeTestLogs(
  retentionDays: number,
  dryRun: boolean
): Promise<PruneResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    // Find logs to delete
    const logsToDelete = await prisma.pilotSmokeTestLog.findMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        timestamp: true,
      },
    });

    const count = logsToDelete.length;

    if (count === 0) {
      return {
        table: 'PilotSmokeTestLog',
        deletedCount: 0,
      };
    }

    const oldestDeleted = logsToDelete[0].timestamp;
    const newestDeleted = logsToDelete[count - 1].timestamp;

    // Delete if not dry run
    if (!dryRun) {
      await prisma.pilotSmokeTestLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });
    }

    log.info(
      `${dryRun ? '[DRY RUN]' : ''} Pruned ${count} smoke test logs older than ${cutoffDate.toISOString()}`
    );

    return {
      table: 'PilotSmokeTestLog',
      deletedCount: count,
      oldestDeleted,
      newestDeleted,
    };
  } catch (error: any) {
    log.error('[Retention] Error pruning smoke test logs:', error);
    return {
      table: 'PilotSmokeTestLog',
      deletedCount: 0,
      error: error.message,
    };
  }
}

/**
 * Prune SLO evaluation records older than retention period
 */
async function pruneSloEvaluations(
  retentionDays: number,
  dryRun: boolean
): Promise<PruneResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const evaluationsToDelete = await prisma.sloEvaluation.findMany({
      where: {
        evaluationDate: {
          lt: cutoffDate,
        },
      },
      orderBy: { evaluationDate: 'asc' },
      select: {
        id: true,
        evaluationDate: true,
      },
    });

    const count = evaluationsToDelete.length;

    if (count === 0) {
      return {
        table: 'SloEvaluation',
        deletedCount: 0,
      };
    }

    const oldestDeleted = evaluationsToDelete[0].evaluationDate;
    const newestDeleted = evaluationsToDelete[count - 1].evaluationDate;

    if (!dryRun) {
      await prisma.sloEvaluation.deleteMany({
        where: {
          evaluationDate: {
            lt: cutoffDate,
          },
        },
      });
    }

    log.info(
      `${dryRun ? '[DRY RUN]' : ''} Pruned ${count} SLO evaluations older than ${cutoffDate.toISOString()}`
    );

    return {
      table: 'SloEvaluation',
      deletedCount: count,
      oldestDeleted,
      newestDeleted,
    };
  } catch (error: any) {
    log.error('[Retention] Error pruning SLO evaluations:', error);
    return {
      table: 'SloEvaluation',
      deletedCount: 0,
      error: error.message,
    };
  }
}

/**
 * Prune pilot readiness execution logs older than retention period
 */
async function prunePilotReadinessExecutions(
  retentionDays: number,
  dryRun: boolean
): Promise<PruneResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const executionsToDelete = await prisma.pilotReadinessExecution.findMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        timestamp: true,
      },
    });

    const count = executionsToDelete.length;

    if (count === 0) {
      return {
        table: 'PilotReadinessExecution',
        deletedCount: 0,
      };
    }

    const oldestDeleted = executionsToDelete[0].timestamp;
    const newestDeleted = executionsToDelete[count - 1].timestamp;

    if (!dryRun) {
      await prisma.pilotReadinessExecution.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });
    }

    log.info(
      `${dryRun ? '[DRY RUN]' : ''} Pruned ${count} pilot readiness executions older than ${cutoffDate.toISOString()}`
    );

    return {
      table: 'PilotReadinessExecution',
      deletedCount: count,
      oldestDeleted,
      newestDeleted,
    };
  } catch (error: any) {
    log.error('[Retention] Error pruning pilot readiness executions:', error);
    return {
      table: 'PilotReadinessExecution',
      deletedCount: 0,
      error: error.message,
    };
  }
}

/**
 * Run retention policy (prune old logs)
 */
export async function runRetentionPolicy(
  config: RetentionPolicyConfig = getRetentionPolicy()
): Promise<RetentionJobResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  log.info(`🗑️ [Retention] Starting retention policy ${config.dryRun ? '(DRY RUN)' : ''}...`);
  log.info(`📅 [Retention] Smoke test logs: ${config.smokeTestLogRetentionDays} days`);
  log.info(`📅 [Retention] SLO evaluations: ${config.sloEvaluationRetentionDays} days`);
  log.info(`📅 [Retention] Pilot executions: ${config.pilotReadinessExecutionRetentionDays} days`);

  const results: PruneResult[] = [];

  // Prune smoke test logs
  const smokeResult = await pruneSmokeTestLogs(
    config.smokeTestLogRetentionDays,
    config.dryRun
  );
  results.push(smokeResult);

  // Prune SLO evaluations
  const sloResult = await pruneSloEvaluations(
    config.sloEvaluationRetentionDays,
    config.dryRun
  );
  results.push(sloResult);

  // Prune pilot readiness executions
  const executionResult = await prunePilotReadinessExecutions(
    config.pilotReadinessExecutionRetentionDays,
    config.dryRun
  );
  results.push(executionResult);

  // Calculate totals
  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
  const hasErrors = results.some(r => r.error);
  const duration = Date.now() - startTime;

  log.info(`✅ [Retention] Completed in ${duration}ms`);
  log.info(`🗑️ [Retention] Total deleted: ${totalDeleted} records`);

  if (hasErrors) {
    log.error('⚠️ [Retention] Some tables had errors during pruning');
  }

  return {
    success: !hasErrors,
    dryRun: config.dryRun,
    results,
    totalDeleted,
    duration,
    timestamp,
  };
}

/**
 * Start retention policy cron job
 * Runs daily at 3 AM
 */
export function startRetentionPolicyCron(): void {
  const cronSchedule = process.env.PILOT_RETENTION_CRON_SCHEDULE || '0 3 * * *'; // Daily at 3 AM

  log.info(`📅 [Retention Policy] Starting with schedule: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    try {
      await runRetentionPolicy();
    } catch (error: any) {
      log.error('[Retention Policy] Unexpected error:', error);
    }
  });

  // Run once immediately on startup (optional)
  if (process.env.PILOT_RETENTION_RUN_ON_STARTUP === 'true') {
    log.info('🚀 [Retention Policy] Running initial cleanup on startup...');
    runRetentionPolicy().catch(error => {
      log.error('[Retention Policy] Initial run failed:', error);
    });
  }
}

/**
 * Export for testing
 */
export default {
  getRetentionPolicy,
  runRetentionPolicy,
  startRetentionPolicyCron,
  DEFAULT_RETENTION_POLICY,
};

// Auto-start if this file is run directly
if (require.main === module) {
  log.info('🎯 [Retention Policy] Starting in standalone mode...');
  startRetentionPolicyCron();

  // Keep process alive
  process.on('SIGINT', () => {
    log.info('\n🛑 [Retention Policy] Shutting down...');
    process.exit(0);
  });
}


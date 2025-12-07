/**
 * SLO Evaluation Job
 * B133A-PILOT-004: Aggregates uptime and error budget over 7 days
 *
 * This job:
 * 1. Aggregates smoke test results from logs
 * 2. Calculates uptime, error rate, and P95 latency
 * 3. Stores daily SLO summary with pass/fail flag
 * 4. Supports historical trending
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import {
  getPilotSloConfig,
  SloMetricType,
  SloStatus,
  SloEvaluationResult,
  validateSloMetric,
  calculateErrorBudgetConsumption,
} from '../apps/api/src/config/pilotSlo';

const prisma = new PrismaClient();

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;

  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

/**
 * Aggregate smoke test results over a time period
 */
async function aggregateSmokeTestResults(
  startDate: Date,
  endDate: Date
): Promise<{
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  uptime: number;
  errorRate: number;
  durations: number[];
}> {
  const results = await prisma.pilotSmokeTestLog.findMany({
    where: {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const failedTests = totalTests - successfulTests;

  const uptime = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;
  const errorRate = totalTests > 0 ? (failedTests / totalTests) * 100 : 0;

  const durations = results.map(r => r.totalDuration);

  return {
    totalTests,
    successfulTests,
    failedTests,
    uptime,
    errorRate,
    durations,
  };
}

/**
 * Aggregate anchor operation latencies (simulated for now)
 * TODO: Replace with actual anchor operation metrics when available
 */
async function aggregateAnchorLatencies(
  startDate: Date,
  endDate: Date
): Promise<number[]> {
  // For now, use smoke test durations as proxy for anchor latencies
  // In production, this should query actual anchor operation metrics
  const results = await prisma.pilotSmokeTestLog.findMany({
    where: {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      totalDuration: true,
    },
  });

  return results.map(r => r.totalDuration);
}

/**
 * Evaluate SLOs for a given time period
 */
export async function evaluateSlos(
  startDate: Date,
  endDate: Date
): Promise<SloEvaluationResult> {
  const config = getPilotSloConfig();

  // Aggregate smoke test results
  const smokeResults = await aggregateSmokeTestResults(startDate, endDate);

  // Aggregate anchor latencies
  const anchorLatencies = await aggregateAnchorLatencies(startDate, endDate);
  const sortedLatencies = [...anchorLatencies].sort((a, b) => a - b);
  const p95Latency = calculatePercentile(sortedLatencies, 95);

  // Validate each metric
  const uptimeMetric = validateSloMetric(
    SloMetricType.UPTIME,
    smokeResults.uptime,
    config
  );

  const errorRateMetric = validateSloMetric(
    SloMetricType.ERROR_RATE,
    smokeResults.errorRate,
    config
  );

  const latencyMetric = validateSloMetric(
    SloMetricType.ANCHOR_P95_LATENCY,
    p95Latency,
    config
  );

  // Calculate overall status
  const metrics = [uptimeMetric, errorRateMetric, latencyMetric];
  const failedMetrics = metrics.filter(m => m.status === SloStatus.FAIL);
  const overallStatus = failedMetrics.length === 0 ? SloStatus.PASS : SloStatus.FAIL;
  const passed = overallStatus === SloStatus.PASS;

  // Calculate error budget consumption
  const errorBudgetConsumed = calculateErrorBudgetConsumption(smokeResults.uptime, config);

  // Generate failure reasons
  const reasons = failedMetrics.map(m => m.details || `${m.metric} failed`);

  // Add warning if error budget is heavily consumed
  if (errorBudgetConsumed > config.criticalAlertThreshold && passed) {
    reasons.push(
      `Warning: ${errorBudgetConsumed.toFixed(1)}% of error budget consumed (threshold: ${config.criticalAlertThreshold}%)`
    );
  }

  return {
    status: overallStatus,
    metrics,
    evaluationPeriodStart: startDate,
    evaluationPeriodEnd: endDate,
    errorBudgetConsumed,
    passed,
    reasons: reasons.length > 0 ? reasons : undefined,
  };
}

/**
 * Store SLO evaluation result to database
 */
async function storeSloEvaluation(
  evaluation: SloEvaluationResult,
  aggregateData: any
): Promise<void> {
  try {
    await prisma.sloEvaluation.create({
      data: {
        evaluationDate: new Date(),
        periodStart: evaluation.evaluationPeriodStart,
        periodEnd: evaluation.evaluationPeriodEnd,
        status: evaluation.status,
        passed: evaluation.passed,
        errorBudgetConsumed: evaluation.errorBudgetConsumed,
        metrics: evaluation.metrics as any,
        reasons: evaluation.reasons || [],
        aggregateData: aggregateData as any,
      },
    });

    console.log(`✅ [SLO Evaluator] Stored evaluation result: ${evaluation.status.toUpperCase()}`);
  } catch (error: any) {
    console.error('[SLO Evaluator] Failed to store evaluation:', error.message);
  }
}

/**
 * Run SLO evaluation for the configured window
 */
export async function runSloEvaluation(): Promise<SloEvaluationResult> {
  console.log('📊 [SLO Evaluator] Starting SLO evaluation...');

  const config = getPilotSloConfig();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - config.evaluationWindowDays);

  console.log(`📅 [SLO Evaluator] Evaluating period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

  // Aggregate results
  const smokeResults = await aggregateSmokeTestResults(startDate, endDate);
  console.log(`📈 [SLO Evaluator] Smoke tests: ${smokeResults.successfulTests}/${smokeResults.totalTests} passed (${smokeResults.uptime.toFixed(2)}% uptime)`);

  // Evaluate SLOs
  const evaluation = await evaluateSlos(startDate, endDate);

  // Store to database
  await storeSloEvaluation(evaluation, {
    totalTests: smokeResults.totalTests,
    successfulTests: smokeResults.successfulTests,
    failedTests: smokeResults.failedTests,
    uptime: smokeResults.uptime,
    errorRate: smokeResults.errorRate,
  });

  // Log results
  if (evaluation.passed) {
    console.log(`✅ [SLO Evaluator] SLO PASSED`);
  } else {
    console.error(`❌ [SLO Evaluator] SLO FAILED`);
    if (evaluation.reasons) {
      evaluation.reasons.forEach(reason => {
        console.error(`   - ${reason}`);
      });
    }
  }

  console.log(`📊 [SLO Evaluator] Error budget consumed: ${evaluation.errorBudgetConsumed.toFixed(2)}%`);

  return evaluation;
}

/**
 * Get latest SLO evaluation
 */
export async function getLatestSloEvaluation(): Promise<SloEvaluationResult | null> {
  try {
    const latest = await prisma.sloEvaluation.findFirst({
      orderBy: { evaluationDate: 'desc' },
    });

    if (!latest) {
      return null;
    }

    return {
      status: latest.status as SloStatus,
      metrics: latest.metrics as any,
      evaluationPeriodStart: latest.periodStart,
      evaluationPeriodEnd: latest.periodEnd,
      errorBudgetConsumed: latest.errorBudgetConsumed,
      passed: latest.passed,
      reasons: latest.reasons.length > 0 ? latest.reasons : undefined,
    };
  } catch (error: any) {
    console.error('[SLO Evaluator] Failed to fetch latest evaluation:', error.message);
    return null;
  }
}

/**
 * Get SLO evaluation history
 */
export async function getSloEvaluationHistory(
  limit: number = 30
): Promise<SloEvaluationResult[]> {
  try {
    const history = await prisma.sloEvaluation.findMany({
      orderBy: { evaluationDate: 'desc' },
      take: limit,
    });

    return history.map(record => ({
      status: record.status as SloStatus,
      metrics: record.metrics as any,
      evaluationPeriodStart: record.periodStart,
      evaluationPeriodEnd: record.periodEnd,
      errorBudgetConsumed: record.errorBudgetConsumed,
      passed: record.passed,
      reasons: record.reasons.length > 0 ? record.reasons : undefined,
    }));
  } catch (error: any) {
    console.error('[SLO Evaluator] Failed to fetch evaluation history:', error.message);
    return [];
  }
}

/**
 * Start the SLO evaluation cron job
 * Runs daily at 2 AM
 */
export function startSloEvaluationCron(): void {
  const cronSchedule = process.env.SLO_EVALUATION_CRON_SCHEDULE || '0 2 * * *'; // Daily at 2 AM

  console.log(`📅 [SLO Evaluator] Starting with schedule: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    try {
      await runSloEvaluation();
    } catch (error: any) {
      console.error('[SLO Evaluator] Unexpected error:', error);
    }
  });

  // Run once immediately on startup (optional)
  if (process.env.SLO_EVALUATION_RUN_ON_STARTUP === 'true') {
    console.log('🚀 [SLO Evaluator] Running initial evaluation on startup...');
    runSloEvaluation().catch(error => {
      console.error('[SLO Evaluator] Initial run failed:', error);
    });
  }
}

/**
 * Export for testing and external use
 */
export default {
  runSloEvaluation,
  evaluateSlos,
  getLatestSloEvaluation,
  getSloEvaluationHistory,
  startSloEvaluationCron,
};

// Auto-start if this file is run directly
if (require.main === module) {
  console.log('🎯 [SLO Evaluator] Starting in standalone mode...');
  startSloEvaluationCron();

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n🛑 [SLO Evaluator] Shutting down...');
    process.exit(0);
  });
}


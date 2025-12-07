/**
 * Pilot Readiness Status and Report API
 * B133A-PILOT-005: /pilot/status and /pilot/report endpoints
 *
 * /status - Returns current pass/fail status with reasons
 * /report - Returns JSON/CSV of last 7 days of data
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv';
import {
  getLatestSloEvaluation,
  getSloEvaluationHistory,
} from '../../../../jobs/sloEvaluator';
import { getPilotSloConfig } from '../../config/pilotSlo';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /pilot/status
 *
 * Returns current pilot readiness status with pass/fail and reasons
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Get latest SLO evaluation
    const latestEvaluation = await getLatestSloEvaluation();

    if (!latestEvaluation) {
      return res.status(200).json({
        status: 'unknown',
        passed: false,
        message: 'No SLO evaluations found. Run initial evaluation.',
        timestamp: new Date().toISOString(),
      });
    }

    // Get latest smoke test
    const latestSmokeTest = await prisma.pilotSmokeTestLog.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    // Calculate time since last evaluation
    const evaluationAge = new Date().getTime() - new Date(latestEvaluation.evaluationPeriodEnd).getTime();
    const evaluationAgeHours = evaluationAge / (1000 * 60 * 60);

    // Build status response
    const response = {
      status: latestEvaluation.status,
      passed: latestEvaluation.passed,
      timestamp: new Date().toISOString(),
      evaluation: {
        periodStart: latestEvaluation.evaluationPeriodStart,
        periodEnd: latestEvaluation.evaluationPeriodEnd,
        ageHours: Math.round(evaluationAgeHours * 10) / 10,
        errorBudgetConsumed: latestEvaluation.errorBudgetConsumed,
      },
      metrics: latestEvaluation.metrics.map(m => ({
        metric: m.metric,
        value: m.value,
        threshold: m.threshold,
        status: m.status,
        details: m.details,
      })),
      reasons: latestEvaluation.reasons || [],
      latestSmokeTest: latestSmokeTest ? {
        success: latestSmokeTest.success,
        timestamp: latestSmokeTest.timestamp,
        duration: latestSmokeTest.totalDuration,
      } : null,
      countdownToLaunch: calculateCountdownToLaunch(latestEvaluation),
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('[Pilot Status] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch pilot status',
      message: error.message,
    });
  }
});

/**
 * Calculate countdown to 7-day launch readiness mark
 */
function calculateCountdownToLaunch(evaluation: any): {
  daysRemaining: number;
  hoursRemaining: number;
  targetDate: string;
  ready: boolean;
} {
  const config = getPilotSloConfig();
  const evaluationStart = new Date(evaluation.evaluationPeriodStart);
  const targetDate = new Date(evaluationStart);
  targetDate.setDate(targetDate.getDate() + config.evaluationWindowDays);

  const now = new Date();
  const timeRemaining = targetDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60)));
  const ready = timeRemaining <= 0 && evaluation.passed;

  return {
    daysRemaining,
    hoursRemaining,
    targetDate: targetDate.toISOString(),
    ready,
  };
}

/**
 * GET /pilot/report
 *
 * Returns detailed report of last N days (default 7)
 * Supports JSON and CSV formats
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string)?.toLowerCase() || 'json';
    const days = parseInt(req.query.days as string) || 7;

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Format must be "json" or "csv"',
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch smoke test logs
    const smokeTests = await prisma.pilotSmokeTestLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Fetch SLO evaluations
    const sloEvaluations = await prisma.sloEvaluation.findMany({
      where: {
        periodEnd: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { evaluationDate: 'asc' },
    });

    // Build report data
    const reportData = {
      generatedAt: new Date().toISOString(),
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      summary: {
        totalSmokeTests: smokeTests.length,
        successfulSmokeTests: smokeTests.filter(t => t.success).length,
        failedSmokeTests: smokeTests.filter(t => !t.success).length,
        uptime: smokeTests.length > 0
          ? ((smokeTests.filter(t => t.success).length / smokeTests.length) * 100).toFixed(2)
          : '0.00',
        totalSloEvaluations: sloEvaluations.length,
        passedSloEvaluations: sloEvaluations.filter(e => e.passed).length,
        failedSloEvaluations: sloEvaluations.filter(e => !e.passed).length,
      },
      smokeTests: smokeTests.map(test => ({
        id: test.id,
        timestamp: test.timestamp,
        success: test.success,
        duration: test.totalDuration,
        errorMessage: test.errorMessage,
      })),
      sloEvaluations: sloEvaluations.map(evaluation => ({
        id: evaluation.id,
        evaluationDate: evaluation.evaluationDate,
        periodStart: evaluation.periodStart,
        periodEnd: evaluation.periodEnd,
        status: evaluation.status,
        passed: evaluation.passed,
        errorBudgetConsumed: evaluation.errorBudgetConsumed,
        reasons: evaluation.reasons,
      })),
    };

    if (format === 'json') {
      return res.status(200).json(reportData);
    } else {
      // Generate CSV
      const csvData = generateCsvReport(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=pilot-report-${days}days.csv`);
      return res.status(200).send(csvData);
    }

  } catch (error: any) {
    console.error('[Pilot Report] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate pilot report',
      message: error.message,
    });
  }
});

/**
 * Generate CSV report from report data
 */
function generateCsvReport(reportData: any): string {
  // Flatten smoke tests for CSV
  const smokeTestRows = reportData.smokeTests.map((test: any) => ({
    type: 'smoke_test',
    timestamp: test.timestamp,
    success: test.success,
    duration: test.duration,
    error: test.errorMessage || '',
  }));

  // Flatten SLO evaluations for CSV
  const sloRows = reportData.sloEvaluations.map((evaluation: any) => ({
    type: 'slo_evaluation',
    timestamp: evaluation.evaluationDate,
    success: evaluation.passed,
    status: evaluation.status,
    errorBudgetConsumed: evaluation.errorBudgetConsumed,
    reasons: evaluation.reasons.join('; '),
  }));

  // Combine all rows
  const allRows = [...smokeTestRows, ...sloRows];

  if (allRows.length === 0) {
    return 'No data available for the specified period\n';
  }

  // Generate CSV
  try {
    const parser = new Parser({
      fields: ['type', 'timestamp', 'success', 'duration', 'status', 'errorBudgetConsumed', 'error', 'reasons'],
    });
    return parser.parse(allRows);
  } catch (error) {
    console.error('[CSV Generation] Error:', error);
    return 'Error generating CSV report\n';
  }
}

/**
 * GET /pilot/metrics
 *
 * Returns detailed metrics for dashboard visualizations
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch smoke test logs with hourly aggregation
    const smokeTests = await prisma.pilotSmokeTestLog.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by hour for time series
    const hourlyMetrics = new Map<string, {
      timestamp: string;
      tests: number;
      successes: number;
      failures: number;
      totalDuration: number;
    }>();

    smokeTests.forEach(test => {
      const hourKey = new Date(test.timestamp).toISOString().substring(0, 13) + ':00:00.000Z';

      if (!hourlyMetrics.has(hourKey)) {
        hourlyMetrics.set(hourKey, {
          timestamp: hourKey,
          tests: 0,
          successes: 0,
          failures: 0,
          totalDuration: 0,
        });
      }

      const metrics = hourlyMetrics.get(hourKey)!;
      metrics.tests++;
      if (test.success) {
        metrics.successes++;
      } else {
        metrics.failures++;
      }
      metrics.totalDuration += test.totalDuration;
    });

    // Convert to array and calculate derived metrics
    const timeSeriesData = Array.from(hourlyMetrics.values()).map(metrics => ({
      timestamp: metrics.timestamp,
      tests: metrics.tests,
      successRate: metrics.tests > 0 ? (metrics.successes / metrics.tests) * 100 : 0,
      errorRate: metrics.tests > 0 ? (metrics.failures / metrics.tests) * 100 : 0,
      avgDuration: metrics.tests > 0 ? metrics.totalDuration / metrics.tests : 0,
    }));

    return res.status(200).json({
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      timeSeries: timeSeriesData,
      totalDataPoints: smokeTests.length,
    });

  } catch (error: any) {
    console.error('[Pilot Metrics] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch pilot metrics',
      message: error.message,
    });
  }
});

/**
 * GET /pilot/health
 *
 * Quick health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check if we have recent data
    const latestSmokeTest = await prisma.pilotSmokeTestLog.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    const latestEvaluation = await prisma.sloEvaluation.findFirst({
      orderBy: { evaluationDate: 'desc' },
    });

    const healthy = latestSmokeTest && latestEvaluation;

    return res.status(healthy ? 200 : 503).json({
      healthy,
      latestSmokeTest: latestSmokeTest?.timestamp,
      latestEvaluation: latestEvaluation?.evaluationDate,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return res.status(503).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;


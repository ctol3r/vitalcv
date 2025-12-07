/**
 * Pilot Readiness Cron Job
 * B133A-PILOT-003: Executes smoke tests hourly and logs results to database
 *
 * This job:
 * 1. Runs smoke tests every hour
 * 2. Persists results to database
 * 3. Raises PagerDuty events on failures
 */

import cron from 'node-cron';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * PagerDuty configuration
 */
interface PagerDutyConfig {
  enabled: boolean;
  integrationKey?: string;
  apiUrl: string;
}

/**
 * Get PagerDuty configuration
 */
function getPagerDutyConfig(): PagerDutyConfig {
  return {
    enabled: process.env.PAGERDUTY_ENABLED === 'true',
    integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
    apiUrl: process.env.PAGERDUTY_API_URL || 'https://events.pagerduty.com/v2/enqueue',
  };
}

/**
 * Trigger PagerDuty alert
 */
async function triggerPagerDutyAlert(
  severity: 'critical' | 'error' | 'warning',
  summary: string,
  details: Record<string, any>
): Promise<void> {
  const config = getPagerDutyConfig();

  if (!config.enabled) {
    console.log('[PagerDuty] Disabled. Would have sent alert:', { severity, summary });
    return;
  }

  if (!config.integrationKey) {
    console.error('[PagerDuty] Integration key not configured');
    return;
  }

  try {
    const payload = {
      routing_key: config.integrationKey,
      event_action: 'trigger',
      payload: {
        summary,
        severity,
        source: 'pilot-readiness-cron',
        timestamp: new Date().toISOString(),
        custom_details: details,
      },
    };

    const response = await axios.post(config.apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    console.log('[PagerDuty] Alert sent successfully:', response.data);
  } catch (error: any) {
    console.error('[PagerDuty] Failed to send alert:', error.message);
  }
}

/**
 * Execute smoke test via API
 */
async function executeSmokeTest(): Promise<{
  success: boolean;
  duration: number;
  error?: string;
}> {
  const apiUrl = process.env.PILOT_API_URL || 'http://localhost:3000';
  const smokeTestUrl = `${apiUrl}/pilot/smoke`;

  try {
    const startTime = Date.now();

    const response = await axios.post(smokeTestUrl, {}, {
      timeout: 30000, // 30 second timeout
      validateStatus: () => true, // Don't throw on any status
    });

    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success) {
      return {
        success: true,
        duration,
      };
    } else {
      return {
        success: false,
        duration,
        error: response.data.errorMessage || `HTTP ${response.status}`,
      };
    }
  } catch (error: any) {
    console.error('[Smoke Test] Request failed:', error.message);
    return {
      success: false,
      duration: 0,
      error: error.message || 'Request failed',
    };
  }
}

/**
 * Log smoke test execution to database
 */
async function logExecution(
  success: boolean,
  duration: number,
  error?: string
): Promise<void> {
  try {
    await prisma.pilotReadinessExecution.create({
      data: {
        type: 'smoke_test',
        success,
        duration,
        timestamp: new Date(),
        errorMessage: error,
      },
    });
  } catch (dbError: any) {
    console.error('[Database] Failed to log execution:', dbError.message);
  }
}

/**
 * Check for consecutive failures and alert if threshold exceeded
 */
async function checkConsecutiveFailures(): Promise<void> {
  try {
    const recentExecutions = await prisma.pilotReadinessExecution.findMany({
      where: {
        type: 'smoke_test',
      },
      orderBy: { timestamp: 'desc' },
      take: 3,
    });

    const allFailed = recentExecutions.length === 3 &&
                     recentExecutions.every(e => !e.success);

    if (allFailed) {
      await triggerPagerDutyAlert(
        'critical',
        'Pilot Readiness: 3 Consecutive Smoke Test Failures',
        {
          failures: recentExecutions.map(e => ({
            timestamp: e.timestamp,
            error: e.errorMessage,
          })),
          action_required: 'Immediate investigation required',
        }
      );
    }
  } catch (error: any) {
    console.error('[Consecutive Failures Check] Failed:', error.message);
  }
}

/**
 * Main cron job handler
 */
async function runPilotReadinessCron(): Promise<void> {
  console.log('🔄 [Pilot Readiness Cron] Starting smoke test execution...');

  const result = await executeSmokeTest();

  // Log to database
  await logExecution(result.success, result.duration, result.error);

  if (result.success) {
    console.log(`✅ [Pilot Readiness Cron] Smoke test passed (${result.duration}ms)`);
  } else {
    console.error(`❌ [Pilot Readiness Cron] Smoke test failed: ${result.error}`);

    // Trigger PagerDuty alert for single failure
    await triggerPagerDutyAlert(
      'error',
      'Pilot Readiness: Smoke Test Failure',
      {
        error: result.error,
        duration: result.duration,
        timestamp: new Date().toISOString(),
      }
    );

    // Check for consecutive failures
    await checkConsecutiveFailures();
  }
}

/**
 * Start the cron job
 * Runs every hour at minute 0
 */
export function startPilotReadinessCron(): void {
  const cronSchedule = process.env.PILOT_READINESS_CRON_SCHEDULE || '0 * * * *'; // Every hour

  console.log(`📅 [Pilot Readiness Cron] Starting with schedule: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    try {
      await runPilotReadinessCron();
    } catch (error: any) {
      console.error('[Pilot Readiness Cron] Unexpected error:', error);
    }
  });

  // Run once immediately on startup (optional)
  if (process.env.PILOT_READINESS_RUN_ON_STARTUP === 'true') {
    console.log('🚀 [Pilot Readiness Cron] Running initial smoke test on startup...');
    runPilotReadinessCron().catch(error => {
      console.error('[Pilot Readiness Cron] Initial run failed:', error);
    });
  }
}

/**
 * Manual execution helper (for testing)
 */
export async function runManually(): Promise<void> {
  console.log('🔧 [Pilot Readiness Cron] Manual execution triggered');
  await runPilotReadinessCron();
}

/**
 * Export for testing
 */
export default {
  startPilotReadinessCron,
  runManually,
  executeSmokeTest,
  triggerPagerDutyAlert,
};

// Auto-start if this file is run directly
if (require.main === module) {
  console.log('🎯 [Pilot Readiness Cron] Starting in standalone mode...');
  startPilotReadinessCron();

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n🛑 [Pilot Readiness Cron] Shutting down...');
    process.exit(0);
  });
}


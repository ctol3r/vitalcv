/**
 * B115A-EUDI-007: EUDI trust-list nightly refresh scheduler
 *
 * Schedules the trust list refresh job to run nightly at 2:00 AM UTC
 * Uses node-cron for scheduling (or can be configured via system cron)
 */

import { runTrustListRefreshJob } from './trust-list-refresh.js';

/**
 * Schedule nightly refresh at 2:00 AM UTC (configurable via env)
 * Cron format: minute hour day month dayOfWeek
 * Default: "0 2 * * *" = 2:00 AM UTC daily
 */
const CRON_SCHEDULE = process.env.EUDI_TRUST_LIST_REFRESH_CRON || '0 2 * * *';

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start the scheduler
 * B115A-EUDI-007: Nightly refresh scheduled
 */
export function startTrustListScheduler(): void {
  if (schedulerInterval) {
    console.warn('[EUDI Trust List Scheduler] Already running');
    return;
  }

  console.log(`[EUDI Trust List Scheduler] Starting scheduler with cron: ${CRON_SCHEDULE}`);

  // Parse cron schedule (simple implementation for "0 2 * * *" format)
  // For production, use node-cron library: npm install node-cron @types/node-cron
  const cronParts = CRON_SCHEDULE.split(' ');
  if (cronParts.length !== 5) {
    console.error('[EUDI Trust List Scheduler] Invalid cron format. Expected: "minute hour day month dayOfWeek"');
    return;
  }

  const minute = parseInt(cronParts[0], 10);
  const hour = parseInt(cronParts[1], 10);

  // Calculate milliseconds until next scheduled time
  function getMsUntilNextRun(): number {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setUTCHours(hour, minute, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    return nextRun.getTime() - now.getTime();
  }

  // Schedule first run
  const scheduleNextRun = () => {
    const msUntilNext = getMsUntilNextRun();
    console.log(`[EUDI Trust List Scheduler] Next run scheduled in ${Math.floor(msUntilNext / 1000 / 60)} minutes`);

    schedulerInterval = setTimeout(async () => {
      if (isRunning) {
        console.warn('[EUDI Trust List Scheduler] Previous run still in progress, skipping');
        scheduleNextRun();
        return;
      }

      isRunning = true;
      try {
        console.log('[EUDI Trust List Scheduler] Running scheduled refresh...');
        await runTrustListRefreshJob();
      } catch (error) {
        console.error('[EUDI Trust List Scheduler] Error during scheduled refresh:', error);
      } finally {
        isRunning = false;
        scheduleNextRun(); // Schedule next run
      }
    }, msUntilNext);
  };

  scheduleNextRun();
}

/**
 * Stop the scheduler
 */
export function stopTrustListScheduler(): void {
  if (schedulerInterval) {
    clearTimeout(schedulerInterval);
    schedulerInterval = null;
    console.log('[EUDI Trust List Scheduler] Stopped');
  }
}

/**
 * Run immediately (for testing or manual trigger)
 */
export async function runTrustListRefreshNow(): Promise<void> {
  if (isRunning) {
    throw new Error('Trust list refresh is already running');
  }

  isRunning = true;
  try {
    await runTrustListRefreshJob();
  } finally {
    isRunning = false;
  }
}

// If run directly, start the scheduler
// Check if this is the main module (ES modules compatible)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scheduler.ts') || process.argv[1]?.endsWith('scheduler.js')) {
  console.log('[EUDI Trust List Scheduler] Starting as standalone process...');
  startTrustListScheduler();

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[EUDI Trust List Scheduler] Received SIGTERM, stopping...');
    stopTrustListScheduler();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[EUDI Trust List Scheduler] Received SIGINT, stopping...');
    stopTrustListScheduler();
    process.exit(0);
  });
}


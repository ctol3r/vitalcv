/**
 * monitoringScheduler.ts — Wave 245: Async Trust Engine
 *
 * Registers a cron job (every 6 hours) that calls runMonitoringCycle().
 * Controlled by MONITORING_ENABLED env var (default: false for safety).
 *
 * Usage: call startMonitoringScheduler() in app.ts startup.
 */

import * as cron from 'node-cron';
import { runMonitoringCycle, type MonitoringCycleReport } from './asyncTrustEngine';
import { log } from '../../obs/logger';

// ── State ─────────────────────────────────────────────────────────────────────

let schedulerTask: cron.ScheduledTask | null = null;
let lastCycleReport: MonitoringCycleReport | null = null;
let lastCycleTime: Date | null = null;
let isRunning = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getLastCycleReport(): MonitoringCycleReport | null {
  return lastCycleReport;
}

export function getLastCycleTime(): Date | null {
  return lastCycleTime;
}

export function isSchedulerRunning(): boolean {
  return schedulerTask !== null;
}

export function isCycleInProgress(): boolean {
  return isRunning;
}

// ── Cycle runner ──────────────────────────────────────────────────────────────

async function runCycle(): Promise<void> {
  if (isRunning) {
    log('info', 'monitoring_scheduler: cycle_skipped — already running');
    return;
  }

  isRunning = true;
  try {
    log('info', 'monitoring_scheduler: cycle_start');
    const report = await runMonitoringCycle();
    lastCycleReport = report;
    lastCycleTime = new Date();
    log('info', 'monitoring_scheduler: cycle_complete', {
      npisScanned: report.npisScanned,
      stateChanges: report.stateChanges.length,
      alerts: report.alerts,
      capsulesAffected: report.capsulesAffected,
      durationMs: report.durationMs,
    });
  } catch (err) {
    log('error', 'monitoring_scheduler: cycle_error', { error: String(err) });
  } finally {
    isRunning = false;
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Start the monitoring scheduler.
 * Runs every 6 hours: cron '0 every-6 * * *'
 * No-op if MONITORING_ENABLED != 'true'.
 */
export function startMonitoringScheduler(): void {
  const enabled = process.env.MONITORING_ENABLED === 'true';

  if (!enabled) {
    log('info', 'monitoring_scheduler: disabled (MONITORING_ENABLED != true)');
    return;
  }

  if (schedulerTask) {
    log('warn', 'monitoring_scheduler: already started — skipping duplicate start');
    return;
  }

  // Every 6 hours
  schedulerTask = cron.schedule('0 */6 * * *', () => {
    void runCycle();
  });

  log('info', 'monitoring_scheduler: started (every 6 hours)');
}

/**
 * Stop the monitoring scheduler. Idempotent.
 */
export function stopMonitoringScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    log('info', 'monitoring_scheduler: stopped');
  }
}

/**
 * Manually trigger a monitoring cycle (for admin endpoints).
 */
export async function triggerMonitoringCycle(): Promise<MonitoringCycleReport> {
  await runCycle();
  return lastCycleReport!;
}

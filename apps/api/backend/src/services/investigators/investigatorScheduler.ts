import * as cron from 'node-cron';
import { log } from '../../obs/logger';
import { runScheduledInvestigators } from './investigatorEngineService';

let schedulerTask: cron.ScheduledTask | null = null;
let initialRunTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let lastRunAt: string | null = null;

export function getInvestigatorSchedulerState() {
  return {
    running: schedulerTask !== null,
    inProgress: isRunning,
    lastRunAt,
  };
}

async function runCycle(): Promise<void> {
  if (isRunning) {
    log('info', 'investigator_scheduler: cycle_skipped', {
      reason: 'already_running',
    });
    return;
  }

  isRunning = true;
  try {
    const results = await runScheduledInvestigators();
    lastRunAt = new Date().toISOString();
    log('info', 'investigator_scheduler: cycle_complete', {
      investigatorsRun: results.length,
      findingsGenerated: results.reduce((sum, result) => sum + result.findingsGenerated, 0),
    });
  } catch (error) {
    log('error', 'investigator_scheduler: cycle_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isRunning = false;
  }
}

export function startInvestigatorScheduler(): void {
  const enabled = process.env.NODE_ENV !== 'test' && process.env.INVESTIGATORS_ENABLED !== 'false';
  if (!enabled) {
    log('info', 'investigator_scheduler: disabled');
    return;
  }

  if (schedulerTask) {
    return;
  }

  schedulerTask = cron.schedule('*/15 * * * *', () => {
    void runCycle();
  });
  initialRunTimer = setTimeout(() => {
    initialRunTimer = null;
    void runCycle();
  }, 8_000);

  log('info', 'investigator_scheduler: started', {
    cadence: '*/15 * * * *',
    initialDelayMs: 8_000,
  });
}

export function stopInvestigatorScheduler(): void {
  schedulerTask?.stop();
  schedulerTask = null;
  if (initialRunTimer) {
    clearTimeout(initialRunTimer);
    initialRunTimer = null;
  }
}

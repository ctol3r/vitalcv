import { getLatestEventTimestamp } from '../../core/events/eventBus';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { runScheduledInvestigators } from '../investigators/investigatorEngineService';
import { syncPersistedStorylines } from '../storylines/storylineService';

export interface SystemPulse {
  providers: number;
  findings: number;
  storylines: number;
  lastEventAt: string | null;
  systemState: 'ALIVE' | 'WARMING';
}

const RECOVERY_COOLDOWN_MS = 60_000;

let recoveryInFlight: Promise<void> | null = null;
let lastRecoveryStartedAt = 0;

function timestampValue(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function latestTimestamp(values: Array<string | null>): string | null {
  let selected: string | null = null;
  for (const value of values) {
    if (timestampValue(value) > timestampValue(selected)) {
      selected = value;
    }
  }

  return selected;
}

function maybeTriggerInvestigatorRecovery(): void {
  const now = Date.now();
  if (recoveryInFlight || (now - lastRecoveryStartedAt) < RECOVERY_COOLDOWN_MS) {
    return;
  }

  lastRecoveryStartedAt = now;
  recoveryInFlight = runScheduledInvestigators()
    .then((results) => {
      log('info', 'system_pulse_recovery_complete', {
        investigatorsRun: results.length,
        findingsGenerated: results.reduce((sum, result) => sum + result.findingsGenerated, 0),
      });
    })
    .catch((error) => {
      log('warn', 'system_pulse_recovery_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      recoveryInFlight = null;
    });
}

export async function generateSystemPulse(): Promise<SystemPulse> {
  await syncPersistedStorylines();

  const [providers, findings, storylines, latestFinding, latestStoryline] = await Promise.all([
    prisma.provider.count(),
    prisma.investigatorFinding.count(),
    prisma.storyline.count(),
    prisma.investigatorFinding.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.storyline.findFirst({
      orderBy: { lastActivityAt: 'desc' },
      select: { lastActivityAt: true },
    }),
  ]);

  if (findings === 0) {
    log('warn', 'intelligence_failure_detected', {
      event: 'intelligence_failure_detected',
      layer: 'db',
      route: '/api/system/pulse',
      reason: 'finding_count_zero',
      providers,
      findings,
      storylines,
      recoveryTriggered: true,
    });
    maybeTriggerInvestigatorRecovery();
  }

  const lastEventAt = latestTimestamp([
    getLatestEventTimestamp(),
    latestFinding?.updatedAt.toISOString() ?? null,
    latestStoryline?.lastActivityAt.toISOString() ?? null,
  ]);

  return {
    providers,
    findings,
    storylines,
    lastEventAt,
    systemState: providers > 0 && findings > 0 && storylines > 0 && lastEventAt ? 'ALIVE' : 'WARMING',
  };
}

export function resetPulseRecoveryStateForTests(): void {
  recoveryInFlight = null;
  lastRecoveryStartedAt = 0;
}

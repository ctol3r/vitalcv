import { SpanStatusCode, trace } from '@opentelemetry/api';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { runTargetedInvestigators } from '../investigators/investigatorEngineService';
import { IGNITION_INVESTIGATOR_IDS } from '../investigators/ignitionInvestigators';
import { ensureInvestigationSeedDataBootstrapped } from '../investigators/seedInvestigationData';
import { listStorylines } from '../storylines/storylineService';

const intelligenceAutoWarmTracer = trace.getTracer('vitalcv.intelligence-auto-warm');

const AUTO_WARM_COOLDOWN_MS = 60_000;
const AUTO_WARM_TARGET_LIMIT = 25;

export type IntelligenceAutoWarmTrigger =
  | 'startup'
  | 'feed_live_empty'
  | 'manual'
  | 'system_pulse';

export interface IntelligenceAutoWarmResult {
  trigger: IntelligenceAutoWarmTrigger;
  triggered: boolean;
  reason: 'completed' | 'cooldown' | 'in_flight' | 'no_providers';
  seeded: boolean;
  providersBefore: number;
  findingsBefore: number;
  storylinesBefore: number;
  providersAfter: number;
  findingsAfter: number;
  storylinesAfter: number;
  findingsGenerated: number;
  targetProviders: number;
}

type IntelligenceCounts = {
  providers: number;
  findings: number;
  storylines: number;
};

let autoWarmInFlight: Promise<IntelligenceAutoWarmResult> | null = null;
let lastAutoWarmStartedAt = 0;

function logIntelligenceFailure(fields: Record<string, unknown>): void {
  log('warn', 'intelligence_failure_detected', {
    event: 'intelligence_failure_detected',
    ...fields,
  });
}

async function loadCounts(): Promise<IntelligenceCounts> {
  const [providers, findings, storylines] = await Promise.all([
    prisma.provider.count(),
    prisma.investigatorFinding.count(),
    prisma.storyline.count(),
  ]);

  return {
    providers,
    findings,
    storylines,
  };
}

async function loadTargetProviders(limit: number): Promise<string[]> {
  const rows = await prisma.provider.findMany({
    orderBy: [
      { createdAt: 'desc' },
      { npi: 'asc' },
    ],
    take: limit,
    select: {
      npi: true,
    },
  });

  return rows
    .map((row) => row.npi.trim())
    .filter((npi) => /^\d{10}$/.test(npi));
}

async function withAutoWarmSpan<T>(
  name: string,
  trigger: IntelligenceAutoWarmTrigger,
  operation: () => Promise<T>,
): Promise<T> {
  return intelligenceAutoWarmTracer.startActiveSpan(name, async (span) => {
    span.setAttributes({
      'vitalcv.intelligence.trigger': trigger,
    });

    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function executeAutoWarm(trigger: IntelligenceAutoWarmTrigger): Promise<IntelligenceAutoWarmResult> {
  return withAutoWarmSpan('intelligence.auto_warm', trigger, async () => {
    const before = await loadCounts();
    let seeded = false;
    let findingsGenerated = 0;
    let targetProviders = 0;

    if (before.providers === 0) {
      logIntelligenceFailure({
        layer: 'db',
        trigger,
        reason: 'provider_count_zero',
        providers: before.providers,
        findings: before.findings,
        storylines: before.storylines,
        recoveryTriggered: true,
      });

      const seedResult = await ensureInvestigationSeedDataBootstrapped({
        prismaClient: prisma,
        logger: log,
      });
      seeded = Boolean(seedResult?.seeded);
    }

    const afterSeed = await loadCounts();
    if (afterSeed.providers === 0) {
      logIntelligenceFailure({
        layer: 'db',
        trigger,
        reason: 'no_providers_available',
        providers: afterSeed.providers,
        findings: afterSeed.findings,
        storylines: afterSeed.storylines,
        recoveryTriggered: false,
      });

      return {
        trigger,
        triggered: false,
        reason: 'no_providers',
        seeded,
        providersBefore: before.providers,
        findingsBefore: before.findings,
        storylinesBefore: before.storylines,
        providersAfter: afterSeed.providers,
        findingsAfter: afterSeed.findings,
        storylinesAfter: afterSeed.storylines,
        findingsGenerated,
        targetProviders,
      };
    }

    if (afterSeed.findings === 0 || afterSeed.storylines === 0) {
      logIntelligenceFailure({
        layer: 'db',
        trigger,
        reason: afterSeed.findings === 0 ? 'finding_count_zero' : 'storyline_count_zero',
        providers: afterSeed.providers,
        findings: afterSeed.findings,
        storylines: afterSeed.storylines,
        recoveryTriggered: true,
      });

      const targetEntityIds = await loadTargetProviders(AUTO_WARM_TARGET_LIMIT);
      targetProviders = targetEntityIds.length;

      if (targetEntityIds.length > 0) {
        const runs = await runTargetedInvestigators({
          entityType: 'provider',
          targetEntityIds,
          investigatorIds: [...IGNITION_INVESTIGATOR_IDS],
          trigger: 'manual',
          metadata: {
            source: 'intelligence_auto_warm',
            trigger,
          },
        });

        findingsGenerated = runs.reduce((sum, run) => sum + run.findingsGenerated, 0);
        await listStorylines({ limit: 200, sync: true });
      }
    }

    const after = await loadCounts();
    log('info', 'intelligence_auto_warm.completed', {
      event: 'intelligence_auto_warm.completed',
      trigger,
      seeded,
      providersBefore: before.providers,
      findingsBefore: before.findings,
      storylinesBefore: before.storylines,
      providersAfter: after.providers,
      findingsAfter: after.findings,
      storylinesAfter: after.storylines,
      findingsGenerated,
      targetProviders,
    });

    return {
      trigger,
      triggered: true,
      reason: 'completed',
      seeded,
      providersBefore: before.providers,
      findingsBefore: before.findings,
      storylinesBefore: before.storylines,
      providersAfter: after.providers,
      findingsAfter: after.findings,
      storylinesAfter: after.storylines,
      findingsGenerated,
      targetProviders,
    };
  });
}

export async function runIntelligenceAutoWarm(
  trigger: IntelligenceAutoWarmTrigger,
  options: { force?: boolean } = {},
): Promise<IntelligenceAutoWarmResult> {
  if (autoWarmInFlight) {
    return autoWarmInFlight;
  }

  const now = Date.now();
  if (!options.force && (now - lastAutoWarmStartedAt) < AUTO_WARM_COOLDOWN_MS) {
    const counts = await loadCounts();
    return {
      trigger,
      triggered: false,
      reason: 'cooldown',
      seeded: false,
      providersBefore: counts.providers,
      findingsBefore: counts.findings,
      storylinesBefore: counts.storylines,
      providersAfter: counts.providers,
      findingsAfter: counts.findings,
      storylinesAfter: counts.storylines,
      findingsGenerated: 0,
      targetProviders: 0,
    };
  }

  lastAutoWarmStartedAt = now;
  autoWarmInFlight = executeAutoWarm(trigger).finally(() => {
    autoWarmInFlight = null;
  });

  return autoWarmInFlight;
}

export function requestIntelligenceAutoWarm(
  trigger: IntelligenceAutoWarmTrigger,
  options: { force?: boolean } = {},
): void {
  void runIntelligenceAutoWarm(trigger, options).catch((error) => {
    log('error', 'intelligence_auto_warm.failed', {
      event: 'intelligence_auto_warm.failed',
      trigger,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export function resetIntelligenceAutoWarmStateForTests(): void {
  autoWarmInFlight = null;
  lastAutoWarmStartedAt = 0;
}

import { PrismaClient, type ChainMetrics } from '@prisma/client';

const prisma = new PrismaClient();

export interface SloThresholds {
  blockTimeMs: number;
  finalityLag: number;
  queueDepth: number;
  consecutiveBreachesForFailover: number;
}

export interface LatencySloHandlers {
  alert?: (payload: { metric: string; value: number; threshold: number }) => Promise<void> | void;
  enableFallbackAnchoring?: (reason: string) => Promise<void> | void;
}

export interface LatencySloCheckOptions {
  metrics?: ChainMetrics | null;
  thresholds?: Partial<SloThresholds>;
  lookbackSamples?: number;
  handlers?: LatencySloHandlers;
  prismaClient?: PrismaClient;
}

export interface LatencySloEvaluation {
  metric: ChainMetrics | null;
  healthy: boolean;
  breaches: Array<{ metric: keyof Pick<ChainMetrics, 'blockTimeMs' | 'finalityLag' | 'queueDepth'>; value: number; threshold: number }>;
  actions: {
    alertTriggered: boolean;
    failoverTriggered: boolean;
  };
}

const DEFAULT_THRESHOLDS: SloThresholds = {
  blockTimeMs: 8000,
  finalityLag: 4,
  queueDepth: 120,
  consecutiveBreachesForFailover: 3,
};

export async function enforceLatencySlo(options: LatencySloCheckOptions = {}): Promise<LatencySloEvaluation> {
  const client = options.prismaClient ?? prisma;
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) };

  const currentMetrics =
    options.metrics ??
    (await client.chainMetrics.findFirst({
      orderBy: { capturedAt: 'desc' },
    }));

  if (!currentMetrics) {
    return {
      metric: null,
      healthy: true,
      breaches: [],
      actions: { alertTriggered: false, failoverTriggered: false },
    };
  }

  const breaches = evaluateBreaches(currentMetrics, thresholds);
  let alertTriggered = false;
  if (breaches.length && options.handlers?.alert) {
    alertTriggered = true;
    await Promise.all(
      breaches.map((breach) =>
        options.handlers!.alert!({
          metric: breach.metric,
          value: breach.value,
          threshold: breach.threshold,
        }),
      ),
    );
  }

  let failoverTriggered = false;
  if (await shouldFailover(client, thresholds, options.lookbackSamples)) {
    failoverTriggered = true;
    if (options.handlers?.enableFallbackAnchoring) {
      await options.handlers.enableFallbackAnchoring('Latency SLO breached');
    }
  }

  return {
    metric: currentMetrics,
    healthy: breaches.length === 0 && !failoverTriggered,
    breaches,
    actions: {
      alertTriggered,
      failoverTriggered,
    },
  };
}

function evaluateBreaches(
  metrics: ChainMetrics,
  thresholds: SloThresholds,
): LatencySloEvaluation['breaches'] {
  const results: LatencySloEvaluation['breaches'] = [];
  if (metrics.blockTimeMs > thresholds.blockTimeMs) {
    results.push({
      metric: 'blockTimeMs',
      value: metrics.blockTimeMs,
      threshold: thresholds.blockTimeMs,
    });
  }
  if (metrics.finalityLag > thresholds.finalityLag) {
    results.push({
      metric: 'finalityLag',
      value: metrics.finalityLag,
      threshold: thresholds.finalityLag,
    });
  }
  if (metrics.queueDepth > thresholds.queueDepth) {
    results.push({
      metric: 'queueDepth',
      value: metrics.queueDepth,
      threshold: thresholds.queueDepth,
    });
  }
  return results;
}

async function shouldFailover(
  client: PrismaClient,
  thresholds: SloThresholds,
  lookbackSamples = thresholds.consecutiveBreachesForFailover,
): Promise<boolean> {
  if (lookbackSamples <= 0) return false;
  const history = await client.chainMetrics.findMany({
    orderBy: { capturedAt: 'desc' },
    take: lookbackSamples,
  });
  if (history.length < lookbackSamples) return false;

  let consecutive = 0;
  for (const metric of history) {
    const breached =
      metric.blockTimeMs > thresholds.blockTimeMs ||
      metric.finalityLag > thresholds.finalityLag ||
      metric.queueDepth > thresholds.queueDepth;
    if (breached) {
      consecutive += 1;
    } else {
      break;
    }
  }

  return consecutive >= thresholds.consecutiveBreachesForFailover;
}


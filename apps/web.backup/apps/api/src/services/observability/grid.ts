import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { anchorObservabilitySnapshot } from '../audit/anchor';
import { getZkMetricSummary } from '../zk/metrics';

const prisma = new PrismaClient();
type ExtendedPrisma = PrismaClient & Record<string, any>;

export interface ObservabilitySnapshot {
  region: string;
  metrics: {
    chain: {
      blockTimeMs: number;
      finalityLag: number;
      queueDepth: number;
      validatorHealth: Array<{ nodeId: string; status: string; latencyMs: number }>;
    };
    aiAgents: {
      successRate: number;
      avgLatencyMs: number;
      hitlRate: number;
    };
    psvPipeline: {
      ocrThroughput: number;
      npdbLatencyMinutes: number;
      sanctionsMatches: number;
      boardVerifications: number;
    };
    hris: {
      apiErrors24h: number;
      syncFailures24h: number;
      slowRegions: string[];
    };
    zkProofs: {
      avgProvingTimeMs: number;
      avgConstraintCount: number;
      avgCircuitSize: number;
      snarkRatio: number;
      samples: number;
      lastUpdated: string | null;
    };
    alerts: Array<{ id: string; severity: 'info' | 'warning' | 'critical'; message: string }>;
  };
  failover: Array<{ region: string; status: 'active' | 'standby' | 'degraded'; latencyMs: number }>;
  digest: string;
  generatedAt: string;
}

export async function collectObservabilitySnapshot(
  region = 'global',
  options: { prisma?: PrismaClient } = {},
): Promise<ObservabilitySnapshot> {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const [chainMetrics, chainHealth, aiDecisions, ocrRecords, complianceChecks, hrisErrors, observabilityRows] =
    await Promise.all([
      client.chainMetrics.findMany({ orderBy: { capturedAt: 'desc' }, take: 10 }),
      client.chainHealth.findMany({ take: 20 }),
      client.explainableDecision.findMany({ orderBy: { timestamp: 'desc' }, take: 100 }),
      client.licenseAutofillRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      client.complianceCheck.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      client.candidateSyncQueue.findMany({ where: { processed: false }, take: 50 }),
      client.observabilityGrid.findMany({ where: { region }, orderBy: { updatedAt: 'desc' }, take: 1 }),
    ]);

  const latestChainMetric = chainMetrics[0];
  const validatorHealth = chainHealth.map((node: any) => ({
    nodeId: node.nodeId,
    status: node.synced ? 'active' : 'degraded',
    latencyMs: node.latencyMs ?? 0,
  }));

  const aiSuccess =
    aiDecisions.length === 0
      ? 0.92
      : aiDecisions.filter((decision: any) => decision.outcome === 'approved').length / aiDecisions.length;
  const aiLatency =
    aiDecisions.length === 0
      ? 220
      : aiDecisions.reduce((sum: number, decision: any) => sum + (decision.metadata?.latencyMs ?? 250), 0) /
        aiDecisions.length;
  const hitlRate =
    aiDecisions.length === 0
      ? 0.05
      : aiDecisions.filter((decision: any) => decision.metadata?.requiresHitl).length / aiDecisions.length;

  const ocrThroughput = ocrRecords.length;
  const npdbLatency =
    complianceChecks.length === 0
      ? 45
      : complianceChecks.reduce(
          (sum: number, check: any) => sum + (check.metadata?.latencyMinutes ?? 30),
          0,
        ) / complianceChecks.length;
  const sanctionsMatches = complianceChecks.filter((check: any) => check.type === 'sanctions').length;
  const boardVerifications = complianceChecks.filter((check: any) => check.type === 'board').length;

  const slowRegions = Array.from(
    new Set(
      hrisErrors
        .filter((record: any) => record.payload?.regionLatencyMs && record.payload.regionLatencyMs > 4500)
        .map((record: any) => record.payload.region),
    ),
  );

  const zkSummary = getZkMetricSummary();

  const alerts = buildAlerts({
    chainMetric: latestChainMetric,
    validatorHealth,
    aiSuccess,
    aiLatency,
    npdbLatency,
    hrisErrors: hrisErrors.length,
    zkSummary,
  });

  const snapshot = {
    region,
    metrics: {
      chain: {
        blockTimeMs: latestChainMetric?.blockTimeMs ?? 245,
        finalityLag: latestChainMetric?.finalityLag ?? 4,
        queueDepth: latestChainMetric?.queueDepth ?? 3,
        validatorHealth,
      },
      aiAgents: {
        successRate: Number(aiSuccess.toFixed(3)),
        avgLatencyMs: Number(aiLatency.toFixed(1)),
        hitlRate: Number(hitlRate.toFixed(3)),
      },
      psvPipeline: {
        ocrThroughput,
        npdbLatencyMinutes: Number(npdbLatency.toFixed(1)),
        sanctionsMatches,
        boardVerifications,
      },
      hris: {
        apiErrors24h: hrisErrors.length,
        syncFailures24h: hrisErrors.filter((record: any) => record.event === 'syncError').length,
        slowRegions,
      },
      zkProofs: {
        avgProvingTimeMs: zkSummary.avgProvingTimeMs,
        avgConstraintCount: zkSummary.avgConstraintCount,
        avgCircuitSize: zkSummary.avgCircuitSize,
        snarkRatio: zkSummary.snarkRatio,
        samples: zkSummary.count,
        lastUpdated: zkSummary.lastUpdated,
      },
      alerts,
    },
    failover: buildFailoverPanel(validatorHealth),
    digest: buildHealthDigest({
      region,
      alerts,
      previous: observabilityRows[0]?.metrics ?? null,
    }),
    generatedAt: new Date().toISOString(),
  } satisfies ObservabilitySnapshot;

  if (observabilityRows[0]) {
    await client.observabilityGrid.update({
      where: { id: observabilityRows[0].id },
      data: {
        metrics: snapshot.metrics,
        updatedAt: new Date(),
      },
    });
  } else {
    await client.observabilityGrid.create({
      data: {
        region,
        metrics: snapshot.metrics,
      },
    });
  }

  anchorObservabilitySnapshot({
    region,
    metricHash: hashValue(snapshot.metrics),
    alertCount: alerts.length,
    dominantAlert: alerts[0]?.message ?? null,
  });

  return snapshot;
}

function buildAlerts(params: {
  chainMetric?: any;
  validatorHealth: Array<{ nodeId: string; status: string; latencyMs: number }>;
  aiSuccess: number;
  aiLatency: number;
  npdbLatency: number;
  hrisErrors: number;
  zkSummary: ReturnType<typeof getZkMetricSummary>;
}) {
  const alerts: ObservabilitySnapshot['metrics']['alerts'] = [];
  if ((params.chainMetric?.finalityLag ?? 0) > 10) {
    alerts.push({
      id: 'chain_finality',
      severity: 'critical',
      message: `Finality lag ${params.chainMetric.finalityLag} blocks`,
    });
  }
  if (params.validatorHealth.filter((node) => node.status !== 'active').length > 2) {
    alerts.push({
      id: 'validator_degraded',
      severity: 'warning',
      message: 'Multiple validators operating in degraded mode',
    });
  }
  if (params.aiSuccess < 0.85) {
    alerts.push({
      id: 'ai_success_drop',
      severity: 'warning',
      message: `AI success ${Math.round(params.aiSuccess * 100)}%`,
    });
  }
  if (params.aiLatency > 400) {
    alerts.push({
      id: 'ai_latency',
      severity: 'info',
      message: `AI mean latency ${Math.round(params.aiLatency)}ms`,
    });
  }
  if (params.zkSummary.count > 0 && params.zkSummary.snarkRatio < 0.6) {
    alerts.push({
      id: 'zk_snark_ratio',
      severity: 'warning',
      message: `Only ${Math.round(params.zkSummary.snarkRatio * 100)}% proofs SNARK-backed`,
    });
  }
  if (params.zkSummary.avgProvingTimeMs > 5_000) {
    alerts.push({
      id: 'zk_latency',
      severity: 'warning',
      message: `ZK proving latency ${Math.round(params.zkSummary.avgProvingTimeMs)} ms`,
    });
  }
  if (params.npdbLatency > 60) {
    alerts.push({
      id: 'npdb_latency',
      severity: 'warning',
      message: `NPDB latency ${Math.round(params.npdbLatency)} minutes`,
    });
  }
  if (params.hrisErrors > 8) {
    alerts.push({
      id: 'hris_errors',
      severity: 'warning',
      message: `${params.hrisErrors} HRIS sync failures awaiting retries`,
    });
  }
  return alerts;
}

function buildFailoverPanel(
  validatorHealth: Array<{ nodeId: string; status: string; latencyMs: number }>,
) {
  return validatorHealth.slice(0, 6).map((node, index) => ({
    region: `cluster-${index + 1}`,
    status: node.status === 'active' ? 'active' : node.latencyMs > 800 ? 'degraded' : 'standby',
    latencyMs: node.latencyMs,
  }));
}

function buildHealthDigest(params: {
  region: string;
  alerts: ObservabilitySnapshot['metrics']['alerts'];
  previous: any;
}) {
  const alertSummary =
    params.alerts.length === 0
      ? 'All subsystems nominal.'
      : params.alerts
          .slice(0, 3)
          .map((alert) => `${alert.severity.toUpperCase()}: ${alert.message}`)
          .join(' · ');
  const previousLag = params.previous?.chain?.finalityLag ?? 'n/a';
  return `Region ${params.region}: ${alertSummary} Prev finality lag ${previousLag}.`;
}

function hashValue(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}


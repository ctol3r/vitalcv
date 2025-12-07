import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../../services/chain/client';
import { anchorEvent } from '../../services/audit/anchor';
import { pingValidatorNodes } from './ping';
import { detectChainSync } from './sync';
import { calculateValidatorQuorum } from './quorum';
import { detectChainIncidents } from './incidents';
import { evaluateFailoverStrategy } from './failover';
import type { BlockTimeHeatmapCell, ChainHealthSnapshot } from './types';

export interface ChainHealthSnapshotOptions {
  lookbackSamples?: number;
  anchor?: boolean;
  prismaClient?: PrismaClient;
}

const defaultPrisma = new PrismaClient();
const defaultChainClient = new ChainClient();

const DEFAULT_LOOKBACK = 36;

export async function buildChainHealthSnapshot(
  options: ChainHealthSnapshotOptions = {},
): Promise<ChainHealthSnapshot> {
  const prisma = options.prismaClient ?? defaultPrisma;
  const chainClient = defaultChainClient;
  const lookback = options.lookbackSamples ?? DEFAULT_LOOKBACK;

  const [metrics, overview, heartbeats] = await Promise.all([
    prisma.chainMetrics.findMany({
      orderBy: { capturedAt: 'desc' },
      take: lookback,
    }),
    chainClient.fetchValidatorHealth(),
    pingValidatorNodes({ prismaClient: prisma }),
  ]);

  const sync = detectChainSync({ overview, heartbeats, metrics });
  const quorum = calculateValidatorQuorum({ overview, metrics });
  const incidents = detectChainIncidents({ metrics, heartbeats });
  const failover = await evaluateFailoverStrategy({
    latestMetrics: metrics[0] ?? null,
    heartbeats,
    prismaClient: prisma,
  });
  const heatmap = buildBlockTimeHeatmap(metrics);
  const serializedMetrics = metrics.map((metric) => ({
    blockTimeMs: metric.blockTimeMs,
    finalityLag: metric.finalityLag,
    queueDepth: metric.queueDepth,
    capturedAt: metric.capturedAt.toISOString(),
  }));

  const generatedAt = new Date().toISOString();
  let checkpoint: ChainHealthSnapshot['checkpoint'] = null;

  if (options.anchor !== false) {
    try {
      const record = anchorEvent('chainHealthSnapshot', {
        status: sync.status,
        finalityLag: sync.finalityLag,
        headBlock: sync.headBlock,
        healthyNodes: sync.healthyNodes,
        quorumMet: quorum.quorumMet,
        incidents: incidents.slice(0, 3).map((incident) => ({
          type: incident.type,
          severity: incident.severity,
        })),
        timestamp: generatedAt,
      });
      checkpoint = {
        anchorId: record.id,
        txHash: record.txHash,
        merkleRoot: record.merkleRoot,
        timestamp: record.payload.timestamp,
      };
    } catch (error) {
      console.warn('[chain][health] failed to anchor checkpoint', error);
    }
  }

  return {
    generatedAt,
    overview,
    heartbeats,
    sync,
    quorum,
    incidents,
    failover,
    metrics: {
      latest: serializedMetrics[0] ?? null,
      rolling: serializedMetrics,
      heatmap,
    },
    checkpoint,
  };
}

function buildBlockTimeHeatmap(
  metrics: Array<{ blockTimeMs: number; capturedAt: Date }> = [],
  bucketMinutes = 5,
  bucketCount = 18,
): BlockTimeHeatmapCell[] {
  if (!metrics.length) return [];
  const bucketMs = bucketMinutes * 60_000;
  const buckets = new Map<number, { sum: number; count: number }>();

  for (const metric of metrics) {
    const timestamp = new Date(metric.capturedAt).getTime();
    const bucketKey = Math.floor(timestamp / bucketMs) * bucketMs;
    const entry = buckets.get(bucketKey) ?? { sum: 0, count: 0 };
    entry.sum += metric.blockTimeMs;
    entry.count += 1;
    buckets.set(bucketKey, entry);
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b).slice(-bucketCount);
  const globalAverage =
    metrics.reduce((acc, metric) => acc + metric.blockTimeMs, 0) / metrics.length;

  return sortedKeys.map((key) => {
    const data = buckets.get(key)!;
    const avg = Math.round(data.sum / data.count);
    const iso = new Date(key).toISOString();
    return {
      bucketLabel: iso.slice(11, 16),
      bucketStart: iso,
      avgBlockTimeMs: avg,
      samples: data.count,
      anomaly: avg >= globalAverage * 1.2,
    };
  });
}


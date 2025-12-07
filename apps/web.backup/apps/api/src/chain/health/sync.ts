import type { ChainMetrics } from '@prisma/client';
import type { ValidatorHealthOverview } from '../../services/chain/client';
import type { ChainSyncStatus, NodeHeartbeat } from './types';

export interface ChainSyncDetectorOptions {
  overview?: ValidatorHealthOverview | null;
  heartbeats?: NodeHeartbeat[];
  metrics?: Array<Pick<ChainMetrics, 'blockTimeMs' | 'finalityLag' | 'queueDepth' | 'capturedAt'>>;
  blockTimeTargetMs?: number;
}

const DEFAULT_BLOCK_TIME_MS = 6_000;

export function detectChainSync(options: ChainSyncDetectorOptions = {}): ChainSyncStatus {
  const heartbeats = options.heartbeats ?? [];
  const overview = options.overview ?? null;
  const latestMetrics = options.metrics?.[0];
  const averageBlockTime = computeAverageBlockTime(options.metrics) ?? latestMetrics?.blockTimeMs ?? DEFAULT_BLOCK_TIME_MS;

  const headBlock = Math.max(
    overview?.blockHeight ?? 0,
    ...heartbeats.map((hb) => hb.block),
  );
  const finalizedBlock = Math.max(
    overview?.finalizedHeight ?? 0,
    ...heartbeats.map((hb) => hb.finalizedBlock),
  );
  const finalityLag = Math.max(0, headBlock - finalizedBlock);

  const totalNodes = heartbeats.length || overview?.validators?.length || 0;
  const healthyNodes = heartbeats.length
    ? heartbeats.filter((hb) => hb.synced).length
    : overview?.validators?.filter((validator) => validator.status === 'active').length ?? 0;

  const quorumRequirement = totalNodes ? Math.ceil(totalNodes * 0.6) : 1;
  const backlogSeconds = Math.round(finalityLag * (averageBlockTime / 1000));

  const status: ChainSyncStatus['status'] =
    finalityLag <= 4 && healthyNodes >= quorumRequirement
      ? 'synced'
      : finalityLag <= 12
        ? 'syncing'
        : 'degraded';

  return {
    status,
    headBlock,
    finalizedBlock,
    finalityLag,
    healthyNodes,
    totalNodes,
    backlogSeconds,
    lastUpdated: new Date().toISOString(),
  };
}

function computeAverageBlockTime(
  metrics: Array<Pick<ChainMetrics, 'blockTimeMs' | 'capturedAt'>> = [],
): number | null {
  if (!metrics.length) return null;
  const sum = metrics.reduce((acc, metric) => acc + metric.blockTimeMs, 0);
  return Math.round(sum / metrics.length);
}










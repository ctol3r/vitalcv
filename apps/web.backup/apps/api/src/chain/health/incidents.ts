import { randomUUID } from 'crypto';
import type { ChainMetrics } from '@prisma/client';
import type { ChainIncident, NodeHeartbeat } from './types';

export interface IncidentDetectorOptions {
  metrics?: Array<Pick<ChainMetrics, 'blockTimeMs' | 'finalityLag' | 'queueDepth' | 'capturedAt'>>;
  heartbeats?: NodeHeartbeat[];
  blockTimeThresholdMs?: number;
  finalityLagThreshold?: number;
}

const DEFAULT_BLOCK_TIME_THRESHOLD = 8_500;
const DEFAULT_FINALITY_LAG_THRESHOLD = 8;

export function detectChainIncidents(options: IncidentDetectorOptions = {}): ChainIncident[] {
  const incidents: ChainIncident[] = [];
  const metrics = options.metrics ?? [];
  const heartbeats = options.heartbeats ?? [];

  const longBlockThreshold = options.blockTimeThresholdMs ?? DEFAULT_BLOCK_TIME_THRESHOLD;
  const finalityLagThreshold = options.finalityLagThreshold ?? DEFAULT_FINALITY_LAG_THRESHOLD;

  const worstBlockTime = metrics.reduce((max, metric) => Math.max(max, metric.blockTimeMs), 0);
  if (worstBlockTime >= longBlockThreshold) {
    const sample = metrics.find((metric) => metric.blockTimeMs === worstBlockTime);
    incidents.push({
      id: randomUUID(),
      type: 'long_block_time',
      severity: worstBlockTime >= longBlockThreshold + 1_500 ? 'critical' : 'warn',
      message: `Block time spiked to ${(worstBlockTime / 1000).toFixed(1)}s`,
      occurredAt: sample?.capturedAt ?? new Date().toISOString(),
      metadata: {
        blockTimeMs: worstBlockTime,
        thresholdMs: longBlockThreshold,
      },
    });
  }

  const worstLag = metrics.reduce((max, metric) => Math.max(max, metric.finalityLag), 0);
  if (worstLag >= finalityLagThreshold) {
    const sample = metrics.find((metric) => metric.finalityLag === worstLag);
    incidents.push({
      id: randomUUID(),
      type: 'missed_block',
      severity: worstLag >= finalityLagThreshold + 4 ? 'critical' : 'warn',
      message: `Finality lag reached ${worstLag} blocks`,
      occurredAt: sample?.capturedAt ?? new Date().toISOString(),
      metadata: {
        finalityLag: worstLag,
        threshold: finalityLagThreshold,
      },
    });
  }

  if (heartbeats.length >= 2) {
    const maxBlock = Math.max(...heartbeats.map((hb) => hb.block));
    const minBlock = Math.min(...heartbeats.map((hb) => hb.block));
    const skew = maxBlock - minBlock;
    if (skew >= 4) {
      incidents.push({
        id: randomUUID(),
        type: 'orphaned_block',
        severity: skew >= 8 ? 'critical' : 'warn',
        message: 'Detected validator skew indicative of orphaned blocks',
        occurredAt: heartbeats[0]?.timestamp ?? new Date().toISOString(),
        metadata: {
          maxBlock,
          minBlock,
          skew,
          affectedValidators: heartbeats
            .filter((hb) => hb.block <= minBlock + 1)
            .map((hb) => hb.nodeId),
        },
      });
    }
  }

  return incidents;
}










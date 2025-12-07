import type { ValidatorHealthOverview } from '../../services/chain/client';

export interface ValidatorNodeConfig {
  id: string;
  label: string;
  rpcUrl: string;
  region?: string;
  priority?: number;
}

export interface NodeHeartbeat {
  nodeId: string;
  label: string;
  rpcUrl: string;
  region?: string;
  latencyMs: number;
  block: number;
  finalizedBlock: number;
  finalityLag: number;
  peers: number;
  synced: boolean;
  timestamp: string;
  error?: string;
}

export type ChainIncidentType = 'missed_block' | 'orphaned_block' | 'long_block_time';

export interface ChainIncident {
  id: string;
  type: ChainIncidentType;
  severity: 'info' | 'warn' | 'critical';
  message: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface ChainSyncStatus {
  status: 'synced' | 'syncing' | 'degraded';
  headBlock: number;
  finalizedBlock: number;
  finalityLag: number;
  healthyNodes: number;
  totalNodes: number;
  backlogSeconds: number;
  lastUpdated: string;
}

export interface ValidatorQuorumReport {
  activeValidators: number;
  totalValidators: number;
  finalityRatio: number;
  blockTimeAvg: number;
  quorumMet: boolean;
  windowMinutes: number;
  sampleSize: number;
}

export interface FailoverDecision {
  mode: 'primary' | 'watch' | 'failover';
  reason: string;
  triggeredAt: string;
  actions: string[];
  breaches: Array<{
    metric: 'blockTimeMs' | 'finalityLag' | 'queueDepth';
    value: number;
    threshold: number;
  }>;
}

export interface BlockTimeHeatmapCell {
  bucketLabel: string;
  bucketStart: string;
  avgBlockTimeMs: number;
  samples: number;
  anomaly: boolean;
}

export interface ChainMetricSample {
  blockTimeMs: number;
  finalityLag: number;
  queueDepth: number;
  capturedAt: string;
}

export interface ChainHealthSnapshot {
  generatedAt: string;
  overview: ValidatorHealthOverview;
  heartbeats: NodeHeartbeat[];
  sync: ChainSyncStatus;
  quorum: ValidatorQuorumReport;
  incidents: ChainIncident[];
  failover: FailoverDecision;
  metrics: {
    latest: ChainMetricSample | null;
    rolling: ChainMetricSample[];
    heatmap: BlockTimeHeatmapCell[];
  };
  checkpoint?: {
    anchorId: string;
    txHash: string;
    merkleRoot: string;
    timestamp: string;
  } | null;
}


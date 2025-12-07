import type { ChainMetrics, PrismaClient } from '@prisma/client';
import { enforceLatencySlo } from '../../services/chain/slo';
import type { FailoverDecision, NodeHeartbeat } from './types';

export interface FailoverStrategyOptions {
  latestMetrics?: ChainMetrics | null;
  heartbeats?: NodeHeartbeat[];
  prismaClient?: PrismaClient;
  latencyBudgetMs?: number;
}

const DEFAULT_LATENCY_BUDGET = 9_000;

export async function evaluateFailoverStrategy(options: FailoverStrategyOptions = {}): Promise<FailoverDecision> {
  const evaluation = await enforceLatencySlo({
    metrics: options.latestMetrics ?? undefined,
    prismaClient: options.prismaClient,
  });

  const latencyBudget = options.latencyBudgetMs ?? DEFAULT_LATENCY_BUDGET;
  const heartbeats = options.heartbeats ?? [];
  const healthyNodes = heartbeats.filter((node) => node.synced && node.latencyMs <= latencyBudget);
  const totalNodes = heartbeats.length || 1;
  const quorum = Math.max(1, Math.ceil(totalNodes * 0.5));
  const now = new Date().toISOString();

  if (evaluation.actions.failoverTriggered || healthyNodes.length === 0) {
    return {
      mode: 'failover',
      reason: healthyNodes.length === 0 ? 'No healthy validators reachable' : 'Latency SLO triggered automated failover',
      triggeredAt: now,
      actions: [
        'Pause primary anchoring',
        'Switch to fallback chain writer',
        'Notify on-call chain operator',
      ],
      breaches: evaluation.breaches,
    };
  }

  if (evaluation.breaches.length > 0 || healthyNodes.length < quorum) {
    return {
      mode: 'watch',
      reason:
        evaluation.breaches.length > 0
          ? 'SLO breach detected, monitor closely'
          : 'Validator quorum degraded',
      triggeredAt: now,
      actions: [
        'Throttle bulk anchoring jobs',
        'Enable redundancy polling',
        'Prepare failover bundle',
      ],
      breaches: evaluation.breaches,
    };
  }

  return {
    mode: 'primary',
    reason: 'All validators healthy and SLO targets met',
    triggeredAt: now,
    actions: [
      'Continue normal anchoring cadence',
      'Rotate telemetry keys on schedule',
    ],
    breaches: [],
  };
}










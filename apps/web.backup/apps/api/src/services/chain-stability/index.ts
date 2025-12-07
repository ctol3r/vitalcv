import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface ChainStabilityData {
  validators: Array<{
    id: string;
    status: 'online' | 'offline' | 'degraded';
    lastSeen: string;
    healthScore: number;
  }>;
  blockPropagation: {
    average: number; // ms
    p95: number;
    p99: number;
  };
  finality: {
    average: number; // seconds
    regression: boolean;
    regressionCount: number;
  };
  networkPartitions: Array<{
    detectedAt: string;
    nodes: string[];
    resolvedAt?: string;
  }>;
  congestion: {
    level: 'low' | 'medium' | 'high' | 'critical';
    predictedAt?: string;
  };
  lastUpdated: string;
}

/**
 * Get chain stability data
 */
export async function getChainStability(): Promise<ChainStabilityData | null> {
  const record = await prisma.chainStability.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!record) {
    return null;
  }

  return record.stability as ChainStabilityData;
}

/**
 * Update chain stability data
 */
export async function updateChainStability(stability: ChainStabilityData): Promise<void> {
  await prisma.chainStability.create({
    data: {
      stability: stability as any,
      updatedAt: new Date(),
    },
  });
}

/**
 * Track validator liveliness (ping validators, check health)
 */
export async function trackValidatorLiveliness(validators: Array<{
  id: string;
  endpoint: string;
}>): Promise<Array<{
  id: string;
  status: 'online' | 'offline' | 'degraded';
  lastSeen: string;
  healthScore: number;
}>> {
  const results: Array<{
    id: string;
    status: 'online' | 'offline' | 'degraded';
    lastSeen: string;
    healthScore: number;
  }> = [];

  for (const validator of validators) {
    try {
      // Simulate health check (in production, this would ping the validator)
      const isOnline = Math.random() > 0.1; // 90% uptime
      const healthScore = isOnline ? Math.random() * 0.3 + 0.7 : Math.random() * 0.3; // 0.7-1.0 if online, 0-0.3 if offline

      results.push({
        id: validator.id,
        status: healthScore > 0.8 ? 'online' : healthScore > 0.5 ? 'degraded' : 'offline',
        lastSeen: new Date().toISOString(),
        healthScore,
      });
    } catch (error) {
      results.push({
        id: validator.id,
        status: 'offline',
        lastSeen: new Date().toISOString(),
        healthScore: 0,
      });
    }
  }

  return results;
}

/**
 * Analyze block propagation time (measure delays between nodes)
 */
export async function analyzeBlockPropagation(blocks: Array<{
  blockNumber: number;
  nodeTimes: Array<{ nodeId: string; receivedAt: string }>;
}>): Promise<{
  average: number;
  p95: number;
  p99: number;
}> {
  if (blocks.length === 0) {
    return { average: 0, p95: 0, p99: 0 };
  }

  const delays: number[] = [];

  for (const block of blocks) {
    if (block.nodeTimes.length < 2) {
      continue;
    }

    const times = block.nodeTimes.map((nt) => new Date(nt.receivedAt).getTime()).sort((a, b) => a - b);
    const minTime = times[0];
    const maxTime = times[times.length - 1];
    const delay = maxTime - minTime;

    delays.push(delay);
  }

  if (delays.length === 0) {
    return { average: 0, p95: 0, p99: 0 };
  }

  delays.sort((a, b) => a - b);
  const average = delays.reduce((sum, d) => sum + d, 0) / delays.length;
  const p95Index = Math.floor(delays.length * 0.95);
  const p99Index = Math.floor(delays.length * 0.99);
  const p95 = delays[p95Index] || delays[delays.length - 1];
  const p99 = delays[p99Index] || delays[delays.length - 1];

  return { average, p95, p99 };
}

/**
 * Detect finality regression (slow/late finality events)
 */
export async function detectFinalityRegression(finalityTimes: Array<{
  blockNumber: number;
  finalityTime: number; // seconds
  timestamp: string;
}>): Promise<{
  regression: boolean;
  regressionCount: number;
  average: number;
}> {
  if (finalityTimes.length < 10) {
    return {
      regression: false,
      regressionCount: 0,
      average: finalityTimes.length > 0
        ? finalityTimes.reduce((sum, f) => sum + f.finalityTime, 0) / finalityTimes.length
        : 0,
    };
  }

  // Calculate baseline (first half)
  const baseline = finalityTimes.slice(0, Math.floor(finalityTimes.length / 2));
  const baselineAvg = baseline.reduce((sum, f) => sum + f.finalityTime, 0) / baseline.length;

  // Check recent (second half)
  const recent = finalityTimes.slice(Math.floor(finalityTimes.length / 2));
  const recentAvg = recent.reduce((sum, f) => sum + f.finalityTime, 0) / recent.length;

  // Regression if recent average is > 20% worse than baseline
  const regression = recentAvg > baselineAvg * 1.2;
  const regressionCount = recent.filter((f) => f.finalityTime > baselineAvg * 1.2).length;

  return {
    regression,
    regressionCount,
    average: recentAvg,
  };
}

/**
 * Drop trust for misbehaving validators
 */
export async function regressValidatorTrust(
  validatorId: string,
  violations: Array<{
    type: 'slow_finality' | 'block_delay' | 'offline' | 'invalid_block';
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
  }>,
): Promise<number> {
  // Start with trust score of 100
  let trustScore = 100;

  for (const violation of violations) {
    const penalty = {
      low: 1,
      medium: 5,
      high: 15,
      critical: 30,
    }[violation.severity];

    trustScore -= penalty;
  }

  return Math.max(0, trustScore);
}

/**
 * Detect network partitions (node islands or forks)
 */
export async function detectNetworkPartitions(nodes: Array<{
  nodeId: string;
  connectedNodes: string[];
  lastSeen: string;
}>): Promise<Array<{
  detectedAt: string;
  nodes: string[];
  resolvedAt?: string;
}>> {
  const partitions: Array<{
    detectedAt: string;
    nodes: string[];
    resolvedAt?: string;
  }> = [];

  // Build connectivity graph
  const nodeMap = new Map<string, Set<string>>();
  for (const node of nodes) {
    nodeMap.set(node.nodeId, new Set(node.connectedNodes));
  }

  // Find disconnected components using DFS
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of nodes) {
    if (visited.has(node.nodeId)) {
      continue;
    }

    const component: string[] = [];
    const stack = [node.nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) {
        continue;
      }

      visited.add(current);
      component.push(current);

      const neighbors = nodeMap.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    if (component.length > 0) {
      components.push(component);
    }
  }

  // Report partitions (components with < 50% of nodes)
  const totalNodes = nodes.length;
  for (const component of components) {
    if (component.length < totalNodes * 0.5) {
      partitions.push({
        detectedAt: new Date().toISOString(),
        nodes: component,
      });
    }
  }

  return partitions;
}

/**
 * Predict chain congestion
 */
export async function predictChainCongestion(metrics: {
  currentQueueDepth: number;
  averageBlockTime: number;
  transactionRate: number;
  historicalData: Array<{
    timestamp: string;
    queueDepth: number;
    congestion: 'low' | 'medium' | 'high' | 'critical';
  }>;
}): Promise<{
  level: 'low' | 'medium' | 'high' | 'critical';
  predictedAt?: string;
}> {
  const { currentQueueDepth, averageBlockTime, transactionRate, historicalData } = metrics;

  // Calculate congestion based on queue depth and transaction rate
  const throughput = 1 / averageBlockTime; // blocks per second
  const capacity = throughput * 1000; // transactions per second (assuming 1000 tx per block)
  const utilization = transactionRate / capacity;

  let level: 'low' | 'medium' | 'high' | 'critical';

  if (utilization < 0.5 && currentQueueDepth < 100) {
    level = 'low';
  } else if (utilization < 0.75 && currentQueueDepth < 500) {
    level = 'medium';
  } else if (utilization < 0.9 && currentQueueDepth < 1000) {
    level = 'high';
  } else {
    level = 'critical';
  }

  // Predict future congestion based on trends
  if (historicalData.length >= 2) {
    const recent = historicalData.slice(-10);
    const trend = recent[recent.length - 1].queueDepth - recent[0].queueDepth;

    if (trend > 100 && level !== 'critical') {
      // Predict critical congestion in 1 hour if trend continues
      const predictedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      return { level: 'critical', predictedAt };
    }
  }

  return { level };
}

/**
 * Generate chain stability diagnostic pack
 */
export async function generateStabilityDiagnostic(): Promise<{
  summary: {
    overallHealth: 'healthy' | 'degraded' | 'critical';
    validatorsOnline: number;
    validatorsTotal: number;
    averageFinality: number;
    congestionLevel: string;
  };
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  recommendations: string[];
}> {
  const stability = await getChainStability();
  if (!stability) {
    return {
      summary: {
        overallHealth: 'unknown',
        validatorsOnline: 0,
        validatorsTotal: 0,
        averageFinality: 0,
        congestionLevel: 'unknown',
      },
      issues: [],
      recommendations: ['Collect stability data'],
    };
  }

  const onlineValidators = stability.validators.filter((v) => v.status === 'online').length;
  const totalValidators = stability.validators.length;
  const healthRatio = onlineValidators / totalValidators;

  let overallHealth: 'healthy' | 'degraded' | 'critical';
  if (healthRatio >= 0.9 && stability.finality.average < 10) {
    overallHealth = 'healthy';
  } else if (healthRatio >= 0.7 && stability.finality.average < 30) {
    overallHealth = 'degraded';
  } else {
    overallHealth = 'critical';
  }

  const issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }> = [];

  if (stability.finality.regression) {
    issues.push({
      type: 'finality_regression',
      severity: stability.finality.regressionCount > 10 ? 'critical' : 'high',
      description: `Finality regression detected: ${stability.finality.regressionCount} slow finality events`,
    });
  }

  if (stability.networkPartitions.length > 0) {
    issues.push({
      type: 'network_partition',
      severity: 'critical',
      description: `${stability.networkPartitions.length} network partition(s) detected`,
    });
  }

  if (stability.congestion.level === 'critical' || stability.congestion.level === 'high') {
    issues.push({
      type: 'congestion',
      severity: stability.congestion.level === 'critical' ? 'critical' : 'high',
      description: `Chain congestion: ${stability.congestion.level}`,
    });
  }

  const recommendations: string[] = [];
  if (overallHealth === 'critical') {
    recommendations.push('Investigate validator health immediately');
    recommendations.push('Check network connectivity');
  }
  if (stability.finality.regression) {
    recommendations.push('Review finality configuration');
    recommendations.push('Consider increasing validator count');
  }
  if (stability.congestion.level === 'high' || stability.congestion.level === 'critical') {
    recommendations.push('Scale up validator capacity');
    recommendations.push('Optimize transaction processing');
  }

  return {
    summary: {
      overallHealth,
      validatorsOnline: onlineValidators,
      validatorsTotal: totalValidators,
      averageFinality: stability.finality.average,
      congestionLevel: stability.congestion.level,
    },
    issues,
    recommendations,
  };
}

/**
 * Anchor stability snapshot
 */
export async function anchorStabilitySnapshot(): Promise<void> {
  const stability = await getChainStability();
  if (!stability) {
    return;
  }

  const diagnostic = await generateStabilityDiagnostic();

  anchorEvent('chainStabilityAnchored', {
    overallHealth: diagnostic.summary.overallHealth,
    validatorsOnline: diagnostic.summary.validatorsOnline,
    validatorsTotal: diagnostic.summary.validatorsTotal,
    averageFinality: stability.finality.average,
    congestionLevel: stability.congestion.level,
    issueCount: diagnostic.issues.length,
    criticalIssues: diagnostic.issues.filter((i) => i.severity === 'critical').length,
    timestamp: new Date().toISOString(),
  });
}


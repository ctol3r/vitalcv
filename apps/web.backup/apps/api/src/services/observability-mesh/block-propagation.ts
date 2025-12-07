import { ChainClient } from '../chain/client';

export interface BlockPropagationMetrics {
  blockNumber: number;
  propagationTimes: Array<{
    nodeId: string;
    receivedAt: string;
    latencyMs: number;
  }>;
  averageLatency: number;
  maxLatency: number;
}

/**
 * Monitor block arrival times across nodes
 */
export async function trackBlockPropagation(blockNumber: number): Promise<BlockPropagationMetrics> {
  const chainClient = new ChainClient();
  const health = await chainClient.fetchValidatorHealth();

  const propagationTimes = health.validators.map((v) => {
    // Mock propagation time based on finality lag
    const latencyMs = v.finalityLag * 100; // Estimate 100ms per block lag
    return {
      nodeId: v.id,
      receivedAt: new Date().toISOString(),
      latencyMs,
    };
  });

  const latencies = propagationTimes.map((p) => p.latencyMs);
  const averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);

  return {
    blockNumber,
    propagationTimes,
    averageLatency,
    maxLatency,
  };
}


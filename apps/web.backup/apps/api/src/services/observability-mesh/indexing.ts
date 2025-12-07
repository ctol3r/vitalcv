export interface IndexingPerformanceMetrics {
  blockToApiLatency: number; // milliseconds
  indexLag: number; // blocks
  indexingRate: number; // blocks per second
  status: 'healthy' | 'degraded' | 'slow';
}

/**
 * Track block-to-API latency
 */
export function monitorIndexingPerformance(): IndexingPerformanceMetrics {
  // Mock implementation - would query actual indexing metrics
  const blockToApiLatency = 150; // ms
  const indexLag = 2; // blocks
  const indexingRate = 10; // blocks/sec

  let status: 'healthy' | 'degraded' | 'slow' = 'healthy';
  if (blockToApiLatency > 500 || indexLag > 10) {
    status = 'degraded';
  }
  if (blockToApiLatency > 1000 || indexLag > 20) {
    status = 'slow';
  }

  return {
    blockToApiLatency,
    indexLag,
    indexingRate,
    status,
  };
}


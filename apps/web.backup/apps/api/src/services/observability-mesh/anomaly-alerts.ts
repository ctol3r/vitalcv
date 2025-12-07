export interface AnomalyAlert {
  type: 'cpu_spike' | 'memory_leak' | 'block_lag' | 'queue_bottleneck' | 'indexing_slow';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  nodeId?: string;
  timestamp: string;
}

/**
 * Trigger Slack/email alerts for anomalies
 */
export async function detectAnomaliesAndAlert(
  health: any,
  queue: any,
  indexing: any,
): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];

  // Check CPU spikes
  if (health.cpu > 90) {
    alerts.push({
      type: 'cpu_spike',
      severity: 'high',
      message: `CPU usage at ${health.cpu}%`,
      nodeId: health.nodeId,
      timestamp: new Date().toISOString(),
    });
  }

  // Check memory leaks
  if (health.memory > 95) {
    alerts.push({
      type: 'memory_leak',
      severity: 'critical',
      message: `Memory usage at ${health.memory}%`,
      nodeId: health.nodeId,
      timestamp: new Date().toISOString(),
    });
  }

  // Check block lag
  if (health.blockLag > 10) {
    alerts.push({
      type: 'block_lag',
      severity: 'medium',
      message: `Block lag: ${health.blockLag} blocks`,
      nodeId: health.nodeId,
      timestamp: new Date().toISOString(),
    });
  }

  // Check queue bottlenecks
  if (queue.queueDepth > 50) {
    alerts.push({
      type: 'queue_bottleneck',
      severity: 'high',
      message: `Transaction queue depth: ${queue.queueDepth}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Check indexing performance
  if (indexing.status === 'slow') {
    alerts.push({
      type: 'indexing_slow',
      severity: 'medium',
      message: `Indexing latency: ${indexing.blockToApiLatency}ms`,
      timestamp: new Date().toISOString(),
    });
  }

  // Send alerts (mock - would integrate with Slack/email)
  for (const alert of alerts) {
    await sendAlert(alert);
  }

  return alerts;
}

async function sendAlert(alert: AnomalyAlert): Promise<void> {
  // Mock - would send to Slack/email
  console.log(`[observability-mesh] Alert: ${alert.type} - ${alert.message}`);
}


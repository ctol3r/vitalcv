/**
 * Chain Metrics
 * Tasks 201.29, 201.30, 201.31
 *
 * Prometheus metrics for Substrate chain operations
 */

import { Counter, Gauge, Histogram } from 'prom-client';

/**
 * Task 201.29 - Substrate connection status gauge
 */
export const substrateConnectedGauge = new Gauge({
  name: 'substrate_connected',
  help: 'Substrate chain connection status (1 = connected, 0 = disconnected)',
});

/**
 * Task 201.30 - Substrate RPC call latency histogram
 */
export const substrateRpcLatencyHistogram = new Histogram({
  name: 'substrate_rpc_latency_seconds',
  help: 'Substrate RPC call latency in seconds',
  labelNames: ['method'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

/**
 * Task 201.31 - Extrinsic success counter
 */
export const extrinsicSuccessCounter = new Counter({
  name: 'substrate_extrinsic_success_total',
  help: 'Total number of successful extrinsics',
  labelNames: ['pallet', 'method'],
});

/**
 * Task 201.31 - Extrinsic failure counter
 */
export const extrinsicFailureCounter = new Counter({
  name: 'substrate_extrinsic_failure_total',
  help: 'Total number of failed extrinsics',
  labelNames: ['pallet', 'method', 'error_code'],
});

/**
 * Chain block height gauge
 */
export const chainBlockHeightGauge = new Gauge({
  name: 'substrate_block_height',
  help: 'Current chain block height',
});

/**
 * Chain peers gauge
 */
export const chainPeersGauge = new Gauge({
  name: 'substrate_peers',
  help: 'Number of connected peers',
});

/**
 * Credential anchoring latency
 */
export const credentialAnchorLatencyHistogram = new Histogram({
  name: 'credential_anchor_latency_seconds',
  help: 'Time taken to anchor a credential on-chain',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

/**
 * Chain event processing counter
 */
export const chainEventCounter = new Counter({
  name: 'substrate_events_processed_total',
  help: 'Total number of chain events processed',
  labelNames: ['section', 'method'],
});

/**
 * Utility: Track RPC call duration
 */
export async function trackRpcCall<T>(
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();
    const duration = (Date.now() - start) / 1000;
    substrateRpcLatencyHistogram.observe({ method }, duration);
    return result;
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    substrateRpcLatencyHistogram.observe({ method }, duration);
    throw error;
  }
}

/**
 * Utility: Track extrinsic execution
 */
export function recordExtrinsicResult(
  pallet: string,
  method: string,
  success: boolean,
  errorCode?: string
): void {
  if (success) {
    extrinsicSuccessCounter.inc({ pallet, method });
  } else {
    extrinsicFailureCounter.inc({ pallet, method, error_code: errorCode || 'unknown' });
  }
}

/**
 * Update connection status metric
 */
export function updateConnectionStatus(connected: boolean): void {
  substrateConnectedGauge.set(connected ? 1 : 0);
}

/**
 * Update block height metric
 */
export function updateBlockHeight(height: number): void {
  chainBlockHeightGauge.set(height);
}

/**
 * Update peers metric
 */
export function updatePeers(peers: number): void {
  chainPeersGauge.set(peers);
}


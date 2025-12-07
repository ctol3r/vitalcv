import { anchorEvent } from '../audit/anchor';

/**
 * Anchor mesh snapshot to blockchain
 */
export function anchorMeshSnapshot(
  validators: any[],
  metrics: any,
  alerts: any[],
) {
  return anchorEvent('meshAnchored', {
    validatorCount: validators.length,
    healthyCount: validators.filter((v) => v.status === 'healthy').length,
    metrics,
    alertCount: alerts.length,
    timestamp: new Date().toISOString(),
  });
}


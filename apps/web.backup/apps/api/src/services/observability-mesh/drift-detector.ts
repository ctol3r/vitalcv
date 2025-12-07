import { ChainClient } from '../chain/client';

export interface ValidatorDrift {
  nodeId: string;
  driftBlocks: number;
  status: 'in_sync' | 'drifting' | 'out_of_consensus';
  detectedAt: string;
}

/**
 * Detect nodes out of consensus
 */
export async function detectValidatorDrift(): Promise<ValidatorDrift[]> {
  const chainClient = new ChainClient();
  const health = await chainClient.fetchValidatorHealth();

  const drifts: ValidatorDrift[] = health.validators.map((v) => {
    let status: 'in_sync' | 'drifting' | 'out_of_consensus' = 'in_sync';

    if (v.finalityLag > 20) {
      status = 'out_of_consensus';
    } else if (v.finalityLag > 5) {
      status = 'drifting';
    }

    return {
      nodeId: v.id,
      driftBlocks: v.finalityLag,
      status,
      detectedAt: new Date().toISOString(),
    };
  });

  return drifts;
}


import { AnchorReceipt, ChainAdapter } from './adapter';
import { merkleRoot } from './merkle';

export interface AnchorBatchResult {
  root: string;
  leafCount: number;
  receipt: AnchorReceipt;
}

export async function anchorBatch(hashes: string[], adapter: ChainAdapter): Promise<AnchorBatchResult> {
  if (!adapter) throw new Error('Adapter is required for anchoring');
  if (hashes.length === 0) throw new Error('No hashes provided for anchoring');

  const root = merkleRoot(hashes);
  if (!root) throw new Error('Failed to compute Merkle root');

  const receipt = await adapter.anchorRoot(root, { leafCount: hashes.length });

  return { root, leafCount: hashes.length, receipt };
}

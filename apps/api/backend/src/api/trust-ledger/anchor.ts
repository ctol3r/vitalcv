import { merkleRoot } from './merkle';
import type { AnchorReceipt, ChainAdapter } from './adapter';

export async function anchorBatch(
  hashes: string[],
  adapter: ChainAdapter,
): Promise<{ root: string; receipt: AnchorReceipt }> {
  const root = merkleRoot(hashes);
  const receipt = await adapter.anchor(root);
  return { root, receipt };
}

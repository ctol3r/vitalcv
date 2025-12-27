import { anchorBatch } from '../trust-ledger/anchor';
import { AnchorReceipt, ChainAdapter, NoopAdapter } from '../trust-ledger/adapter';
import { buildProof, verifyProof } from '../trust-ledger/proofs';
import {
  fetchAnchorableAuditEvents,
  findLastAnchoringEvent,
  persistAnchoringEvent,
} from '../audit/anchoring-events';

export interface AnchorJobResult {
  anchored: boolean;
  root?: string;
  leafCount?: number;
  receipt?: AnchorReceipt;
  anchorEventId?: number;
  message?: string;
}

export async function runAnchorBatch(adapter: ChainAdapter = new NoopAdapter()): Promise<AnchorJobResult> {
  const last = await findLastAnchoringEvent();
  const since = last?.createdAt;
  const pending = await fetchAnchorableAuditEvents(since);

  if (pending.length === 0) {
    return { anchored: false, message: 'No audit hashes pending anchoring' };
  }

  const hashes = pending.map((event) => event.hash);
  const { root, leafCount, receipt } = await anchorBatch(hashes, adapter);

  const proof = buildProof(hashes, 0);
  if (!verifyProof(proof)) {
    throw new Error('Merkle proof verification failed for anchored batch');
  }

  const anchorEvent = await persistAnchoringEvent({
    root,
    leafCount,
    adapterReceipt: receipt,
    anchoredHashes: hashes,
    windowStart: pending[0].createdAt.toISOString(),
    windowEnd: pending[pending.length - 1].createdAt.toISOString(),
    proofSample: [proof],
  });

  return {
    anchored: true,
    root,
    leafCount,
    receipt,
    anchorEventId: anchorEvent.id,
  };
}

if (require.main === module) {
  runAnchorBatch()
    .then((result) => {
      const summary = result.anchored
        ? `Anchored ${result.leafCount} hashes with root ${result.root}`
        : result.message;
      // eslint-disable-next-line no-console
      console.log(summary);
      process.exit(0);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Anchor batch failed', error);
      process.exit(1);
    });
}

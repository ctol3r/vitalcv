import { anchorBatch } from '../trust-ledger/anchor';
import { NoopAdapter } from '../trust-ledger/adapter';

export async function runAnchorBatch() {
  // Collect hashes from audit events since last run
  const hashes: string[] = []; // fetch from DB
  if (hashes.length === 0) return;

  const adapter = new NoopAdapter();
  const { root, receipt } = await anchorBatch(hashes, adapter);

  // Persist root + receipt, link to audit window
}

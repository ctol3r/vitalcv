import crypto from 'crypto';
import { PolkadotService } from './polkadot_service';
import { log } from '../obs/logger';

/**
 * logRationale hashes an explanation and anchors it on-chain.
 * @param id - unique identifier for the explanation
 * @param rationale - textual rationale to be hashed
 */
export async function logRationale(id: string, rationale: string): Promise<void> {
  const service = new PolkadotService();
  await service.connect();
  const hash = crypto.createHash('sha256').update(rationale).digest('hex');
  const payload = JSON.stringify({ id, hash });
  await service.anchorData(payload);
  log('info', 'Anchored rationale', {
    event: 'explainability_log_anchor',
    rationaleId: id,
    hash,
  });
}

import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';
import type { MultiDIDSynchronizer } from '@prisma/client';

export function anchorDidSync(sync: MultiDIDSynchronizer) {
  const didsHash = createHash('sha256')
    .update(JSON.stringify(sync.dids))
    .digest('hex');

  return anchorEvent('didSyncAnchored', {
    syncId: sync.id,
    clinicianId: sync.clinicianId,
    didsHash,
    snapshotAt: sync.updatedAt.toISOString(),
  });
}









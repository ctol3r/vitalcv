import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';
import type { CrossBorderBridge } from '@prisma/client';

export function anchorCrossBorder(bridge: CrossBorderBridge) {
  const mappingsHash = createHash('sha256')
    .update(JSON.stringify(bridge.mappings))
    .digest('hex');

  return anchorEvent('crossBorderBridgeAnchored', {
    bridgeId: bridge.id,
    clinicianId: bridge.clinicianId,
    mappingsHash,
    snapshotAt: bridge.updatedAt.toISOString(),
  });
}









import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';
import type { LiquidityIntelligence } from '@prisma/client';

export function anchorLiquidityIntelligence(intel: LiquidityIntelligence) {
  const intelHash = createHash('sha256')
    .update(JSON.stringify(intel.intel))
    .digest('hex');

  return anchorEvent('liquidityIntelligenceAnchored', {
    intelId: intel.id,
    region: intel.region,
    intelHash,
    snapshotAt: intel.updatedAt.toISOString(),
  });
}









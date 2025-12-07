import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';
import type { CredentialMaturity } from '@prisma/client';

export function anchorMaturity(maturity: CredentialMaturity) {
  const signalsHash = createHash('sha256')
    .update(JSON.stringify(maturity.signals))
    .digest('hex');

  return anchorEvent('employerMaturityAnchored', {
    maturityId: maturity.id,
    orgId: maturity.orgId,
    score: maturity.score,
    signalsHash,
    snapshotAt: maturity.updatedAt.toISOString(),
  });
}









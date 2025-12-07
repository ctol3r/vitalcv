import type { PrismaClient } from '@prisma/client';

import { detectWarrantyBreaches, type WarrantyBreachResult } from './breach';

export interface WarrantySettlementInput {
  credentialId: string;
  credentialType: string;
  issuerDid: string;
  claimAmount: number;
  reason?: string;
}

export interface WarrantySettlementDecision {
  warrantyId: string;
  credentialId: string;
  issuerDid: string;
  coverage: number;
  decision: 'approved' | 'pending' | 'denied';
  payout: number;
  reasonCodes: string[];
  claimAmount: number;
  breaches: WarrantyBreachResult;
  settledAt: string;
  notes?: string[];
}

export async function settleWarrantyClaim(
  prisma: PrismaClient,
  input: WarrantySettlementInput,
): Promise<WarrantySettlementDecision> {
  const claimAmount = Number.isFinite(input.claimAmount) && input.claimAmount > 0 ? input.claimAmount : 0;
  if (!claimAmount) {
    throw new Error('claimAmount must be greater than zero');
  }

  const warranty = await prisma.credentialWarranty.findUnique({
    where: { credentialId: input.credentialId.trim() },
  });

  if (!warranty) {
    throw new Error('credential_warranty_not_found');
  }

  const breaches = await detectWarrantyBreaches({
    credentialId: input.credentialId,
    credentialType: input.credentialType,
    issuerDid: input.issuerDid,
    expiresAt: warranty.expiresAt,
  });

  let decision: WarrantySettlementDecision['decision'] = 'pending';
  const reasonCodes: string[] = [];

  if (breaches.breaches.some((breach) => breach.type === 'expired_coverage')) {
    decision = 'denied';
    reasonCodes.push('coverage_expired');
  } else if (!breaches.breaches.length) {
    decision = 'pending';
    reasonCodes.push('awaiting_investigation');
  } else if (breaches.breaches.some((breach) => breach.type === 'false_issuance')) {
    decision = 'approved';
    reasonCodes.push('false_issuance_confirmed');
  } else if (breaches.breaches.some((breach) => breach.type === 'issuer_misconduct')) {
    decision = 'approved';
    reasonCodes.push('issuer_misconduct');
  }

  const payout = decision === 'approved' ? Math.min(claimAmount, warranty.coverage) : 0;
  const notes: string[] = [];
  if (input.reason) {
    notes.push(`claim_reason:${input.reason}`);
  }
  if (breaches.summary !== 'no_breaches_detected') {
    notes.push(`breach_summary:${breaches.summary}`);
  }

  return {
    warrantyId: warranty.id,
    credentialId: warranty.credentialId,
    issuerDid: warranty.issuerDid,
    coverage: warranty.coverage,
    decision,
    payout: Number(payout.toFixed(2)),
    reasonCodes,
    claimAmount,
    breaches,
    settledAt: new Date().toISOString(),
    notes: notes.length ? notes : undefined,
  };
}











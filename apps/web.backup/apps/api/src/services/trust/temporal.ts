import { NCIVerifiableProofType, PrismaClient } from '@prisma/client';
import { getTrustWeightSnapshot, normalizeWeight } from './weights';

const prisma = new PrismaClient();

const INACTIVITY_THRESHOLD_MONTHS = Number(process.env.TRUST_INACTIVITY_THRESHOLD ?? 12);
const DECAY_RATE_PER_MONTH = Number(process.env.TRUST_DECAY_RATE ?? 0.05);
const MAX_DECAY = Number(process.env.TRUST_DECAY_MAX ?? 0.6);

export interface TemporalTrustScore {
  issuerDid: string;
  baseWeight: number;
  normalizedWeight: number;
  lastIssuanceAt?: string;
  monthsInactive: number;
  decayApplied: number;
  adjustedWeight: number;
  adjustedNormalized: number;
  status: 'healthy' | 'stale' | 'dormant';
}

export async function computeTemporalTrustScore(issuerDid: string): Promise<TemporalTrustScore> {
  const weight = await getTrustWeightSnapshot(issuerDid);
  const lastIssuance = await prisma.nCIVerifiableProof.findFirst({
    where: {
      did: issuerDid,
      proofType: NCIVerifiableProofType.ISSUANCE,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      updatedAt: true,
    },
  });

  const lastIssuanceAt = lastIssuance?.updatedAt?.toISOString();
  const monthsInactive = computeMonthsInactive(lastIssuance?.updatedAt);
  const decayApplied = monthsInactive > INACTIVITY_THRESHOLD_MONTHS
    ? Math.min(
        MAX_DECAY,
        (monthsInactive - INACTIVITY_THRESHOLD_MONTHS) * DECAY_RATE_PER_MONTH,
      )
    : 0;

  const adjustedWeight = Math.max(0, weight.weight * (1 - decayApplied));
  const adjustedNormalized = normalizeWeight(adjustedWeight);

  return {
    issuerDid,
    baseWeight: weight.weight,
    normalizedWeight: weight.normalizedWeight,
    lastIssuanceAt,
    monthsInactive,
    decayApplied,
    adjustedWeight,
    adjustedNormalized,
    status: deriveStatus(monthsInactive, decayApplied),
  };
}

function computeMonthsInactive(lastIssuance?: Date): number {
  if (!lastIssuance) {
    return INACTIVITY_THRESHOLD_MONTHS + 1;
  }
  const diffMs = Date.now() - lastIssuance.getTime();
  const months = diffMs / (1000 * 60 * 60 * 24 * 30);
  return Math.max(0, Number(months.toFixed(1)));
}

function deriveStatus(monthsInactive: number, decay: number): TemporalTrustScore['status'] {
  if (decay >= MAX_DECAY * 0.8) {
    return 'dormant';
  }
  if (monthsInactive > INACTIVITY_THRESHOLD_MONTHS) {
    return 'stale';
  }
  return 'healthy';
}











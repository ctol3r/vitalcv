import { CRS_START_THRESHOLD, type CrsBand, type CrsBlockingReason } from '../../crs';
import {
  resolveVerificationReceiptStatus,
  type VerificationReceipt,
  type VerificationReceiptStatus,
} from '../receipts';

const BLOCKING_REASON_ORDER: readonly CrsBlockingReason[] = [
  'MISSING_PSV',
  'EXPIRED_PSV',
  'REVOKED_PSV',
  'MISSING_ACCEPTANCE',
] as const;

export type CredentialReadinessScore = Readonly<{
  clinician_id: string;
  score: number;
  band: CrsBand;
  blocking_reasons: readonly CrsBlockingReason[];
  last_verified_at: string;
}>;

export type DeterministicCrsInput = Readonly<{
  clinician_id: string;
  receipts: readonly VerificationReceipt[];
  has_acceptance: boolean;
  as_of: string;
  missing_acceptance_band?: 'YELLOW' | 'RED';
}>;

function computeLastVerifiedAt(receipts: readonly VerificationReceipt[], fallback: string): string {
  let latest = 0;

  for (const receipt of receipts) {
    const ts = Date.parse(receipt.fetched_at);
    if (Number.isFinite(ts)) {
      latest = Math.max(latest, ts);
    }
  }

  return latest > 0 ? new Date(latest).toISOString() : fallback;
}

function sortReasons(reasons: Set<CrsBlockingReason>): readonly CrsBlockingReason[] {
  return Object.freeze(BLOCKING_REASON_ORDER.filter((reason) => reasons.has(reason)));
}

function normalizeReceiptStatus(
  receipts: readonly VerificationReceipt[],
  as_of: string,
): readonly VerificationReceiptStatus[] {
  return receipts.map((receipt) => resolveVerificationReceiptStatus(receipt, as_of));
}

export function calculateDeterministicCrs(input: DeterministicCrsInput): CredentialReadinessScore {
  if (typeof input.clinician_id !== 'string' || input.clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }

  const reasons = new Set<CrsBlockingReason>();
  if (!Array.isArray(input.receipts) || input.receipts.length === 0) {
    reasons.add('MISSING_PSV');
  } else {
    const statuses = normalizeReceiptStatus(input.receipts, input.as_of);
    if (statuses.includes('EXPIRED')) {
      reasons.add('EXPIRED_PSV');
    }
    if (statuses.includes('REVOKED')) {
      reasons.add('REVOKED_PSV');
    }
  }

  if (!input.has_acceptance) {
    reasons.add('MISSING_ACCEPTANCE');
  }

  const blocking_reasons = sortReasons(reasons);

  let score = 95;
  let band: CrsBand = 'GREEN';

  if (
    blocking_reasons.includes('MISSING_PSV') ||
    blocking_reasons.includes('EXPIRED_PSV') ||
    blocking_reasons.includes('REVOKED_PSV')
  ) {
    score = 25;
    band = 'RED';
  } else if (blocking_reasons.includes('MISSING_ACCEPTANCE')) {
    if (input.missing_acceptance_band === 'RED') {
      score = 45;
      band = 'RED';
    } else {
      score = CRS_START_THRESHOLD;
      band = 'YELLOW';
    }
  }

  return Object.freeze({
    clinician_id: input.clinician_id,
    score,
    band,
    blocking_reasons,
    last_verified_at: computeLastVerifiedAt(input.receipts, input.as_of),
  });
}

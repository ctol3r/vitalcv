/** YC MVP — behavior frozen. Do not modify without scope approval. */
import { validateReceiptSet, type TrustStateReceiptRecord } from '@vitalcv/psv';

export const CRS_START_THRESHOLD = 80;

export type CrsBand = 'GREEN' | 'YELLOW' | 'RED';

export type CrsBlockingReason =
  | 'MISSING_PSV'
  | 'EXPIRED_PSV'
  | 'REVOKED_PSV'
  | 'MISSING_ACCEPTANCE';

export type CrsOutput = Readonly<{
  clinician_id: string;
  score: number;
  band: CrsBand;
  blocking_reasons: CrsBlockingReason[];
  last_verified_at: string;
}>;

export type CrsEngineDependencies = Readonly<{
  receipts: {
    listByClinician(clinician_id: string):
      | readonly TrustStateReceiptRecord[]
      | Promise<readonly TrustStateReceiptRecord[]>;
  };
  acceptances: {
    existsForClinician(clinician_id: string): boolean | Promise<boolean>;
  };
  now?: () => Date;
  missing_acceptance_band?: 'YELLOW' | 'RED';
}>;

const BLOCKING_REASON_ORDER: readonly CrsBlockingReason[] = [
  'MISSING_PSV',
  'EXPIRED_PSV',
  'REVOKED_PSV',
  'MISSING_ACCEPTANCE',
] as const;

function assertClinicianId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('clinician_id is required');
  }
}

function sortReasons(reasons: Set<CrsBlockingReason>): CrsBlockingReason[] {
  return BLOCKING_REASON_ORDER.filter((reason) => reasons.has(reason));
}

function computeLastVerifiedAt(receipts: readonly TrustStateReceiptRecord[], fallbackIso: string): string {
  let latest = 0;

  for (const receipt of receipts) {
    const parsed = Date.parse(receipt.fetched_at);
    if (Number.isFinite(parsed)) {
      latest = Math.max(latest, parsed);
    }
  }

  return latest > 0 ? new Date(latest).toISOString() : fallbackIso;
}

export class CrsEngine {
  constructor(private readonly deps: CrsEngineDependencies) {}

  async computeForClinician(input: { clinician_id: string; as_of: string }): Promise<CrsOutput> {
    assertClinicianId(input?.clinician_id);

    const asOf = input.as_of || (this.deps.now ?? (() => new Date()))().toISOString();

    const [receipts, hasAcceptance] = await Promise.all([
      this.deps.receipts.listByClinician(input.clinician_id),
      this.deps.acceptances.existsForClinician(input.clinician_id),
    ]);

    const receiptSummary = validateReceiptSet(receipts, asOf);

    const reasons = new Set<CrsBlockingReason>();
    if (receiptSummary.has_missing) reasons.add('MISSING_PSV');
    if (receiptSummary.has_expired) reasons.add('EXPIRED_PSV');
    if (receiptSummary.has_revoked) reasons.add('REVOKED_PSV');
    if (!hasAcceptance) reasons.add('MISSING_ACCEPTANCE');

    const orderedReasons = sortReasons(reasons);

    let score = 95;
    let band: CrsBand = 'GREEN';

    if (receiptSummary.has_missing || receiptSummary.has_expired || receiptSummary.has_revoked) {
      score = 25;
      band = 'RED';
    } else if (!hasAcceptance) {
      if (this.deps.missing_acceptance_band === 'RED') {
        score = 45;
        band = 'RED';
      } else {
        // Missing acceptance remains start-blocking via YELLOW band, while preserving deterministic score >= 80.
        score = 80;
        band = 'YELLOW';
      }
    }

    return Object.freeze({
      clinician_id: input.clinician_id,
      score,
      band,
      blocking_reasons: orderedReasons,
      last_verified_at: computeLastVerifiedAt(receipts, asOf),
    });
  }
}

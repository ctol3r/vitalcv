import type {
  BlockingReason,
  CrsResult,
  PsvReceiptRecord,
  TrustState,
  TrustStateResolverDependencies,
} from './contracts';

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CRS_START_THRESHOLD = 80;

const BLOCKING_REASON_ORDER: readonly BlockingReason[] = [
  'MISSING_PSV',
  'EXPIRED_PSV',
  'REVOKED_PSV',
  'MISSING_ACCEPTANCE',
  'CRS_BELOW_THRESHOLD',
  'START_ALREADY_ATTESTED',
] as const;

function assertClinicianId(clinician_id: string): void {
  if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }
}

function isValidRfc3339Utc(value: string): boolean {
  return RFC3339_UTC.test(value) && Number.isFinite(Date.parse(value));
}

function normalizeLastVerifiedAt(crs: CrsResult, fallbackIso: string): string {
  return isValidRfc3339Utc(crs.last_verified_at) ? crs.last_verified_at : fallbackIso;
}

function isReceiptExpired(receipt: PsvReceiptRecord, asOfEpochMs: number): boolean {
  if (!receipt || typeof receipt !== 'object') return true;

  if (!isValidRfc3339Utc(receipt.fetched_at)) return true;
  if (!Number.isInteger(receipt.ttl_seconds) || receipt.ttl_seconds <= 0) return true;

  const fetchedAtEpochMs = Date.parse(receipt.fetched_at);
  const expiresAtEpochMs = fetchedAtEpochMs + receipt.ttl_seconds * 1000;
  return asOfEpochMs > expiresAtEpochMs;
}

function sortBlockingReasons(reasons: Set<BlockingReason>): BlockingReason[] {
  return BLOCKING_REASON_ORDER.filter((reason) => reasons.has(reason));
}

export class TrustStateResolver {
  constructor(private readonly deps: TrustStateResolverDependencies) {}

  async resolve(clinician_id: string): Promise<TrustState> {
    assertClinicianId(clinician_id);

    const asOf = (this.deps.now ?? (() => new Date()))().toISOString();
    const asOfEpochMs = Date.parse(asOf);

    const [crs, receipts, hasAcceptance, hasStart] = await Promise.all([
      this.deps.crs.computeForClinician({ clinician_id, as_of: asOf }),
      this.deps.receipts.listByClinician(clinician_id),
      this.deps.acceptances.existsForClinician(clinician_id),
      this.deps.starts.existsForClinician(clinician_id),
    ]);

    const blockingReasons = new Set<BlockingReason>();

    if (!Array.isArray(receipts) || receipts.length === 0) {
      blockingReasons.add('MISSING_PSV');
    } else {
      for (const receipt of receipts) {
        if (receipt.revoked === true) {
          blockingReasons.add('REVOKED_PSV');
        }

        if (isReceiptExpired(receipt, asOfEpochMs)) {
          blockingReasons.add('EXPIRED_PSV');
        }
      }
    }

    if (!hasAcceptance) {
      blockingReasons.add('MISSING_ACCEPTANCE');
    }

    if (hasStart) {
      blockingReasons.add('START_ALREADY_ATTESTED');
    }

    if (crs.score < CRS_START_THRESHOLD || crs.band !== 'GREEN') {
      blockingReasons.add('CRS_BELOW_THRESHOLD');
    }

    const orderedReasons = sortBlockingReasons(blockingReasons);
    const start_ready = orderedReasons.length === 0;
    const last_verified_at = normalizeLastVerifiedAt(crs, asOf);

    const audit = await this.deps.audit.append({
      event_type: 'TRUST_STATE_CHECK',
      clinician_id,
      occurred_at: asOf,
      metadata: {
        start_ready,
        score: crs.score,
        band: crs.band,
        blocking_reasons: orderedReasons,
      },
    });

    return {
      clinician_id,
      start_ready,
      score: crs.score,
      band: crs.band,
      blocking_reasons: orderedReasons,
      last_verified_at,
      audit_ref: audit.audit_packet_id,
    };
  }
}

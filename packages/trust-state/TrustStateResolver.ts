import type {
  AcceptanceScopeRecord,
  AcceptanceProofRecord,
  BlockingReason,
  CrsResult,
  StartScopeRecord,
  TrustState,
  TrustStateScope,
  TrustStateResolverDependencies,
} from './contracts';
import { resolveReceiptStatus } from '../psv/validateReceipt';
import { trustStateLatencyHistogram } from './latencyHistogram';

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_HEX = /^[0-9a-f]{64}$/i;
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

function sortBlockingReasons(reasons: Set<BlockingReason>): BlockingReason[] {
  return BLOCKING_REASON_ORDER.filter((reason) => reasons.has(reason));
}

function normalizeScopeField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readHashAnchor(record: AcceptanceScopeRecord): string | null {
  const raw = normalizeScopeField(record.hash_anchor ?? record.hashAnchor);
  if (!raw) return null;
  return SHA256_HEX.test(raw) ? raw.toLowerCase() : null;
}

function readAcceptanceProof(record: AcceptanceScopeRecord): AcceptanceProofRecord | null {
  const candidate = (record.employer_proof ?? record.employerProof) as
    | AcceptanceProofRecord
    | undefined;

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const type = normalizeScopeField(candidate.type);
  const verificationMethod = normalizeScopeField(candidate.verificationMethod);
  const proofValue = normalizeScopeField(candidate.proofValue);

  if (!type || !verificationMethod || !proofValue) {
    return null;
  }

  return { type, verificationMethod, proofValue };
}

function hasValidAcceptanceProof(record: AcceptanceScopeRecord): boolean {
  return readHashAnchor(record) !== null && readAcceptanceProof(record) !== null;
}

function normalizeScope(scope?: Partial<TrustStateScope>): Partial<TrustStateScope> {
  if (!scope || typeof scope !== 'object') {
    return {};
  }

  const employer_id = normalizeScopeField(scope.employer_id);
  const facility_id = normalizeScopeField(scope.facility_id);
  const role = normalizeScopeField(scope.role);

  return {
    ...(employer_id ? { employer_id } : {}),
    ...(facility_id ? { facility_id } : {}),
    ...(role ? { role } : {}),
  };
}

function hasAnyScope(scope: Partial<TrustStateScope>): boolean {
  return Boolean(scope.employer_id || scope.facility_id || scope.role);
}

function hasFullScope(scope: Partial<TrustStateScope>): scope is TrustStateScope {
  return Boolean(scope.employer_id && scope.facility_id && scope.role);
}

function isScopeMatch(
  record: Pick<AcceptanceScopeRecord | StartScopeRecord, 'employer_id' | 'facility_id' | 'role'>,
  scope: TrustStateScope,
): boolean {
  return (
    record.employer_id === scope.employer_id &&
    record.facility_id === scope.facility_id &&
    record.role === scope.role
  );
}

export class TrustStateResolver {
  constructor(private readonly deps: TrustStateResolverDependencies) {}

  private async hasAcceptanceForScope(
    clinician_id: string,
    scope: Partial<TrustStateScope>,
  ): Promise<boolean> {
    if (!this.deps.acceptances.listByClinician) {
      // Fail closed: trust-state must verify acceptance proof presence/format.
      return false;
    }

    const validRecords = (await this.deps.acceptances.listByClinician(clinician_id)).filter(
      hasValidAcceptanceProof,
    );

    if (!hasAnyScope(scope)) {
      return validRecords.length > 0;
    }

    if (!hasFullScope(scope)) {
      return false;
    }

    return validRecords.some((record) => isScopeMatch(record, scope));
  }

  private async hasStartForScope(
    clinician_id: string,
    scope: Partial<TrustStateScope>,
  ): Promise<boolean> {
    if (!hasAnyScope(scope)) {
      return this.deps.starts.existsForClinician(clinician_id);
    }

    if (!hasFullScope(scope)) {
      // Partial scope is invalid for deterministic trust-state gating.
      return false;
    }

    if (this.deps.starts.existsForScope) {
      return this.deps.starts.existsForScope({
        clinician_id,
        employer_id: scope.employer_id,
        facility_id: scope.facility_id,
        role: scope.role,
      });
    }

    if (this.deps.starts.listByClinician) {
      const records = await this.deps.starts.listByClinician(clinician_id);
      return records.some((record) => isScopeMatch(record, scope));
    }

    return false;
  }

  async resolve(clinician_id: string, scope?: Partial<TrustStateScope>): Promise<TrustState> {
    const startedAtMs = Date.now();
    assertClinicianId(clinician_id);
    const normalizedScope = normalizeScope(scope);

    const asOf = (this.deps.now ?? (() => new Date()))().toISOString();

    const [crs, receipts, hasAcceptance, hasStart] = await Promise.all([
      this.deps.crs.computeForClinician({ clinician_id, as_of: asOf }),
      this.deps.receipts.listByClinician(clinician_id),
      this.hasAcceptanceForScope(clinician_id, normalizedScope),
      this.hasStartForScope(clinician_id, normalizedScope),
    ]);

    const blockingReasons = new Set<BlockingReason>();
    const decayedReceipts: Array<{ receipt_id: string; status: 'EXPIRED' | 'REVOKED' }> = [];

    if (!Array.isArray(receipts) || receipts.length === 0) {
      blockingReasons.add('MISSING_PSV');
    } else {
      for (const receipt of receipts) {
        const status = resolveReceiptStatus(receipt, asOf);
        if (status === 'REVOKED') {
          blockingReasons.add('REVOKED_PSV');
          decayedReceipts.push({ receipt_id: receipt.receipt_id, status });
        }

        if (status === 'EXPIRED') {
          blockingReasons.add('EXPIRED_PSV');
          decayedReceipts.push({ receipt_id: receipt.receipt_id, status });
        }
      }
    }

    if (!hasAcceptance) {
      blockingReasons.add('MISSING_ACCEPTANCE');
    }

    if (hasStart) {
      blockingReasons.add('START_ALREADY_ATTESTED');
    }

    const hasDecay = decayedReceipts.length > 0;
    const resolvedBand = hasDecay ? 'RED' : crs.band;
    const resolvedScore =
      hasDecay && crs.score >= CRS_START_THRESHOLD ? CRS_START_THRESHOLD - 1 : crs.score;

    if (resolvedScore < CRS_START_THRESHOLD || resolvedBand !== 'GREEN') {
      blockingReasons.add('CRS_BELOW_THRESHOLD');
    }

    for (const decayedReceipt of decayedReceipts) {
      await this.deps.audit.append({
        event_type: 'TRUST_STATE_DECAY',
        clinician_id,
        occurred_at: asOf,
        metadata: {
          receipt_id: decayedReceipt.receipt_id,
          previous_band: crs.band,
          new_band: 'RED',
          detected_at: asOf,
          status: decayedReceipt.status,
        },
      });
    }

    const orderedReasons = sortBlockingReasons(blockingReasons);
    const start_ready = orderedReasons.length === 0;
    const last_verified_at = normalizeLastVerifiedAt(crs, asOf);
    const latency_ms = Math.max(0, Date.now() - startedAtMs);
    const latencySnapshot = (this.deps.latency_histogram ?? trustStateLatencyHistogram).record(
      latency_ms,
    );
    const metrics = {
      latency_ms,
      p90_ms: latencySnapshot.p90_ms,
      p50_ms: latencySnapshot.p50_ms,
      p99_ms: latencySnapshot.p99_ms,
      bucket_counts: latencySnapshot.bucket_counts,
      verification_latency_ms: latency_ms,
      crs_band: resolvedBand,
      blocking_reason_count: orderedReasons.length,
    } as const;

    let linked_employers_count: number | undefined;
    let linked_clinicians_count: number | undefined;

    try {
      const listEmployersForClinician = this.deps.trust_graph?.listEmployersForClinician;
      if (listEmployersForClinician) {
        const links = await listEmployersForClinician(clinician_id);
        linked_employers_count = Array.isArray(links) ? links.length : 0;
      }
    } catch {
      linked_employers_count = undefined;
    }

    try {
      const listCliniciansForEmployer = this.deps.trust_graph?.listCliniciansForEmployer;
      if (listCliniciansForEmployer && normalizedScope.employer_id) {
        const links = await listCliniciansForEmployer(normalizedScope.employer_id);
        linked_clinicians_count = Array.isArray(links) ? links.length : 0;
      }
    } catch {
      linked_clinicians_count = undefined;
    }

    const audit = await this.deps.audit.append({
      event_type: 'TRUST_STATE_CHECK',
      clinician_id,
      occurred_at: asOf,
      metadata: {
        start_ready,
        score: resolvedScore,
        band: resolvedBand,
        blocking_reasons: orderedReasons,
        metrics,
      },
    });

    return {
      clinician_id,
      start_ready,
      score: resolvedScore,
      band: resolvedBand,
      blocking_reasons: orderedReasons,
      last_verified_at,
      audit_ref: audit.audit_packet_id,
      metrics: {
        latency_ms: metrics.latency_ms,
        p90_ms: metrics.p90_ms,
        verification_latency_ms: metrics.verification_latency_ms,
      },
      ...(typeof linked_employers_count === 'number' ? { linked_employers_count } : {}),
      ...(typeof linked_clinicians_count === 'number' ? { linked_clinicians_count } : {}),
    };
  }
}

/** YC MVP — behavior frozen. Do not modify without scope approval. */
import type {
  AcceptanceScopeRecord,
  AcceptanceProofRecord,
  BlockingReason,
  CrsResult,
  PsvReceiptRecord,
  StartScopeRecord,
  TrustStateCredentialArtifact,
  TrustState,
  TrustStateVerificationArtifact,
  TrustStateScope,
  TrustStateResolverDependencies,
} from './contracts';
import {
  validateCredentialArtifact,
  validateVerificationArtifact,
} from './artifactValidation';
import {
  coverageSatisfiesDecisionGradeTruth,
  type CanonicalSourceCoverageState,
} from './sourceCoverage';
import { resolveReceiptStatus } from '../psv/validateReceipt';
import { trustStateLatencyHistogram } from './latencyHistogram';

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_HEX = /^[0-9a-f]{64}$/i;
const CRS_START_THRESHOLD = 80;

const BLOCKING_REASON_ORDER: readonly BlockingReason[] = [
  'MISSING_PSV',
  'EXPIRED_PSV',
  'REVOKED_PSV',
  'FAILED_VERIFICATION',
  'IDENTITY_CONFLICT',
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

function normalizeVerificationCheck(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeAttestorId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function receiptCoverageState(
  receipt: { source_coverage_state?: CanonicalSourceCoverageState },
): CanonicalSourceCoverageState {
  return receipt.source_coverage_state ?? 'live';
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

type ArtifactProvenanceSummary = {
  hasAnyArtifacts: boolean;
  missingCredentialArtifacts: boolean;
  invalidCredentialArtifacts: number;
  invalidVerificationArtifacts: number;
  missingVerificationArtifacts: number;
  expiredVerificationArtifacts: number;
};

function summarizeArtifactProvenance(
  credentialArtifactsRaw: readonly unknown[],
  verificationArtifactsRaw: readonly unknown[],
  asOf: string,
): ArtifactProvenanceSummary {
  const validCredentialArtifacts: TrustStateCredentialArtifact[] = [];
  const validVerificationArtifacts: TrustStateVerificationArtifact[] = [];

  let invalidCredentialArtifacts = 0;
  let invalidVerificationArtifacts = 0;
  let expiredVerificationArtifacts = 0;

  for (const artifact of credentialArtifactsRaw) {
    try {
      validCredentialArtifacts.push(validateCredentialArtifact(artifact));
    } catch {
      invalidCredentialArtifacts += 1;
    }
  }

  for (const artifact of verificationArtifactsRaw) {
    try {
      const validArtifact = validateVerificationArtifact(artifact);
      if (Date.parse(validArtifact.fresh_until) <= Date.parse(asOf)) {
        expiredVerificationArtifacts += 1;
      }
      validVerificationArtifacts.push(validArtifact);
    } catch {
      invalidVerificationArtifacts += 1;
    }
  }

  const verificationByCredentialHash = new Map<string, TrustStateVerificationArtifact[]>();
  for (const artifact of validVerificationArtifacts) {
    if (!artifact.related_credential_hash) {
      continue;
    }

    const current = verificationByCredentialHash.get(artifact.related_credential_hash) ?? [];
    current.push(artifact);
    verificationByCredentialHash.set(artifact.related_credential_hash, current);
  }

  const missingVerificationArtifacts = validCredentialArtifacts.reduce((count, artifact) => {
    const matches = verificationByCredentialHash.get(artifact.credential_hash) ?? [];
    return matches.length === 0 ? count + 1 : count;
  }, 0);

  return {
    hasAnyArtifacts:
      credentialArtifactsRaw.length > 0 || verificationArtifactsRaw.length > 0,
    missingCredentialArtifacts: validCredentialArtifacts.length === 0,
    invalidCredentialArtifacts,
    invalidVerificationArtifacts,
    missingVerificationArtifacts,
    expiredVerificationArtifacts,
  };
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

    const [
      crs,
      receipts,
      hasAcceptance,
      hasStart,
      hasIdentityConflict,
      requiredPublicChecks,
      requiredManualChecks,
      credentialArtifacts,
      verificationArtifacts,
    ] =
      await Promise.all([
      this.deps.crs.computeForClinician({ clinician_id, as_of: asOf }),
      this.deps.receipts.listByClinician(clinician_id),
      this.hasAcceptanceForScope(clinician_id, normalizedScope),
      this.hasStartForScope(clinician_id, normalizedScope),
      this.deps.conflicts?.hasUnresolvedForClinician
        ? this.deps.conflicts.hasUnresolvedForClinician(clinician_id)
        : false,
      this.deps.verification?.required_public_checks
        ? this.deps.verification.required_public_checks
        : [],
      this.deps.verification?.required_manual_checks
        ? this.deps.verification.required_manual_checks
        : [],
      this.deps.artifacts?.listCredentialArtifactsByClinician
        ? this.deps.artifacts.listCredentialArtifactsByClinician(clinician_id)
        : [],
      this.deps.artifacts?.listVerificationArtifactsByClinician
        ? this.deps.artifacts.listVerificationArtifactsByClinician(clinician_id)
        : [],
    ]);

    const blockingReasons = new Set<BlockingReason>();
    const decayedReceipts: Array<{ receipt_id: string; status: 'EXPIRED' | 'REVOKED' }> = [];
    const passedPublicChecks = new Set<string>();
    const passedManualChecks = new Set<string>();
    const manualAttestorByCheck = new Map<string, string>();
    let hasDecisionGradeReceipt = false;
    let hasNonDecisionGradeReceipt = false;

    if (!Array.isArray(receipts) || receipts.length === 0) {
      blockingReasons.add('MISSING_PSV');
    } else {
      for (const receipt of receipts) {
        const coverageState = receiptCoverageState(receipt);
        const decisionGradeCoverage = coverageSatisfiesDecisionGradeTruth({
          state: coverageState,
        });
        const status = resolveReceiptStatus(receipt, asOf);
        if (receipt.verification_outcome === 'FAIL') {
          blockingReasons.add('FAILED_VERIFICATION');
        }

        if (decisionGradeCoverage) {
          hasDecisionGradeReceipt = true;
        } else {
          hasNonDecisionGradeReceipt = true;
        }

        if (status === 'REVOKED') {
          blockingReasons.add('REVOKED_PSV');
          decayedReceipts.push({ receipt_id: receipt.receipt_id, status });
        }

        if (status === 'EXPIRED') {
          blockingReasons.add('EXPIRED_PSV');
          decayedReceipts.push({ receipt_id: receipt.receipt_id, status });
        }

        if (coverageState === 'stale') {
          blockingReasons.add('EXPIRED_PSV');
        }

        if (
          receipt.lane === 'PUBLIC' &&
          status === 'VALID' &&
          receipt.verification_outcome !== 'FAIL' &&
          decisionGradeCoverage
        ) {
          const check = normalizeVerificationCheck(receipt.verification_check);
          if (check) {
            passedPublicChecks.add(check);
          }
        }

        if (
          receipt.lane === 'MANUAL' &&
          status === 'VALID' &&
          receipt.verification_outcome !== 'FAIL' &&
          decisionGradeCoverage
        ) {
          const check = normalizeVerificationCheck(receipt.verification_check);
          if (check) {
            passedManualChecks.add(check);
            const attestor = normalizeAttestorId(receipt.attestor_id);
            if (attestor && !manualAttestorByCheck.has(check)) {
              manualAttestorByCheck.set(check, attestor);
            }
          }
        }
      }

      if (
        hasNonDecisionGradeReceipt &&
        !hasDecisionGradeReceipt &&
        !blockingReasons.has('EXPIRED_PSV') &&
        !blockingReasons.has('REVOKED_PSV')
      ) {
        blockingReasons.add('MISSING_PSV');
      }
    }

    const requiredChecks = Array.isArray(requiredPublicChecks)
      ? requiredPublicChecks
          .map((check) => normalizeVerificationCheck(check))
          .filter((check): check is string => Boolean(check))
      : [];
    if (requiredChecks.length > 0) {
      const missingRequiredCheck = requiredChecks.some((check) => !passedPublicChecks.has(check));
      if (missingRequiredCheck) {
        blockingReasons.add('MISSING_PSV');
      }
    }

    const requiredManual = Array.isArray(requiredManualChecks)
      ? requiredManualChecks
          .map((check) => normalizeVerificationCheck(check))
          .filter((check): check is string => Boolean(check))
      : [];
    if (requiredManual.length > 0) {
      const missingRequiredManual = requiredManual.some((check) => !passedManualChecks.has(check));
      if (missingRequiredManual) {
        blockingReasons.add('MISSING_PSV');
      }
    }

    const artifactSourceConfigured =
      Boolean(this.deps.artifacts?.listCredentialArtifactsByClinician) ||
      Boolean(this.deps.artifacts?.listVerificationArtifactsByClinician);
    if (artifactSourceConfigured) {
      const artifactSummary = summarizeArtifactProvenance(
        Array.isArray(credentialArtifacts) ? credentialArtifacts : [],
        Array.isArray(verificationArtifacts) ? verificationArtifacts : [],
        asOf,
      );

      if (
        !artifactSummary.hasAnyArtifacts ||
        artifactSummary.missingCredentialArtifacts ||
        artifactSummary.missingVerificationArtifacts > 0
      ) {
        blockingReasons.add('MISSING_PSV');
      }

      if (
        artifactSummary.invalidCredentialArtifacts > 0 ||
        artifactSummary.invalidVerificationArtifacts > 0
      ) {
        blockingReasons.add('FAILED_VERIFICATION');
      }

      if (artifactSummary.expiredVerificationArtifacts > 0) {
        blockingReasons.add('EXPIRED_PSV');
      }
    }

    const verification_messages = Object.freeze(
      [...new Set(
        (requiredManual.length > 0 ? requiredManual : [...passedManualChecks])
          .map((check) => manualAttestorByCheck.get(check))
          .filter((attestor): attestor is string => Boolean(attestor))
          .sort((left, right) => left.localeCompare(right))
          .map((attestor) => `Manual verification completed by ${attestor}`),
      )],
    );

    if (hasIdentityConflict) {
      blockingReasons.add('IDENTITY_CONFLICT');
    }

    if (!hasAcceptance) {
      blockingReasons.add('MISSING_ACCEPTANCE');
    }

    if (hasStart) {
      blockingReasons.add('START_ALREADY_ATTESTED');
    }

    const hasDecay = decayedReceipts.length > 0;
    const hasFailedVerification = blockingReasons.has('FAILED_VERIFICATION');
    const hasMissingPsv = blockingReasons.has('MISSING_PSV');
    const hasRiskConflict = hasDecay || hasFailedVerification || hasIdentityConflict || hasMissingPsv;
    const resolvedBand = hasRiskConflict ? 'RED' : crs.band;
    const resolvedScore =
      hasRiskConflict && crs.score >= CRS_START_THRESHOLD ? CRS_START_THRESHOLD - 1 : crs.score;

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

    try {
      await this.deps.telemetry?.recordResolverRuntime?.({
        latency_ms,
        band: resolvedBand,
        blocking_reason_count: orderedReasons.length,
        start_ready,
      });
    } catch {
      // Ignore telemetry failures so trust-state enforcement remains deterministic.
    }

    return {
      clinician_id,
      start_ready,
      score: resolvedScore,
      band: resolvedBand,
      blocking_reasons: orderedReasons,
      last_verified_at,
      audit_ref: audit.audit_packet_id,
      ...(verification_messages.length > 0 ? { verification_messages } : {}),
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

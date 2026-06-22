/**
 * Pure adapter: PassportData -> EvidenceCollection (Wave 220, first build).
 *
 * Keeps all PassportData-specific knowledge in the app so @vitalcv/domain-evidence
 * stays app-agnostic. Pure transform — no fetches, no writes (mirrors
 * lib/packet/career-packet.ts). Status is taken VERBATIM from source coverage so
 * honesty (no upgrade of gated/stale) is preserved by construction.
 */

import {
  buildEvidenceCollection,
  isDecisionGradeStatus,
  type EvidenceClass,
  type EvidenceCollection,
  type EvidenceLifecycle,
  type EvidenceObject,
  type EvidenceRelationship,
  type EvidenceStatus,
} from '@vitalcv/domain-evidence';
import type { PassportData, PassportAuthorityCredential } from '@/lib/trust/passport-contract';
import type { PassportSourceCoverageCheck } from '@/lib/trust/source-coverage';

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Classify a verification source into an evidence class. The launch spine and
 * extended sources are enumerated; the fallback ('licensure') only triggers for
 * a genuinely novel source id and is best-effort — status is still verbatim, so
 * a mis-class never fabricates trust.
 */
function classifyEvidenceClass(sourceId: string): EvidenceClass {
  const s = normalizeId(sourceId);
  if (s.includes('nppes') || s.includes('npi') || s.includes('identity')) return 'identity';
  if (s.includes('oig') || s.includes('leie') || s.includes('sam') || s.includes('exclusion') || s.includes('sanction')) return 'exclusion';
  if (s.includes('pecos') || s.includes('enroll')) return 'enrollment';
  if (s.includes('dea')) return 'registration';
  if (s.includes('npdb')) return 'peer_review';
  // Board CERTIFICATION (ABMS), not a state "medical board" (which issues licenses).
  if (s.includes('abms') || s.includes('certif') || s.includes('boardcert')) return 'board_cert';
  if (s.includes('orcid') || s.includes('pubmed') || s.includes('publication')) return 'publication';
  if (s.includes('trial') || s.includes('research')) return 'research';
  // STATE_BOARD, NURSYS, and other licensure registries:
  return 'licensure';
}

function humanizeSourceId(sourceId: string): string {
  return sourceId.replace(/_/g, ' ');
}

function coverageCheckToEvidence(
  subjectKey: string,
  check: PassportSourceCoverageCheck,
): EvidenceObject {
  const status = check.state as EvidenceStatus;
  return {
    evidenceId: `coverage:${check.sourceId}`,
    subjectKey,
    evidenceClass: classifyEvidenceClass(check.sourceId),
    label: humanizeSourceId(check.sourceId),
    value: { reason: check.reason },
    status,
    source: {
      sourceId: check.sourceId,
      sourceLabel: humanizeSourceId(check.sourceId),
      laneType: null,
      governance: null,
    },
    trustTier: null,
    decisionGrade: isDecisionGradeStatus(status),
    observedAt: check.observedAt ?? null,
    checkedAt: check.checkedAt ?? null,
    expiresAt: check.expiresAt ?? null,
    freshnessWindowHours: check.freshnessWindowHours ?? null,
    integrityHash: check.checksum ?? null,
    provenance: {
      artifactIds: check.proof?.artifactIds ? [...check.proof.artifactIds] : [],
      receiptIds: check.proof?.receiptIds ? [...check.proof.receiptIds] : [],
      sourceUrl: check.sourceUrl ?? null,
      checksum: check.checksum ?? null,
      parserVersion: check.parserVersion ?? null,
    },
    lifecycle: 'active',
    supersedes: null,
    supersededBy: null,
  };
}

function classifyCredentialClass(cred: PassportAuthorityCredential): EvidenceClass {
  const t = normalizeId(`${cred.type} ${cred.domain}`);
  // License first: a state "Medical Board" license must not be tagged board_cert.
  if (t.includes('licens')) return 'licensure';
  if (t.includes('abms') || t.includes('certif') || t.includes('boardcert')) return 'board_cert';
  if (t.includes('dea')) return 'registration';
  if (t.includes('identity') || t.includes('npi')) return 'identity';
  if (t.includes('exclusion') || t.includes('oig')) return 'exclusion';
  return 'licensure';
}

/** Conservative status mapping: a credential is only decision-grade when it is
 * active, not stale, not in review, and primary-source verified. */
function deriveCredentialStatus(cred: PassportAuthorityCredential): EvidenceStatus {
  if (cred.reviewRequired) return 'reviewRequired';
  const status = cred.status.toUpperCase();
  if (status === 'REVOKED' || status === 'SUSPENDED') return 'reviewRequired';
  if (status === 'EXPIRED') return 'stale';
  if (cred.stale) return 'stale';
  const level = (cred.verificationLevel ?? '').toUpperCase();
  if (level.includes('PRIMARY') || level.includes('TRIPLE')) return 'checked';
  if (level.includes('SELF')) return 'notDecisionGrade';
  return 'pending';
}

function credentialLifecycle(cred: PassportAuthorityCredential): EvidenceLifecycle {
  const status = cred.status.toUpperCase();
  if (status === 'REVOKED' || status === 'SUSPENDED') return 'revoked';
  if (status === 'EXPIRED') return 'expired';
  return 'active';
}

function credentialToEvidence(
  subjectKey: string,
  cred: PassportAuthorityCredential,
): EvidenceObject {
  const status = deriveCredentialStatus(cred);
  return {
    evidenceId: `cred:${cred.id}`,
    subjectKey,
    evidenceClass: classifyCredentialClass(cred),
    label: cred.domain || cred.type,
    value: { status: cred.status, jurisdiction: cred.jurisdiction ?? null },
    status,
    source: {
      sourceId: cred.sourceId ?? cred.domain,
      sourceLabel: cred.issuerName ?? cred.domain,
      laneType: null,
      governance: null,
    },
    trustTier: cred.confidenceLabel ?? null,
    decisionGrade: isDecisionGradeStatus(status),
    observedAt: cred.observedAt ?? null,
    checkedAt: cred.verifiedAt ?? null,
    expiresAt: cred.expiresAt ?? null,
    freshnessWindowHours: null,
    integrityHash: null,
    provenance: { artifactIds: [], receiptIds: [], sourceUrl: null, checksum: null, parserVersion: null },
    lifecycle: credentialLifecycle(cred),
    supersedes: null,
    supersededBy: null,
  };
}

/** Build the per-entity EvidenceCollection from a hydrated passport. */
export function passportToEvidenceCollection(passport: PassportData): EvidenceCollection {
  const subjectKey = passport.entityId;
  const objects: EvidenceObject[] = [
    ...(passport.sourceCoverage.checks ?? []).map((check) => coverageCheckToEvidence(subjectKey, check)),
    ...passport.authority.credentials.map((cred) => credentialToEvidence(subjectKey, cred)),
  ];

  // Every evidence object is verified_by its source node (feeds the C5 graph).
  const relationships: EvidenceRelationship[] = objects.map((obj) => ({
    from: obj.evidenceId,
    to: obj.source.sourceId,
    type: 'verified_by',
    confidence: null,
    observedAt: obj.checkedAt,
  }));

  return buildEvidenceCollection({
    subjectKey,
    generatedFor: {
      displayName: passport.identity.displayName,
      npi: passport.identity.npi ?? passport.npi ?? null,
    },
    objects,
    relationships,
  });
}

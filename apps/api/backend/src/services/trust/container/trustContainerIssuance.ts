import { sha256ForPayload } from '../../../utils/deterministic';
import { createTrustContainer } from './index';
import {
  buildTrustContainerManifestEntry,
  trustContainerFailedEntry,
  type TrustContainerManifestEntry,
} from './trustContainerManifest';
import {
  CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
  type CredentialEnvelopePayload,
  type FreshnessDescriptor,
  type IssuerMetadata,
  type ProofStatus,
  type ProofTier,
  type PsvReceiptRef,
} from './trustContainerContract';
import type { TrustPassport } from '../../entity/passportService';

/**
 * Convert a TrustPassport snapshot into a CredentialEnvelopePayload that
 * the trust container can issue. Mirrors the service-layer binding used
 * by trustProof.ts so both exit paths produce compatible envelopes.
 */
const TRUST_CONTAINER_FRESHNESS_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_ISSUER_DID = 'did:vitalcv:issuer_default';
const DEFAULT_ISSUER_NAME = 'VitalCV';

function deriveFreshness(evidenceAsOf: string): FreshnessDescriptor {
  const verifiedMs = Date.parse(evidenceAsOf);
  const ageSec = Number.isFinite(verifiedMs)
    ? Math.max(0, Math.floor((Date.now() - verifiedMs) / 1000))
    : Number.POSITIVE_INFINITY;
  let label: FreshnessDescriptor['label'] = 'REAL_TIME';
  if (ageSec > TRUST_CONTAINER_FRESHNESS_TTL_SECONDS) label = 'STALE';
  else if (ageSec > TRUST_CONTAINER_FRESHNESS_TTL_SECONDS / 2) label = 'AGING';
  else if (ageSec > 60 * 15) label = 'FRESH';
  return { label, evidenceAsOf, ttlSeconds: TRUST_CONTAINER_FRESHNESS_TTL_SECONDS };
}

function deriveProofTier(readinessScore: number): ProofTier {
  if (readinessScore >= 80) return 'DECISION_GRADE';
  if (readinessScore >= 40) return 'PARTIAL';
  if (readinessScore > 0) return 'SNAPSHOT';
  return 'NONE';
}

function deriveProofStatus(
  readinessScore: number,
  limitations: string[],
  blocked: boolean,
): ProofStatus {
  if (blocked || readinessScore === 0) return 'BLOCKED';
  if (limitations.length > 0 || readinessScore < 80) return 'PARTIAL';
  return 'DECISION_GRADE';
}

function appendLimitation(
  limitationNotes: string[],
  value: string | null | undefined,
): void {
  const normalized = value?.trim();
  if (normalized && !limitationNotes.includes(normalized)) {
    limitationNotes.push(normalized);
  }
}

function appendLimitations(
  limitationNotes: string[],
  values: readonly string[] | undefined,
): void {
  for (const value of values ?? []) {
    appendLimitation(limitationNotes, value);
  }
}

function collectPassportLimitations(passport: TrustPassport): string[] {
  const limitationNotes: string[] = [];
  appendLimitations(limitationNotes, passport.readiness.blockers);
  appendLimitations(limitationNotes, passport.readiness.gaps);
  appendLimitations(limitationNotes, passport.trustPosture.blockers);
  appendLimitations(limitationNotes, passport.trustPosture.missingItems);
  appendLimitations(limitationNotes, passport.trustPosture.gatedItems);
  appendLimitations(limitationNotes, passport.trustPosture.reviewRequiredItems);
  appendLimitations(limitationNotes, passport.trustPosture.staleItems);
  return limitationNotes;
}

export interface BuildPassportEnvelopeInput {
  passport: TrustPassport;
  evidenceAsOf?: string;
  issuer?: Partial<IssuerMetadata>;
}

export function buildCredentialEnvelopeFromPassport(
  input: BuildPassportEnvelopeInput,
): CredentialEnvelopePayload {
  const { passport } = input;
  const evidenceAsOf =
    input.evidenceAsOf ?? passport.lastCheckedAt ?? new Date().toISOString();

  const limitationNotes = collectPassportLimitations(passport);

  const sourceCoverage = Array.from(
    new Set(passport.sourceCoverage.checks.map((c) => c.sourceId)),
  ).sort();

  const psvReceiptRefs: PsvReceiptRef[] = passport.sourceCoverage.checks.flatMap((check) => {
    const receiptIds = check.proof?.receiptIds ?? [];
    return receiptIds.map<PsvReceiptRef>((receiptId) => ({
      receiptId,
      source: check.sourceId,
      verifiedAt: check.checkedAt ?? evidenceAsOf,
      checksum: check.checksum ?? 'unknown',
    }));
  });

  const readinessScore =
    passport.readiness.readiness_score ?? passport.readiness.score ?? 0;
  const blocked = passport.readiness.status === 'BLOCKED';
  const status = deriveProofStatus(readinessScore, limitationNotes, blocked);
  const derivedTier = deriveProofTier(readinessScore);

  // Preserve partial/blocked: never let tier stay DECISION_GRADE unless status agrees.
  const proofTier: ProofTier =
    status === 'DECISION_GRADE'
      ? 'DECISION_GRADE'
      : derivedTier === 'DECISION_GRADE'
        ? 'PARTIAL'
        : derivedTier;

  const auditHash = sha256ForPayload({
    entityId: passport.entityId,
    npi: passport.npi ?? null,
    readinessScore,
    limitationNotes,
    sourceCoverage,
    evidenceAsOf,
  });

  const issuer: IssuerMetadata = {
    did: input.issuer?.did ?? DEFAULT_ISSUER_DID,
    name: input.issuer?.name ?? DEFAULT_ISSUER_NAME,
    provider: input.issuer?.provider ?? 'mock',
    ...(input.issuer?.endpoint ? { endpoint: input.issuer.endpoint } : {}),
  };

  return {
    entityId: passport.entityId,
    subject: {
      npi: passport.npi ?? '',
      entityId: passport.entityId,
      ...(passport.identity.displayName
        ? { displayName: passport.identity.displayName }
        : {}),
    },
    clinicianNpi: passport.npi ?? '',
    sourceCoverage,
    psvReceiptRefs,
    proofTier,
    freshness: deriveFreshness(evidenceAsOf),
    limitationNotes,
    auditHash,
    issuer,
    schemaVersion: CREDENTIAL_ENVELOPE_SCHEMA_VERSION,
    status,
  };
}

export interface IssueTrustContainerManifestEntryInput {
  passport: TrustPassport;
  envelope?: CredentialEnvelopePayload;
  issuer?: Partial<IssuerMetadata>;
  evidenceAsOf?: string;
}

/**
 * Build an envelope from a passport, ask the configured trust container
 * to issue it, and return a manifest entry suitable for embedding in a
 * proof-pack export. Issuance failure never propagates — it becomes an
 * explicit `failed` entry carrying the underlying reason so exports
 * still succeed and the audit trail records *why* issuance dropped.
 */
export async function issueTrustContainerManifestEntry(
  input: IssueTrustContainerManifestEntryInput,
): Promise<TrustContainerManifestEntry> {
  let providerKind: 'mock' | 'dock' | 'vitalcv' | null = null;
  try {
    const container = createTrustContainer();
    providerKind = container.kind;
    const envelope =
      input.envelope ??
      buildCredentialEnvelopeFromPassport({
        passport: input.passport,
        evidenceAsOf: input.evidenceAsOf,
        issuer: { ...input.issuer, provider: container.kind },
      });

    const alignedEnvelope: CredentialEnvelopePayload = {
      ...envelope,
      issuer: { ...envelope.issuer, provider: container.kind },
    };

    const issuance = await container.issueCredential(alignedEnvelope);
    return buildTrustContainerManifestEntry({
      issuance,
      envelope: alignedEnvelope,
      provider: container.kind,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'trust container issuance failed';
    return trustContainerFailedEntry({ reason, provider: providerKind });
  }
}

/**
 * replayEngine.ts — Decision Replay & Audit Engine
 *
 * Turns a DecisionCapsule ID into a fully replayable accountability record.
 *
 * Given a capsule, this engine:
 *   1. Fetches the capsule + all supporting VerificationArtifacts
 *   2. Reconstructs the evidence state that existed at decision time
 *   3. Verifies the artifact hash has not drifted (tamper detection)
 *   4. Builds the authority chain: credential → issuer → verifier → decision
 *   5. Packages everything as a portable, self-describing audit bundle
 *
 * Design constraint: no migrations. All data sourced from existing tables.
 * Deterministic: same capsule always produces identical replay output.
 */

import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { capsuleEngine } from '../decision/capsuleEngine';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EvidenceRecord {
  artifactId: string;
  source: string;
  sourceLabel: string;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  credentialType: string;
  jurisdiction: string | null;
  // Raw payload minus PII — keep issuer, dates, status; strip SSN/DOB/address
  sanitizedPayload: Record<string, unknown>;
}

export interface SourceConsulted {
  source: string;
  label: string;
  consultedAt: string | null;
  outcome: 'VERIFIED' | 'EXPIRED' | 'NOT_FOUND' | 'FAILED' | 'PENDING';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TrustStateSnapshot {
  trustBand: string;
  trustScore: number;
  readinessStatus: string;
  capturedAt: string | null;
  methodology: string;
}

export interface VerifierIdentity {
  type: 'SYSTEM' | 'ORGANIZATION' | 'HUMAN' | 'AI_AGENT';
  systemId: string;
  orgId: string | null;
  userId: string | null;
  confirmedBy: string | null;
  timestamp: string;
}

export interface AuthorityChainLink {
  position: number;
  nodeType: 'CLINICIAN' | 'CREDENTIAL' | 'ISSUER' | 'VERIFIER' | 'DECISION';
  id: string;
  label: string;
  source: string;
  status: string;
  linkedAt: string | null;
  edgeType: 'HOLDS' | 'ISSUED_BY' | 'VERIFIED_BY' | 'CONFIRMED_BY' | 'PRODUCED';
}

export interface IntegrityCheck {
  storedHash: string;
  recomputedHash: string;
  hashMatch: boolean;
  methodology: string;
  methodologyVersion: string;
  verifiedAt: string;
  tamperEvidence: string | null;   // null = clean
}

export interface DecisionAttestationSnapshot {
  artifactHash: string;
  capsuleId: string;
  decisionAction: string | null;
  decisionTimestamp: string;
  decisionType: string;
  methodologyVersion: string;
  sourceReferenceId: string;
  status: string;
  subjectDid: string;
  subjectNpi: string;
  triggerEvent: string;
  verifierOrgId: string | null;
}

export interface DecisionAttestationRecord {
  attesterId: string | null;
  attesterRole: string | null;
  statement: string | null;
  timestamp: string | null;
  hash: string | null;
  snapshot: DecisionAttestationSnapshot;
  verification: {
    storedHash: string | null;
    computedHash: string | null;
    hashMatch: boolean;
    tamperEvidence: string | null;
  };
}

export interface DecisionReplay {
  schema: 'https://vitalcv.com/replay/v1';
  replayVersion: '1.0';

  // Core identity
  capsuleId: string;
  subjectNpi: string;
  subjectDid: string;
  decisionType: string;
  decisionTimestamp: string;
  status: string;

  // What was decided
  decision: {
    action: string | null;
    outcome: string;
    triggerEvent: string | null;
    sourceReferenceId: string | null;
    organizationId: string | null;
    notes: string | null;
    deploymentContext: Record<string, unknown> | null;
  };

  attestations: DecisionAttestationRecord[];

  // Who decided
  verifierIdentity: VerifierIdentity;

  // Evidence at time of decision
  evidenceSnapshot: {
    credentialIds: string[];          // IDs in the capsule
    evidenceRecords: EvidenceRecord[];
    sourcesConsulted: SourceConsulted[];
    trustStateAtDecision: TrustStateSnapshot;
    anomaliesDetected: string[];
  };

  // Cryptographic integrity
  integrity: IntegrityCheck;

  // Provenance chain
  authorityChain: AuthorityChainLink[];

  // Related decisions for this NPI (timeline context)
  relatedDecisions: Array<{
    capsuleId: string;
    decisionType: string;
    decisionTimestamp: string;
    status: string;
    action: string | null;
  }>;

  replayedAt: string;
}

export interface AuditBundle {
  schema: 'https://vitalcv.com/audit-bundle/v1';
  bundleVersion: '1.0';
  bundleId: string;             // UUID for this export
  bundleHash: string;           // SHA-256 of entire bundle content (excluding this field)
  exportedAt: string;

  subject: { npi: string; did: string };
  capsuleCount: number;
  issuer: 'VitalCV';
  methodology: string;

  replays: DecisionReplay[];

  // Verification instructions for third parties
  verificationInstructions: {
    hashAlgorithm: 'SHA-256';
    how: string;
    replayEndpoint: string;
    verifyEndpoint: string;
  };

  // Chain of custody log
  custodyLog: Array<{
    event: string;
    timestamp: string;
    actor: string;
  }>;
}

// ── Source metadata ───────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  NPPES: 'NPI Registry (CMS)',
  STATE_BOARD: 'State Medical Board',
  NURSYS: 'Nursys Nursing License Compact',
  OIG_LEIE: 'OIG/LEIE Exclusion Database',
  OIG: 'OIG Exclusion Registry',
  LEIE: 'LEIE Exclusion Database',
  DEA: 'DEA Registration (DOJ)',
  ABIM: 'American Board of Internal Medicine',
  ABFM: 'American Board of Family Medicine',
  ABEM: 'American Board of Emergency Medicine',
  ABP: 'American Board of Pediatrics',
  ABNS: 'American Board of Neurological Surgery',
  ABOG: 'American Board of Obstetrics and Gynecology',
  ABS: 'American Board of Surgery',
  BOARD_CERTIFICATION: 'Board Certification Registry',
  NPI_ENROLLMENT: 'NPI Enrollment (CMS)',
  ACGME: 'ACGME Training Registry',
  TRAINING_RECORD: 'Training Records',
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function credentialType(source: string): string {
  if (['STATE_BOARD', 'NURSYS'].includes(source)) return 'STATE_LICENSE';
  if (['OIG_LEIE', 'OIG', 'LEIE'].includes(source)) return 'SANCTION_CHECK';
  if (source === 'DEA') return 'DEA_REGISTRATION';
  if (['ABIM', 'ABFM', 'ABEM', 'ABP', 'ABNS', 'ABOG', 'ABS', 'BOARD_CERTIFICATION'].includes(source)) return 'BOARD_CERTIFICATION';
  if (source === 'NPPES') return 'NPI_IDENTITY';
  if (['ACGME', 'TRAINING_RECORD'].includes(source)) return 'TRAINING_CREDENTIAL';
  return 'VERIFICATION_RECORD';
}

function sourceOutcome(status: string): SourceConsulted['outcome'] {
  if (['VERIFIED', 'ACTIVE'].includes(status)) return 'VERIFIED';
  if (status === 'EXPIRED') return 'EXPIRED';
  if (status === 'NOT_FOUND') return 'NOT_FOUND';
  if (['FAILED', 'ERROR'].includes(status)) return 'FAILED';
  return 'PENDING';
}

function sourceConfidence(source: string, status: string): SourceConsulted['confidence'] {
  if (status !== 'VERIFIED' && status !== 'ACTIVE') return 'LOW';
  if (['NPPES', 'OIG_LEIE', 'OIG', 'DEA'].includes(source)) return 'HIGH';
  if (['STATE_BOARD', 'NURSYS', 'ABIM', 'ABFM'].includes(source)) return 'HIGH';
  return 'MEDIUM';
}

const MAX_DECISION_ATTESTATION_BYTES = 32 * 1024;
const MAX_DECISION_ATTESTATION_METADATA_BYTES = 64 * 1024;

type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike };

export class DecisionAttestationError extends Error {
  constructor(
    public readonly code:
      | 'ACTION_NOT_ATTESTABLE'
      | 'INVALID_ATTESTATION_TIMESTAMP'
      | 'INVALID_ATTESTATION_PAYLOAD'
      | 'ATTESTATION_SERIALIZATION_FAILED'
      | 'ATTESTATION_PAYLOAD_TOO_LARGE',
    public readonly statusCode: 400 | 409 | 413,
    message: string,
  ) {
    super(message);
    this.name = 'DecisionAttestationError';
  }
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeJsonLike(value: unknown, seen = new WeakSet<object>()): JsonLike | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  if (seen.has(value)) {
    throw new DecisionAttestationError(
      'ATTESTATION_SERIALIZATION_FAILED',
      400,
      'Decision attestation payload contains a circular reference.',
    );
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const normalizedArray = value.map((entry) => {
      const normalizedEntry = normalizeJsonLike(entry, seen);
      return normalizedEntry === undefined ? null : normalizedEntry;
    });
    seen.delete(value);
    return normalizedArray;
  }

  const normalizedRecord: Record<string, JsonLike> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const normalizedEntry = normalizeJsonLike(
      (value as Record<string, unknown>)[key],
      seen,
    );
    if (normalizedEntry !== undefined) {
      normalizedRecord[key] = normalizedEntry;
    }
  }

  seen.delete(value);
  return normalizedRecord;
}

function toBoundedJsonRecord(input: {
  capsuleId: string;
  value: unknown;
  byteLimit: number;
  label: string;
}): Record<string, JsonLike> {
  let normalized: JsonLike | undefined;
  let serialized: string;

  try {
    normalized = normalizeJsonLike(input.value);
    serialized = JSON.stringify(normalized ?? {});
  } catch (error) {
    log('warn', 'decision_attestation_payload_rejected', {
      capsuleId: input.capsuleId,
      label: input.label,
      reason: 'serialization_failed',
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw error instanceof DecisionAttestationError
      ? error
      : new DecisionAttestationError(
          'ATTESTATION_SERIALIZATION_FAILED',
          400,
          'Decision attestation payload could not be serialized safely.',
        );
  }

  const byteLength = Buffer.byteLength(serialized, 'utf8');
  if (byteLength > input.byteLimit) {
    log('warn', 'decision_attestation_payload_rejected', {
      capsuleId: input.capsuleId,
      label: input.label,
      reason: 'payload_too_large',
      byteLength,
      byteLimit: input.byteLimit,
    });
    throw new DecisionAttestationError(
      'ATTESTATION_PAYLOAD_TOO_LARGE',
      413,
      'Decision attestation payload is too large to store safely.',
    );
  }

  return JSON.parse(JSON.stringify(normalized ?? {})) as Record<string, JsonLike>;
}

function stableStringify(value: JsonLike): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key]!)}`).join(',')}}`;
}

function safeHashJson(input: {
  capsuleId: string;
  label: string;
  value: unknown;
}): string {
  const normalized = normalizeJsonLike(input.value);
  if (normalized === undefined) {
    log('warn', 'decision_attestation_hash_rejected', {
      capsuleId: input.capsuleId,
      label: input.label,
      reason: 'undefined_payload',
    });
    throw new DecisionAttestationError(
      'INVALID_ATTESTATION_PAYLOAD',
      400,
      'Decision attestation payload is incomplete.',
    );
  }

  return sha256(stableStringify(normalized));
}

function resolveAttestationTimestamp(timestamp?: string): string {
  const normalized = normalizeOptionalString(timestamp);
  if (!normalized) {
    return new Date().toISOString();
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new DecisionAttestationError(
      'INVALID_ATTESTATION_TIMESTAMP',
      400,
      'timestamp must be a valid ISO-8601 string.',
    );
  }

  return parsed.toISOString();
}

function resolveVerifierOrgId(meta: Record<string, unknown>): string | null {
  return normalizeOptionalString(meta.verifierOrgId)
    ?? normalizeOptionalString(meta.organizationId)
    ?? normalizeOptionalString(meta.employerId);
}

type DecisionAttestationCapsuleRow = {
  id: string;
  subjectDid: string;
  subjectNpi: string;
  decisionType: string;
  decisionTimestamp: Date;
  status: string;
  methodology: string;
  artifactHash: string;
  metadata: unknown;
};

function buildDecisionAttestationSnapshot(
  capsule: DecisionAttestationCapsuleRow,
  options: { enforceAttestable?: boolean } = {},
): DecisionAttestationSnapshot {
  const meta = typeof capsule.metadata === 'object' && capsule.metadata !== null && !Array.isArray(capsule.metadata)
    ? capsule.metadata as Record<string, unknown>
    : {};
  const triggerEvent = normalizeOptionalString(meta.triggerEvent);
  const sourceReferenceId = normalizeOptionalString(meta.sourceReferenceId);

  if (options.enforceAttestable !== false && capsule.status === 'INVALID') {
    throw new DecisionAttestationError(
      'ACTION_NOT_ATTESTABLE',
      409,
      'Cannot attest an invalid decision capsule.',
    );
  }

  if (options.enforceAttestable !== false && (!triggerEvent || !sourceReferenceId)) {
    throw new DecisionAttestationError(
      'ACTION_NOT_ATTESTABLE',
      409,
      'Cannot attest a decision before its source action has been recorded.',
    );
  }

  return {
    artifactHash: capsule.artifactHash,
    capsuleId: capsule.id,
    decisionAction: normalizeOptionalString(meta.decisionAction),
    decisionTimestamp: capsule.decisionTimestamp.toISOString(),
    decisionType: capsule.decisionType,
    methodologyVersion: normalizeOptionalString(meta.methodologyVersion) ?? capsule.methodology,
    sourceReferenceId: sourceReferenceId ?? 'unknown',
    status: capsule.status,
    subjectDid: capsule.subjectDid,
    subjectNpi: capsule.subjectNpi,
    triggerEvent: triggerEvent ?? 'unknown',
    verifierOrgId: resolveVerifierOrgId(meta),
  };
}

function buildAttestationDedupeKey(input: {
  attesterId: string | null;
  attesterRole: string | null;
  statement: string | null;
  snapshot: DecisionAttestationSnapshot;
}): string {
  return safeHashJson({
    capsuleId: input.snapshot.capsuleId,
    label: 'decision_attestation_dedupe',
    value: {
    attesterId: input.attesterId,
    attesterRole: input.attesterRole,
    statement: input.statement,
    capsuleId: input.snapshot.capsuleId,
    sourceReferenceId: input.snapshot.sourceReferenceId,
    triggerEvent: input.snapshot.triggerEvent,
    artifactHash: input.snapshot.artifactHash,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredAttestation(
  value: unknown,
  fallbackSnapshot: DecisionAttestationSnapshot,
): DecisionAttestationRecord | null {
  if (!isRecord(value)) return null;

  const rawSnapshot = isRecord(value.snapshot) ? value.snapshot : {};
  const snapshot = {
    artifactHash: normalizeOptionalString(rawSnapshot.artifactHash) ?? fallbackSnapshot.artifactHash,
    capsuleId: normalizeOptionalString(rawSnapshot.capsuleId) ?? fallbackSnapshot.capsuleId,
    decisionAction: normalizeOptionalString(rawSnapshot.decisionAction) ?? fallbackSnapshot.decisionAction,
    decisionTimestamp: normalizeOptionalString(rawSnapshot.decisionTimestamp) ?? fallbackSnapshot.decisionTimestamp,
    decisionType: normalizeOptionalString(rawSnapshot.decisionType) ?? fallbackSnapshot.decisionType,
    methodologyVersion: normalizeOptionalString(rawSnapshot.methodologyVersion) ?? fallbackSnapshot.methodologyVersion,
    sourceReferenceId: normalizeOptionalString(rawSnapshot.sourceReferenceId) ?? fallbackSnapshot.sourceReferenceId,
    status: normalizeOptionalString(rawSnapshot.status) ?? fallbackSnapshot.status,
    subjectDid: normalizeOptionalString(rawSnapshot.subjectDid) ?? fallbackSnapshot.subjectDid,
    subjectNpi: normalizeOptionalString(rawSnapshot.subjectNpi) ?? fallbackSnapshot.subjectNpi,
    triggerEvent: normalizeOptionalString(rawSnapshot.triggerEvent) ?? fallbackSnapshot.triggerEvent,
    verifierOrgId: normalizeOptionalString(rawSnapshot.verifierOrgId) ?? fallbackSnapshot.verifierOrgId,
  };

  return {
    attesterId: normalizeOptionalString(value.attesterId),
    attesterRole: normalizeOptionalString(value.attesterRole),
    statement: normalizeOptionalString(value.statement),
    timestamp: normalizeOptionalString(value.timestamp),
    hash: normalizeOptionalString(value.hash),
    snapshot,
    verification: verifyDecisionAttestation({
      attesterId: normalizeOptionalString(value.attesterId),
      attesterRole: normalizeOptionalString(value.attesterRole),
      statement: normalizeOptionalString(value.statement),
      timestamp: normalizeOptionalString(value.timestamp),
      hash: normalizeOptionalString(value.hash),
      snapshot,
    }),
  };
}

export function extractDecisionAttestations(input: {
  metadata: unknown;
  fallbackSnapshot: DecisionAttestationSnapshot;
}): DecisionAttestationRecord[] {
  const meta = isRecord(input.metadata) ? input.metadata : {};
  const attestations = Array.isArray(meta.attestations) ? meta.attestations : [];

  return attestations
    .map((entry) => parseStoredAttestation(entry, input.fallbackSnapshot))
    .filter((entry): entry is DecisionAttestationRecord => Boolean(entry));
}

export function extractCapsuleDecisionAttestations(capsule: DecisionAttestationCapsuleRow): DecisionAttestationRecord[] {
  return extractDecisionAttestations({
    metadata: capsule.metadata,
    fallbackSnapshot: buildDecisionAttestationSnapshot(capsule, { enforceAttestable: false }),
  });
}

function buildAttestationHashPayload(input: {
  attesterId: string | null;
  attesterRole: string | null;
  statement: string | null;
  timestamp: string | null;
  snapshot: DecisionAttestationSnapshot;
}): Record<string, unknown> {
  if (!input.attesterId || !input.attesterRole || !input.statement || !input.timestamp) {
    throw new DecisionAttestationError(
      'INVALID_ATTESTATION_PAYLOAD',
      400,
      'Decision attestation payload is incomplete.',
    );
  }

  if (
    !input.snapshot.capsuleId
    || !input.snapshot.sourceReferenceId
    || !input.snapshot.triggerEvent
    || !input.snapshot.artifactHash
    || !input.snapshot.subjectDid
    || !input.snapshot.subjectNpi
    || !input.snapshot.decisionType
    || !input.snapshot.decisionTimestamp
    || !input.snapshot.methodologyVersion
    || !input.snapshot.status
  ) {
    throw new DecisionAttestationError(
      'INVALID_ATTESTATION_PAYLOAD',
      400,
      'Decision attestation snapshot is incomplete.',
    );
  }

  return {
    attesterId: input.attesterId,
    attesterRole: input.attesterRole,
    statement: input.statement,
    timestamp: input.timestamp,
    snapshot: {
      artifactHash: input.snapshot.artifactHash,
      capsuleId: input.snapshot.capsuleId,
      decisionAction: input.snapshot.decisionAction,
      decisionTimestamp: input.snapshot.decisionTimestamp,
      decisionType: input.snapshot.decisionType,
      methodologyVersion: input.snapshot.methodologyVersion,
      sourceReferenceId: input.snapshot.sourceReferenceId,
      status: input.snapshot.status,
      subjectDid: input.snapshot.subjectDid,
      subjectNpi: input.snapshot.subjectNpi,
      triggerEvent: input.snapshot.triggerEvent,
      verifierOrgId: input.snapshot.verifierOrgId,
    },
  };
}

function hashDecisionAttestationPayload(input: {
  capsuleId: string;
  attesterId: string | null;
  attesterRole: string | null;
  statement: string | null;
  timestamp: string | null;
  snapshot: DecisionAttestationSnapshot;
}): string {
  const payload = buildAttestationHashPayload(input);
  return safeHashJson({
    capsuleId: input.capsuleId,
    label: 'decision_attestation_hash',
    value: payload,
  });
}

export function verifyDecisionAttestation(input: {
  attesterId: string | null;
  attesterRole: string | null;
  statement: string | null;
  timestamp: string | null;
  hash: string | null;
  snapshot: DecisionAttestationSnapshot;
}): {
  storedHash: string | null;
  computedHash: string | null;
  hashMatch: boolean;
  tamperEvidence: string | null;
} {
  try {
    const computedHash = hashDecisionAttestationPayload({
      capsuleId: input.snapshot.capsuleId,
      attesterId: input.attesterId,
      attesterRole: input.attesterRole,
      statement: input.statement,
      timestamp: input.timestamp,
      snapshot: input.snapshot,
    });
    const storedHash = input.hash;

    return {
      storedHash,
      computedHash,
      hashMatch: Boolean(storedHash) && storedHash === computedHash,
      tamperEvidence: !storedHash
        ? 'Stored attestation hash is missing.'
        : storedHash !== computedHash
          ? 'Attestation payload no longer matches its stored hash.'
          : null,
    };
  } catch (error) {
    return {
      storedHash: input.hash,
      computedHash: null,
      hashMatch: false,
      tamperEvidence: error instanceof Error ? error.message : 'Attestation payload could not be verified.',
    };
  }
}

/** Strip PII fields from rawPayload — keep issuer/dates/status/license numbers */
function sanitize(payload: Record<string, unknown>): Record<string, unknown> {
  const STRIP = new Set(['ssn', 'dob', 'date_of_birth', 'social_security', 'address', 'street', 'phone', 'email', 'fax']);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (STRIP.has(k.toLowerCase())) continue;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      result[k] = sanitize(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// ── Core replay function ──────────────────────────────────────────────────────

export async function replayDecision(capsuleId: string): Promise<DecisionReplay> {
  const capsule = await capsuleEngine.getCapsuleById(capsuleId);
  if (!capsule) throw new Error(`Capsule not found: ${capsuleId}`);

  const meta = (capsule.metadata ?? {}) as Record<string, unknown>;
  const replayedAt = new Date().toISOString();
  const attestationSnapshot = buildDecisionAttestationSnapshot({
    id: capsule.id,
    subjectDid: capsule.subjectDid,
    subjectNpi: capsule.subjectNpi,
    decisionType: capsule.decisionType,
    decisionTimestamp: new Date(capsule.decisionTimestamp),
    status: capsule.status,
    methodology: capsule.methodology,
    artifactHash: capsule.artifactHash,
    metadata: capsule.metadata,
  }, { enforceAttestable: false });
  const attestations = extractDecisionAttestations({
    metadata: capsule.metadata,
    fallbackSnapshot: attestationSnapshot,
  });

  // ── Evidence reconstruction ────────────────────────────────────────────────
  const artifacts = capsule.credentialIds.length > 0
    ? await prisma.verificationArtifact.findMany({
        where: { id: { in: capsule.credentialIds } },
        select: {
          id: true, npi: true, source: true, status: true,
          rawPayload: true, verifiedAt: true, expiresAt: true, createdAt: true,
        },
      })
    : [];

  // Also load any artifacts for this NPI that were active at decision time
  const decisionTime = new Date(capsule.decisionTimestamp);
  const contextArtifacts = await prisma.verificationArtifact.findMany({
    where: {
      npi: capsule.subjectNpi,
      source: { not: 'TRUST_STATE_ENGINE' },
      createdAt: { lte: decisionTime },
    },
    select: {
      id: true, source: true, status: true,
      rawPayload: true, verifiedAt: true, expiresAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Deduplicate: prefer credentialIds artifacts, fill with context
  const evidenceMap = new Map<string, typeof contextArtifacts[number]>();
  for (const a of contextArtifacts) evidenceMap.set(a.id, a);
  for (const a of artifacts)        evidenceMap.set(a.id, a);     // credentialIds win

  const evidenceRecords: EvidenceRecord[] = Array.from(evidenceMap.values()).map(a => ({
    artifactId:       a.id,
    source:           a.source,
    sourceLabel:      sourceLabel(a.source),
    status:           a.status,
    verifiedAt:       a.verifiedAt?.toISOString() ?? null,
    expiresAt:        a.expiresAt?.toISOString() ?? null,
    credentialType:   credentialType(a.source),
    jurisdiction:     extractJurisdiction(a.rawPayload),
    sanitizedPayload: sanitize((a.rawPayload ?? {}) as Record<string, unknown>),
  }));

  // Sources consulted — deduplicated by source, most recent status wins
  const sourceMap = new Map<string, SourceConsulted>();
  for (const a of evidenceMap.values()) {
    const existing = sourceMap.get(a.source);
    if (!existing || (a.verifiedAt && (!existing.consultedAt || a.verifiedAt > new Date(existing.consultedAt)))) {
      sourceMap.set(a.source, {
        source:      a.source,
        label:       sourceLabel(a.source),
        consultedAt: a.verifiedAt?.toISOString() ?? a.createdAt.toISOString(),
        outcome:     sourceOutcome(a.status),
        confidence:  sourceConfidence(a.source, a.status),
      });
    }
  }
  const sourcesConsulted = Array.from(sourceMap.values())
    .sort((a, b) => a.label.localeCompare(b.label));

  // Trust state at decision time
  const trustArtifact = await prisma.verificationArtifact.findFirst({
    where: {
      npi: capsule.subjectNpi,
      source: 'TRUST_STATE_ENGINE',
      createdAt: { lte: decisionTime },
    },
    orderBy: { createdAt: 'desc' },
    select: { rawPayload: true, createdAt: true },
  });
  const trustPayload = (trustArtifact?.rawPayload ?? {}) as Record<string, unknown>;
  const trustState: TrustStateSnapshot = {
    trustBand:       String(trustPayload.readiness_level ?? trustPayload.trustBand ?? meta.trustBand ?? 'UNKNOWN'),
    trustScore:      Number(trustPayload.readiness_score ?? trustPayload.trustScore ?? meta.readinessScore ?? 0),
    readinessStatus: String(trustPayload.readiness_status ?? 'UNKNOWN'),
    capturedAt:      trustArtifact?.createdAt.toISOString() ?? null,
    methodology:     String(trustPayload.methodology_version ?? 'trust_state.v1'),
  };

  // Anomalies from metadata
  const anomalies: string[] = [];
  if (Array.isArray(meta.anomalies)) anomalies.push(...(meta.anomalies as string[]));
  if (typeof meta.gaps === 'string') anomalies.push(meta.gaps);
  if (Array.isArray(meta.gaps))      anomalies.push(...(meta.gaps as string[]));

  // ── Integrity check ────────────────────────────────────────────────────────
  const replayResult = await capsuleEngine.verifyDecisionCapsuleReplay(capsuleId);
  const integrity: IntegrityCheck = {
    storedHash:        capsule.artifactHash,
    recomputedHash:    replayResult.actualArtifactHash,
    hashMatch:         replayResult.valid,
    methodology:       capsule.methodology,
    methodologyVersion: capsule.methodologyVersion ?? 'decision_capsule.v262',
    verifiedAt:        replayedAt,
    tamperEvidence: replayResult.valid
      ? null
      : replayResult.actualArtifactHash !== capsule.artifactHash
        ? `Hash mismatch — stored: ${capsule.artifactHash.slice(0, 16)}… computed: ${replayResult.actualArtifactHash.slice(0, 16)}…`
        : replayResult.expectedEvidenceSpineDigest !== replayResult.actualEvidenceSpineDigest
          ? 'Evidence spine digest mismatch — referenced verification artifacts or receipts no longer replay to the stored trust-critical spine.'
          : 'Decision capsule replay validation failed.',
  };

  // ── Verifier identity ──────────────────────────────────────────────────────
  const verifierIdentity: VerifierIdentity = {
    type: capsule.verifierOrgId ? 'ORGANIZATION'
      : (meta.confirmedBy ? 'HUMAN' : 'SYSTEM'),
    systemId:    'vitalcv-engine-v1',
    orgId:       capsule.verifierOrgId,
    userId:      typeof meta.clerkUserId === 'string' ? meta.clerkUserId : null,
    confirmedBy: typeof meta.confirmedBy === 'string' ? meta.confirmedBy : null,
    timestamp:   capsule.decisionTimestamp,
  };

  // ── Authority chain ────────────────────────────────────────────────────────
  const chain: AuthorityChainLink[] = [];
  let pos = 0;

  // 1. Clinician (subject)
  chain.push({
    position: pos++,
    nodeType: 'CLINICIAN',
    id:       capsule.subjectNpi,
    label:    `NPI ${capsule.subjectNpi}`,
    source:   'NPI_REGISTRY',
    status:   'ACTIVE',
    linkedAt: null,
    edgeType: 'HOLDS',
  });

  // 2. Credentials held
  const uniqueSources = Array.from(new Set(evidenceRecords.map(e => e.source)));
  for (const src of uniqueSources.slice(0, 6)) {
    const record = evidenceRecords.find(e => e.source === src);
    chain.push({
      position: pos++,
      nodeType:  'CREDENTIAL',
      id:        record?.artifactId ?? src,
      label:     sourceLabel(src),
      source:    src,
      status:    record?.status ?? 'UNKNOWN',
      linkedAt:  record?.verifiedAt ?? null,
      edgeType:  'HOLDS',
    });
  }

  // 3. Issuers
  for (const issuerId of capsule.issuerIds.slice(0, 3)) {
    chain.push({
      position: pos++,
      nodeType: 'ISSUER',
      id:       issuerId,
      label:    issuerId,
      source:   'TRUST_REGISTRY',
      status:   'ACTIVE',
      linkedAt: capsule.decisionTimestamp,
      edgeType: 'ISSUED_BY',
    });
  }
  if (capsule.issuerIds.length === 0) {
    // Derive issuers from source types
    const inferredIssuers = uniqueSources.filter(s => !['TRUST_STATE_ENGINE'].includes(s));
    for (const src of inferredIssuers.slice(0, 3)) {
      chain.push({
        position: pos++,
        nodeType: 'ISSUER',
        id:       src,
        label:    sourceLabel(src),
        source:   src,
        status:   sourceMap.get(src)?.outcome === 'VERIFIED' ? 'ACTIVE' : 'CONSULTED',
        linkedAt: sourceMap.get(src)?.consultedAt ?? null,
        edgeType: 'ISSUED_BY',
      });
    }
  }

  // 4. Verifier
  chain.push({
    position: pos++,
    nodeType: 'VERIFIER',
    id:       capsule.verifierOrgId ?? 'vitalcv-system',
    label:    typeof meta.facilityName === 'string' ? meta.facilityName
      : (capsule.verifierOrgId ?? 'VitalCV Automated Verification'),
    source:   'VITALCV',
    status:   'ACTIVE',
    linkedAt: capsule.decisionTimestamp,
    edgeType: 'VERIFIED_BY',
  });

  // 5. Decision (capsule itself)
  chain.push({
    position: pos++,
    nodeType: 'DECISION',
    id:       capsule.id,
    label:    `${capsule.decisionType} — ${capsule.decisionAction ?? 'RECORDED'} — ${capsule.status}`,
    source:   'DECISION_CAPSULE',
    status:   capsule.status,
    linkedAt: capsule.decisionTimestamp,
    edgeType: 'PRODUCED',
  });

  // ── Related decisions (timeline) ──────────────────────────────────────────
  const related = await prisma.decisionCapsule.findMany({
    where: {
      subjectNpi: capsule.subjectNpi,
      id:         { not: capsuleId },
    },
    select: {
      id: true, decisionType: true, decisionTimestamp: true, status: true, metadata: true,
    },
    orderBy: { decisionTimestamp: 'desc' },
    take: 10,
  });
  const relatedDecisions = related.map(r => {
    const rm = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      capsuleId:         r.id,
      decisionType:      r.decisionType,
      decisionTimestamp: r.decisionTimestamp.toISOString(),
      status:            r.status,
      action:            typeof rm.decisionAction === 'string' ? rm.decisionAction : null,
    };
  });

  return {
    schema:        'https://vitalcv.com/replay/v1',
    replayVersion: '1.0',
    capsuleId,
    subjectNpi:    capsule.subjectNpi,
    subjectDid:    capsule.subjectDid,
    decisionType:  capsule.decisionType,
    decisionTimestamp: capsule.decisionTimestamp,
    status:        capsule.status,

    decision: {
      action:            capsule.decisionAction,
      outcome:           capsule.status,
      triggerEvent:      capsule.triggerEvent,
      sourceReferenceId: capsule.sourceReferenceId,
      organizationId:    capsule.verifierOrgId,
      notes:             typeof meta.notes === 'string' ? meta.notes : null,
      deploymentContext: typeof meta.deploymentId === 'string' ? {
        deploymentId:   meta.deploymentId,
        facilityName:   meta.facilityName ?? null,
        deploymentType: meta.deploymentType ?? null,
        matchScore:     meta.matchScore ?? null,
      } : null,
    },

    attestations,
    verifierIdentity,
    evidenceSnapshot: {
      credentialIds:        capsule.credentialIds,
      evidenceRecords,
      sourcesConsulted,
      trustStateAtDecision: trustState,
      anomaliesDetected:    anomalies,
    },

    integrity,
    authorityChain:   chain,
    relatedDecisions,
    replayedAt,
  };
}

// ── Audit bundle export ───────────────────────────────────────────────────────

export async function buildAuditBundle(
  npi: string,
  options: { types?: string[]; maxCapsules?: number } = {},
): Promise<AuditBundle> {
  const { createHash: ch } = await import('crypto');

  const capsules = await prisma.decisionCapsule.findMany({
    where: {
      subjectNpi: npi,
      ...(options.types?.length ? { decisionType: { in: options.types } } : {}),
    },
    orderBy: { decisionTimestamp: 'desc' },
    take: options.maxCapsules ?? 50,
    select: { id: true },
  });

  const replays: DecisionReplay[] = [];
  for (const { id } of capsules) {
    try {
      replays.push(await replayDecision(id));
    } catch (err) {
      log('error', 'replayEngine: buildAuditBundle capsule failed', { id, error: String(err) });
    }
  }

  const exportedAt = new Date().toISOString();
  const bundleId   = crypto.randomUUID();

  // Compute bundle hash over all replay data (excluding bundleHash itself)
  const bundleContent = JSON.stringify({ bundleId, exportedAt, replays });
  const bundleHash = ch('sha256').update(bundleContent, 'utf8').digest('hex');

  // Get the first capsule's DID (or derive from NPI)
  const subjectDid = replays[0]?.subjectDid ?? `did:vitalcv:${npi}`;

  return {
    schema:         'https://vitalcv.com/audit-bundle/v1',
    bundleVersion:  '1.0',
    bundleId,
    bundleHash,
    exportedAt,
    subject:        { npi, did: subjectDid },
    capsuleCount:   replays.length,
    issuer:         'VitalCV',
    methodology:    'decision_capsule.v262',
    replays,
    verificationInstructions: {
      hashAlgorithm: 'SHA-256',
      how:           'For each replay, verify integrity.hashMatch === true. Bundle hash computed as SHA-256(JSON.stringify({ bundleId, exportedAt, replays })).',
      replayEndpoint: 'GET https://api.vitalcv.com/api/decisions/{capsuleId}/replay',
      verifyEndpoint: 'GET https://api.vitalcv.com/api/decisions/{capsuleId}/verify',
    },
    custodyLog: [
      { event: 'BUNDLE_CREATED', timestamp: exportedAt, actor: 'VitalCV/replayEngine@v1' },
      { event: 'HASH_COMPUTED',  timestamp: exportedAt, actor: 'VitalCV/replayEngine@v1' },
    ],
  };
}

// ── Attestation ───────────────────────────────────────────────────────────────

export async function addAttestation(
  capsuleId: string,
  attestation: {
    attesterId: string;
    attesterRole: string;
    statement: string;
    timestamp?: string;
  },
): Promise<{ capsuleId: string; attestationCount: number; attestedAt: string; created: boolean }> {
  const capsule = await prisma.decisionCapsule.findUnique({
    where: { id: capsuleId },
    select: {
      id: true,
      subjectDid: true,
      subjectNpi: true,
      decisionType: true,
      decisionTimestamp: true,
      status: true,
      methodology: true,
      artifactHash: true,
      metadata: true,
    },
  });
  if (!capsule) throw new Error(`Capsule not found: ${capsuleId}`);

  const meta = typeof capsule.metadata === 'object' && capsule.metadata !== null && !Array.isArray(capsule.metadata)
    ? capsule.metadata as Record<string, unknown>
    : {};
  const existingRaw = Array.isArray(meta.attestations) ? meta.attestations as unknown[] : [];
  const attestedAt = resolveAttestationTimestamp(attestation.timestamp);
  const snapshot = buildDecisionAttestationSnapshot(capsule);
  const existing = extractDecisionAttestations({
    metadata: meta,
    fallbackSnapshot: snapshot,
  });
  const attesterId = normalizeOptionalString(attestation.attesterId);
  const attesterRole = normalizeOptionalString(attestation.attesterRole);
  const statement = normalizeOptionalString(attestation.statement);
  const dedupeKey = buildAttestationDedupeKey({
    attesterId,
    attesterRole,
    statement,
    snapshot,
  });
  const duplicate = existing.find((entry) => (
    buildAttestationDedupeKey({
      attesterId: entry.attesterId,
      attesterRole: entry.attesterRole,
      statement: entry.statement,
      snapshot: entry.snapshot,
    }) === dedupeKey
  ));

  if (duplicate) {
    return {
      capsuleId,
      attestationCount: existing.length,
      attestedAt: duplicate.timestamp ?? attestedAt,
      created: false,
    };
  }

  const newAttestationInput = {
    attesterId,
    attesterRole,
    statement,
    timestamp:    attestedAt,
    snapshot,
  };
  const attestationHash = hashDecisionAttestationPayload({
    capsuleId,
    attesterId,
    attesterRole,
    statement,
    timestamp: attestedAt,
    snapshot,
  });
  const newAttestation = toBoundedJsonRecord({
    capsuleId,
    value: {
      ...newAttestationInput,
      dedupeKey,
      hash: attestationHash,
    },
    byteLimit: MAX_DECISION_ATTESTATION_BYTES,
    label: 'decision_attestation',
  });

  const updated = toBoundedJsonRecord({
    capsuleId,
    value: {
      ...meta,
      attestations: [...existingRaw, newAttestation],
    },
    byteLimit: MAX_DECISION_ATTESTATION_METADATA_BYTES,
    label: 'decision_attestation_metadata',
  });

  await prisma.decisionCapsule.update({
    where: { id: capsuleId },
    data: { metadata: updated as Prisma.InputJsonValue },
  });

  return {
    capsuleId,
    attestationCount: existing.length + 1,
    attestedAt,
    created: true,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJurisdiction(payload: unknown): string | null {
  if (typeof payload !== 'object' || !payload) return null;
  const p = payload as Record<string, unknown>;
  return typeof p.state === 'string' ? p.state.toUpperCase()
    : typeof p.licenseState === 'string' ? p.licenseState.toUpperCase()
    : typeof p.stateCode === 'string' ? p.stateCode.toUpperCase()
    : null;
}

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
import prisma from '../../graphql/prisma_client';
import { capsuleEngine } from '../decision/capsuleEngine';
import { log } from '../../obs/logger';
import {
  buildRuntimeReplayMetadata,
  type RuntimeReplayMetadata,
} from '../runtimeTrustCohesion';
import {
  assertTenantScope,
  scopeRelatedDecisions,
  normalizeTenantId,
  type TenantId,
  type TenantScope,
} from '../multi-tenant/tenantIsolation';
import {
  computeContainmentBoundary,
  evaluateContainment,
  quarantineReplay,
  traceCorruptionLineage,
  type ContainmentBoundary,
  type CorruptionLineage,
  type IntegritySignal,
  type ReplayQuarantineRecord,
} from './replayCorruptionContainment';
import {
  syncReplayConfidence,
  type CalibratedConfidenceScore,
} from './confidenceCalibration';

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

  replayMetadata: RuntimeReplayMetadata;
  tenantScope: TenantScope;
  /** W2-PR64A — per-replay corruption containment record (always present). */
  containment: ReplayQuarantineRecord;
  /**
   * W2-PR130A — evidence-derived confidence calibration record.
   *
   * Production confidence is derived strictly from replay evidence. The
   * `score.point` value is the calibrated estimate; `evidenceCeiling` is the
   * hard maximum this replay's evidence can support. Any external claim that
   * exceeds `evidenceCeiling` is flagged in `overconfidence`.
   */
  confidenceCalibration: CalibratedConfidenceScore;
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

  /**
   * W2-PR64A — bundle-wide replay corruption containment report.
   *
   * `boundary` aggregates the verdicts of every replay in the bundle plus a
   * synthetic CONTAINMENT_BREACH entry per failed replay. `lineages` tracks
   * the contamination edges from each quarantined root through the bundle's
   * surviving replays.
   */
  containment: {
    schema: 'vitalcv.replay-containment-report.v1';
    boundary: ContainmentBoundary;
    quarantines: ReplayQuarantineRecord[];
    lineages: CorruptionLineage[];
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRuntimeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function runtimeSeedFromMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(meta.runtimeTrust)) {
    return meta.runtimeTrust;
  }

  if (isRecord(meta.employerReviewAction)) {
    if (isRecord(meta.employerReviewAction.runtimeTrust)) {
      return meta.employerReviewAction.runtimeTrust;
    }
    return meta.employerReviewAction;
  }

  return meta;
}

// ── Core replay function ──────────────────────────────────────────────────────

export async function replayDecision(
  capsuleId: string,
  options: { requesterTenantId?: TenantId | null } = {},
): Promise<DecisionReplay> {
  const capsule = await capsuleEngine.getCapsuleById(capsuleId);
  if (!capsule) throw new Error(`Capsule not found: ${capsuleId}`);

  const capsuleTenantId = normalizeTenantId(capsule.verifierOrgId);
  const requesterTenantId = normalizeTenantId(options.requesterTenantId ?? null);
  // Fail-closed: throws TenantIsolationError on cross-tenant or ambiguous reads.
  const tenantScope = assertTenantScope({
    capsuleId,
    capsuleTenantId,
    requesterTenantId,
  });

  const meta = (capsule.metadata ?? {}) as Record<string, unknown>;
  const replayedAt = new Date().toISOString();
  const runtimeSeed = runtimeSeedFromMetadata(meta);
  const replayMetadata = buildRuntimeReplayMetadata({
    capsuleId,
    correlationId: readRuntimeString(runtimeSeed.correlationId),
    payloadHash: readRuntimeString(runtimeSeed.payloadHash),
    mutationFingerprint: readRuntimeString(runtimeSeed.mutationFingerprint),
    // W2-PR36A: bind replay fingerprint to capsule's tenant so two tenants
    // replaying the same capsuleId (e.g. via a regression in capsule id
    // collision) cannot produce identical fingerprints.
    tenantId: capsuleTenantId,
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

  // ── Containment classification (W2-PR64A) ──────────────────────────────────
  // Pure transform — never throws, always produces a record. CLEAN replays
  // get a zero-corruption record so downstream code can rely on the field.
  const integritySignal: IntegritySignal = {
    hashMatch:               integrity.hashMatch,
    storedHash:              integrity.storedHash,
    recomputedHash:          integrity.recomputedHash,
    tamperEvidence:          integrity.tamperEvidence,
    evidenceSpineExpected:   replayResult.expectedEvidenceSpineDigest ?? null,
    evidenceSpineActual:     replayResult.actualEvidenceSpineDigest ?? null,
  };
  const containment = quarantineReplay({
    capsuleId,
    integrity: integritySignal,
    lineageHints: {
      subjectNpi:        capsule.subjectNpi,
      credentialIds:     capsule.credentialIds,
      sourceReferenceId: capsule.sourceReferenceId,
    },
  });

  // ── Confidence calibration (W2-PR130A) ────────────────────────────────────
  // Derived after containment so the containment verdict can gate the ceiling.
  const confidenceCalibration = syncReplayConfidence({
    capsuleId:           capsuleId,
    sourcesConsulted:    sourcesConsulted.map(s => ({
      source:     s.source,
      outcome:    s.outcome,
      confidence: s.confidence,
    })),
    trustScore:          trustState.trustScore,
    integrityHashMatch:  integrity.hashMatch,
    tamperEvidence:      integrity.tamperEvidence,
    evidenceSpineDrifted: replayResult.expectedEvidenceSpineDigest !== replayResult.actualEvidenceSpineDigest
      && replayResult.expectedEvidenceSpineDigest !== undefined
      && replayResult.actualEvidenceSpineDigest   !== undefined,
    containmentVerdict:  containment.verdict,
    ambiguous:           containment.ambiguous,
  });

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
  // Tenant-scoped at the query layer AND post-filtered for defense-in-depth.
  // Previously this returned every decision for the NPI across all tenants —
  // a cross-tenant governance bleedover. See multi-tenant/tenantIsolation.ts.
  // Prisma column is `organizationId`; capsuleEngine surfaces it as
  // `verifierOrgId` on the engine type. Both names refer to the same tenant id.
  const relatedRaw = await prisma.decisionCapsule.findMany({
    where: {
      subjectNpi:     capsule.subjectNpi,
      id:             { not: capsuleId },
      organizationId: capsuleTenantId,
    },
    select: {
      id: true, decisionType: true, decisionTimestamp: true, status: true, metadata: true,
      organizationId: true,
    },
    orderBy: { decisionTimestamp: 'desc' },
    take: 10,
  });
  // Annotated `r` so the .map predicate has an explicit type even
  // when Prisma's findMany result type collapses under unrelated
  // pre-existing type-resolution breakage on `origin/main` (Prisma
  // namespace exports). This preserves the call-site behaviour
  // exactly — the annotation matches the `select` projection above.
  interface RelatedRawRow {
    id: string;
    decisionType: string;
    decisionTimestamp: Date;
    status: string;
    metadata: unknown;
    organizationId: string | null;
  }
  const related = scopeRelatedDecisions(
    (relatedRaw as ReadonlyArray<RelatedRawRow>).map(
      (r: RelatedRawRow) => ({ ...r, verifierOrgId: r.organizationId }),
    ),
    capsuleTenantId,
  );
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
    replayMetadata,
    tenantScope,
    containment,
    confidenceCalibration,
    replayedAt,
  };
}

// ── Audit bundle export ───────────────────────────────────────────────────────

export async function buildAuditBundle(
  npi: string,
  options: {
    types?: string[];
    maxCapsules?: number;
    requesterTenantId?: TenantId | null;
  } = {},
): Promise<AuditBundle> {
  const { createHash: ch } = await import('crypto');

  const requesterTenantId = normalizeTenantId(options.requesterTenantId ?? null);

  const capsules = await prisma.decisionCapsule.findMany({
    where: {
      subjectNpi: npi,
      ...(options.types?.length ? { decisionType: { in: options.types } } : {}),
      // Tenant-scoped at the query layer when a requester tenant is provided.
      // Prisma column is `organizationId` (same value as the engine's verifierOrgId).
      ...(requesterTenantId ? { organizationId: requesterTenantId } : {}),
    },
    orderBy: { decisionTimestamp: 'desc' },
    take: options.maxCapsules ?? 50,
    select: { id: true },
  });

  const replays: DecisionReplay[] = [];
  const failures: Array<{ capsuleId: string; error: string; failedAt: string }> = [];
  // W2-PR64A: every replay outcome — including failures — produces a quarantine
  // record so the bundle's containment boundary covers the full surface, not
  // only the survivors.
  const quarantines: ReplayQuarantineRecord[] = [];
  for (const { id } of capsules) {
    try {
      // Defense-in-depth: each replay re-asserts tenant scope, so a query-
      // layer regression cannot leak a cross-tenant capsule into the bundle.
      const replay = await replayDecision(id, { requesterTenantId });
      replays.push(replay);
      quarantines.push(replay.containment);
    } catch (err) {
      const failedAt = new Date().toISOString();
      const error = String(err);
      failures.push({ capsuleId: id, error, failedAt });
      log('error', 'replayEngine: buildAuditBundle capsule failed', { id, error });
      // Synthesize a STRUCTURAL_CORRUPTION quarantine so the failed replay
      // counts toward partial survivability (it surfaced as an actionable
      // record) rather than vanishing from the boundary entirely. No stored
      // hash is available, so both hashes use the empty-digest sentinel.
      quarantines.push(evaluateContainment({
        capsuleId: id,
        integrity: {
          hashMatch: false,
          storedHash: '',
          recomputedHash: '',
          tamperEvidence: error,
        },
        forcedKind: 'STRUCTURAL_CORRUPTION',
        forcedReason: `Replay raised before containment classification could complete: ${error.slice(0, 160)}`,
      }));
    }
  }

  const exportedAt = new Date().toISOString();
  const bundleId   = crypto.randomUUID();

  // Compute bundle hash over all replay data (excluding bundleHash itself)
  const bundleContent = JSON.stringify({ bundleId, exportedAt, replays });
  const bundleHash = ch('sha256').update(bundleContent, 'utf8').digest('hex');

  // ── Containment boundary + lineage (W2-PR64A) ────────────────────────────
  const containmentBoundary = computeContainmentBoundary({
    totalReplayed: capsules.length,
    quarantines,
  });

  // Trace lineage from every quarantined / contaminated / breached root
  // through the surviving replays. Clean replays act as candidate downstream
  // capsules: if they share a lineage hint with a corrupt root, the lineage
  // record exposes the contamination edge.
  const corruptRoots = quarantines.filter(q =>
    q.verdict === 'QUARANTINED' || q.verdict === 'AMBIGUOUS' || q.verdict === 'CONTAINMENT_BREACH',
  );
  const lineageCandidates = replays.map(r => ({
    capsuleId: r.capsuleId,
    hints: r.containment.lineageHints,
  }));
  const lineages: CorruptionLineage[] = corruptRoots.map(root =>
    traceCorruptionLineage({
      rootCapsuleId: root.capsuleId,
      rootHints: root.lineageHints,
      candidates: lineageCandidates,
    }),
  );

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
      // Operator-visible saturation: every replay failure surfaces as its own
      // custody entry so a partial bundle is never indistinguishable from a
      // clean one. Format: REPLAY_FAILED:{capsuleId}:{error-summary}
      ...failures.map(f => ({
        event: `REPLAY_FAILED:${f.capsuleId}:${f.error.slice(0, 120)}`,
        timestamp: f.failedAt,
        actor: 'VitalCV/replayEngine@v1',
      })),
      // W2-PR64A: every non-clean containment verdict surfaces as a custody
      // entry. CLEAN verdicts are not logged — they are the implicit baseline.
      // Format: CONTAINMENT_{VERDICT}:{capsuleId}:{kind}
      ...quarantines
        .filter(q => q.verdict !== 'CLEAN')
        .map(q => ({
          event: `CONTAINMENT_${q.verdict}:${q.capsuleId}:${q.kind ?? 'UNKNOWN'}`,
          timestamp: q.isolatedAt,
          actor: 'VitalCV/replayEngine@v1',
        })),
      { event: `CONTAINMENT_BOUNDARY_${containmentBoundary.partitioned ? 'INTACT' : 'BREACHED'}:${containmentBoundary.partialSurvivabilityPct.toFixed(2)}%`,
        timestamp: exportedAt,
        actor: 'VitalCV/replayEngine@v1' },
      { event: 'HASH_COMPUTED',  timestamp: exportedAt, actor: 'VitalCV/replayEngine@v1' },
    ],

    containment: {
      schema: 'vitalcv.replay-containment-report.v1',
      boundary: containmentBoundary,
      quarantines,
      lineages,
    },
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
): Promise<{ capsuleId: string; attestationCount: number; attestedAt: string }> {
  const capsule = await prisma.decisionCapsule.findUnique({
    where: { id: capsuleId },
    select: { id: true, metadata: true },
  });
  if (!capsule) throw new Error(`Capsule not found: ${capsuleId}`);

  const meta  = (capsule.metadata ?? {}) as Record<string, unknown>;
  const existing = Array.isArray(meta.attestations) ? meta.attestations as unknown[] : [];

  const newAttestation = {
    attesterId:   attestation.attesterId,
    attesterRole: attestation.attesterRole,
    statement:    attestation.statement,
    timestamp:    attestation.timestamp ?? new Date().toISOString(),
    hash:         sha256(JSON.stringify(attestation)),
  };

  const updated = {
    ...meta,
    attestations: [...existing, newAttestation],
  };

  await prisma.decisionCapsule.update({
    where: { id: capsuleId },
    data: { metadata: JSON.parse(JSON.stringify(updated)) },
  });

  return {
    capsuleId,
    attestationCount: updated.attestations.length,
    attestedAt: newAttestation.timestamp,
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

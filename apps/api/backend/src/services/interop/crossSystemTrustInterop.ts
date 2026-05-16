/**
 * crossSystemTrustInterop.ts — W2-PR87A: Cross-System Trust Interoperability
 *
 * Pure transforms enforcing the boundary between VitalCV and *external systems*
 * — enterprise EHRs, employer onboarding suites, state-level credentialing
 * platforms — so trust state can cross system lines without losing integrity,
 * lineage, or ambiguity.
 *
 * Layered above:
 *   tenantIsolation (W2-PR36A)     — single-platform, multi-tenant boundary
 *   federationGovernance (W2-PR54A) — multi-tenant federations of THIS platform
 *   replayCorruptionContainment    — replay integrity within one platform
 *   ──────────────────────────────────────────────────────────────────────
 *   crossSystemTrustInterop (here)  — boundary at the *system* level
 *
 * Hard invariants (fail-closed):
 *   - A trust contract is the only legal channel between two systems. Any
 *     bridge, lineage adapt, or sync that does not name a declared contract
 *     fails closed (UNDECLARED_SYSTEM).
 *   - Contracts are versioned and tamper-evident; two systems with mismatched
 *     contractVersion may NOT bridge replay (CONTRACT_VERSION_DRIFT).
 *   - Replay bridge integrity is verified on both sides — the inbound bridge
 *     recomputes the envelope's integrityDigest and rejects mismatches.
 *   - AMBIGUOUS verdicts MUST survive crossing the boundary in either
 *     direction. An external system may not coerce our AMBIGUOUS to CLEAN,
 *     and we may not emit CLEAN for a record we know is ambiguous.
 *   - External lineage adapters preserve ambiguity at the schema boundary —
 *     if the remote can't supply a stable subject identifier, the adapted
 *     record records `subjectAdapted: false` rather than synthesizing one.
 *   - Trust synchronization across systems is reconstructable: the
 *     reconstructionDigest is order-independent over the input system set,
 *     so divergent sync states can never collide with clean ones.
 *   - Interop blast radius is segmented: a hostile external system can
 *     contaminate its own contract scope but never the local boundary.
 *
 * No fetches, no DB writes, no audit-event writes. This module is the boundary
 * checker that bridges, adapters, and sync workflows call before they emit.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import {
  classifyIntegrity,
  containmentDigest,
  evaluateContainment,
  KNOWN_CONTAINMENT_VERDICTS,
  type ContainmentVerdict,
  type CorruptionKind,
  type IntegritySignal,
  type LineageHints,
  type ReplayQuarantineRecord,
} from '../audit/replayCorruptionContainment';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExternalSystemId = string;

export type InteropViolationKind =
  | 'UNDECLARED_SYSTEM'
  | 'CONTRACT_VERSION_DRIFT'
  | 'CONTRACT_FIELD_DRIFT'
  | 'BRIDGE_INTEGRITY_FAILURE'
  | 'AMBIGUITY_COLLAPSED_INBOUND'
  | 'AMBIGUITY_COLLAPSED_OUTBOUND'
  | 'LINEAGE_ADAPTER_MISMATCH'
  | 'SYNC_DIVERGENCE_FORCED_CONVERGENT'
  | 'SYNC_RECONSTRUCTION_FAILURE'
  | 'INTEROP_BLAST_RADIUS_BREACH';

export class TrustInteropError extends Error {
  readonly code = 'TRUST_INTEROP_VIOLATION' as const;
  readonly violation: InteropViolationKind;
  readonly systemId: ExternalSystemId | null;
  readonly contractId: string | null;
  readonly subjectKey: string | null;

  constructor(args: {
    violation: InteropViolationKind;
    message: string;
    systemId?: ExternalSystemId | null;
    contractId?: string | null;
    subjectKey?: string | null;
  }) {
    super(args.message);
    this.name = 'TrustInteropError';
    this.violation = args.violation;
    this.systemId = args.systemId ?? null;
    this.contractId = args.contractId ?? null;
    this.subjectKey = args.subjectKey ?? null;
  }
}

export type AmbiguityPolicy = 'PRESERVE' | 'REJECT';

/**
 * Declared compatibility profile between this system and a single external
 * counterparty. The contractDigest hashes the full surface so any silent edit
 * to fields/version/policy invalidates downstream digests.
 */
export interface TrustContract {
  schema: 'vitalcv.cross-system-trust-contract.v1';
  contractId: string;
  systemId: ExternalSystemId;
  contractVersion: string;
  /** Field names that may flow IN from the external system. Sorted, deduped. */
  inboundFields: readonly string[];
  /** Field names that may flow OUT to the external system. Sorted, deduped. */
  outboundFields: readonly string[];
  /** Always 'PRESERVE' for VitalCV — kept explicit so a regression to 'REJECT' is auditable. */
  ambiguityPolicy: AmbiguityPolicy;
  /** Always true — interop is fail-closed. Mirrored field so a future override is visible in audits. */
  failClosed: true;
  contractDigest: string;
  declaredAt: string;
}

export type ReplayBridgeDirection = 'INBOUND' | 'OUTBOUND';

export interface ReplayBridgeEnvelope {
  schema: 'vitalcv.replay-bridge-envelope.v1';
  bridgeId: string;
  direction: ReplayBridgeDirection;
  fromSystem: ExternalSystemId;
  toSystem: ExternalSystemId;
  contractId: string;
  contractVersion: string;
  /** Mirrors a ReplayQuarantineRecord at the boundary — no PII, only verdict + digest. */
  replayRecord: {
    capsuleId: string;
    verdict: ContainmentVerdict;
    kind: CorruptionKind | null;
    ambiguous: boolean;
    integrityDigest: string;
    isolatedAt: string;
  };
  bridgeDigest: string;
  bridgedAt: string;
}

export interface ExternalLineageRecord {
  externalCapsuleId: string;
  externalSubjectId: string | null;
  externalSubjectIdScheme: string | null;
  externalCredentialIds: readonly string[];
  externalSourceReferenceId: string | null;
  systemSchemaVersion: string;
}

export interface AdaptedLineage {
  schema: 'vitalcv.external-lineage-adapter.v1';
  systemId: ExternalSystemId;
  contractId: string;
  externalCapsuleId: string;
  lineageHints: LineageHints;
  /** True iff a NPI-shaped subject was extracted. False = ambiguous-by-construction. */
  subjectAdapted: boolean;
  adapterDigest: string;
  adaptedAt: string;
}

export interface SystemTrustSnapshot {
  systemId: ExternalSystemId;
  trustBand: string | null;
  capturedAt: string | null;
  /** Tamper-evident digest from the source — passed through to syncDigest. */
  sourceDigest: string;
}

export type SyncVerdict = 'CONVERGED' | 'DIVERGENT' | 'INSUFFICIENT' | 'AMBIGUOUS';

export interface SyncState {
  schema: 'vitalcv.trust-sync-state.v1';
  syncId: string;
  subjectKey: string;
  verdict: SyncVerdict;
  /** Sorted by systemId for deterministic reconstruction. */
  systems: ReadonlyArray<{
    systemId: ExternalSystemId;
    trustBand: string | null;
    capturedAt: string | null;
    sourceDigest: string;
  }>;
  divergent: boolean;
  divergenceReason: string | null;
  reconstructionDigest: string;
  reconstructedAt: string;
}

export type InteropContainmentTier =
  | 'SINGLE_SYSTEM'
  | 'CROSS_CONTRACT'
  | 'INTEROP_BLAST_RADIUS_BREACH';

export interface InteropBoundary {
  schema: 'vitalcv.interop-boundary.v1';
  totalBridged: number;
  cleanCount: number;
  ambiguousCount: number;
  quarantinedCount: number;
  rejectedCount: number;
  /** clean / total — 1.0 when all bridges round-tripped cleanly. */
  bridgeFidelityRatio: number;
  /** (clean + ambiguous + quarantined) / total * 100 — reconstructable share. */
  partialSurvivabilityPct: number;
  tier: InteropContainmentTier;
  systemsTouched: readonly ExternalSystemId[];
  contractsTouched: readonly string[];
  partitioned: boolean;
  containmentReason: string;
  boundaryDigest: string;
  partitionedAt: string;
}

// ── Sentinels ────────────────────────────────────────────────────────────────

const SCHEMA_CONTRACT       = 'vitalcv.cross-system-trust-contract.v1' as const;
const SCHEMA_BRIDGE         = 'vitalcv.replay-bridge-envelope.v1' as const;
const SCHEMA_LINEAGE        = 'vitalcv.external-lineage-adapter.v1' as const;
const SCHEMA_SYNC           = 'vitalcv.trust-sync-state.v1' as const;
const SCHEMA_BOUNDARY       = 'vitalcv.interop-boundary.v1' as const;
const DEFAULT_MIN_PARTIAL_INTEROP_PCT = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSystemId(value: unknown): ExternalSystemId | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function dedupeSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(v => typeof v === 'string' && v.trim().length > 0).map(v => v.trim()))).sort();
}

function isLikelyNpi(raw: string | null): boolean {
  if (raw === null) return false;
  return /^\d{10}$/.test(raw);
}

// ── Trust contract ───────────────────────────────────────────────────────────

export function declareTrustContract(input: {
  contractId: string;
  systemId: ExternalSystemId;
  contractVersion: string;
  inboundFields: readonly string[];
  outboundFields: readonly string[];
  /** Default 'PRESERVE'. Pass 'REJECT' only if you intend the breach test to fire. */
  ambiguityPolicy?: AmbiguityPolicy;
}): TrustContract {
  const systemId = normalizeSystemId(input.systemId);
  if (!systemId) {
    throw new TrustInteropError({
      violation: 'UNDECLARED_SYSTEM',
      message: `Cannot declare contract ${input.contractId} — systemId is empty.`,
      contractId: input.contractId,
    });
  }
  const contractId = (input.contractId ?? '').trim();
  if (!contractId) {
    throw new TrustInteropError({
      violation: 'UNDECLARED_SYSTEM',
      message: `Cannot declare contract for system ${systemId} — contractId is empty.`,
      systemId,
    });
  }
  const contractVersion = (input.contractVersion ?? '').trim();
  if (!contractVersion) {
    throw new TrustInteropError({
      violation: 'CONTRACT_VERSION_DRIFT',
      message: `Contract ${contractId} declared without a version.`,
      contractId,
      systemId,
    });
  }

  const inboundFields = dedupeSorted(input.inboundFields ?? []);
  const outboundFields = dedupeSorted(input.outboundFields ?? []);
  const ambiguityPolicy: AmbiguityPolicy = input.ambiguityPolicy ?? 'PRESERVE';
  const declaredAt = new Date().toISOString();

  const contractDigest = sha256ForPayload({
    schema: SCHEMA_CONTRACT,
    contractId,
    systemId,
    contractVersion,
    inboundFields,
    outboundFields,
    ambiguityPolicy,
    failClosed: true,
  });

  return {
    schema: SCHEMA_CONTRACT,
    contractId,
    systemId,
    contractVersion,
    inboundFields,
    outboundFields,
    ambiguityPolicy,
    failClosed: true,
    contractDigest,
    declaredAt,
  };
}

/**
 * Pure compatibility check between two contracts. THROWS on incompatibility so
 * call sites cannot silently bridge a CLEAN replay across a drifted boundary.
 *
 * Two contracts are compatible iff:
 *   - They name the same systemId (or one's systemId === other.contractId? no —
 *     systemIds match exactly).
 *   - contractVersion strings match.
 *   - inboundFields of one are a subset of outboundFields of the other (and v.v.)
 *     — i.e. every field flowing one way has been declared as exportable by the
 *     other side.
 *   - ambiguityPolicy is 'PRESERVE' on both sides.
 */
export function assertContractCompatibility(local: TrustContract, remote: TrustContract): void {
  if (local.systemId !== remote.systemId) {
    throw new TrustInteropError({
      violation: 'CONTRACT_FIELD_DRIFT',
      message: `Contracts disagree on systemId: local=${local.systemId} remote=${remote.systemId}`,
      contractId: local.contractId,
      systemId: local.systemId,
    });
  }
  if (local.contractVersion !== remote.contractVersion) {
    throw new TrustInteropError({
      violation: 'CONTRACT_VERSION_DRIFT',
      message: `Contract version drift: local=${local.contractVersion} remote=${remote.contractVersion}`,
      contractId: local.contractId,
      systemId: local.systemId,
    });
  }
  if (local.ambiguityPolicy !== 'PRESERVE' || remote.ambiguityPolicy !== 'PRESERVE') {
    throw new TrustInteropError({
      violation: 'AMBIGUITY_COLLAPSED_OUTBOUND',
      message: `Contracts must declare ambiguityPolicy='PRESERVE'; got local=${local.ambiguityPolicy} remote=${remote.ambiguityPolicy}.`,
      contractId: local.contractId,
      systemId: local.systemId,
    });
  }
  // Outbound on local must be a superset of remote's expected inbound, and v.v.
  const remoteInbound = new Set(remote.inboundFields);
  for (const f of local.outboundFields) {
    if (!remoteInbound.has(f)) {
      throw new TrustInteropError({
        violation: 'CONTRACT_FIELD_DRIFT',
        message: `Local outbound field '${f}' is not declared in remote inbound fields — silent loss of data.`,
        contractId: local.contractId,
        systemId: local.systemId,
      });
    }
  }
  const localInbound = new Set(local.inboundFields);
  for (const f of remote.outboundFields) {
    if (!localInbound.has(f)) {
      throw new TrustInteropError({
        violation: 'CONTRACT_FIELD_DRIFT',
        message: `Remote outbound field '${f}' is not declared in local inbound fields — silent loss of data.`,
        contractId: local.contractId,
        systemId: local.systemId,
      });
    }
  }
}

// ── Replay bridge ────────────────────────────────────────────────────────────

/**
 * Cryptographic binding for a bridge envelope. Direction is INTENTIONALLY
 * excluded — the same envelope viewed from either side is the same trust
 * assertion, so an inbound recipient must be able to recompute the digest of
 * an envelope emitted as OUTBOUND. Cross-direction replay is prevented at the
 * bridgeId layer (each emission MUST use a unique bridgeId).
 */
function bridgeDigestFor(input: {
  bridgeId: string;
  fromSystem: ExternalSystemId;
  toSystem: ExternalSystemId;
  contractId: string;
  contractVersion: string;
  replayRecord: ReplayBridgeEnvelope['replayRecord'];
}): string {
  return sha256ForPayload({
    schema: 'vitalcv.replay-bridge-digest.v1',
    bridgeId: input.bridgeId,
    fromSystem: input.fromSystem,
    toSystem: input.toSystem,
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    replayRecord: {
      capsuleId: input.replayRecord.capsuleId,
      verdict: input.replayRecord.verdict,
      kind: input.replayRecord.kind,
      ambiguous: input.replayRecord.ambiguous,
      integrityDigest: input.replayRecord.integrityDigest,
      isolatedAt: input.replayRecord.isolatedAt,
    },
  });
}

/**
 * Wrap a local quarantine record as an OUTBOUND replay envelope. Pure transform
 * — never throws unless the record violates ambiguity preservation
 * (AMBIGUOUS_QUARANTINE_FORCED_CLEAN equivalent at the boundary).
 */
export function bridgeReplayOutbound(input: {
  bridgeId: string;
  contract: TrustContract;
  toSystem: ExternalSystemId;
  fromSystem: ExternalSystemId;
  record: ReplayQuarantineRecord;
}): ReplayBridgeEnvelope {
  const toSystem = normalizeSystemId(input.toSystem);
  const fromSystem = normalizeSystemId(input.fromSystem);
  if (!toSystem || !fromSystem) {
    throw new TrustInteropError({
      violation: 'UNDECLARED_SYSTEM',
      message: `Bridge envelope requires both fromSystem and toSystem; got from=${input.fromSystem} to=${input.toSystem}`,
      contractId: input.contract.contractId,
    });
  }
  if (input.record.ambiguous && input.record.verdict !== 'AMBIGUOUS') {
    throw new TrustInteropError({
      violation: 'AMBIGUITY_COLLAPSED_OUTBOUND',
      message: `Outbound replay record marked ambiguous=true but verdict=${input.record.verdict} — boundary would coerce ambiguity to clean.`,
      contractId: input.contract.contractId,
      systemId: toSystem,
    });
  }
  if (input.record.verdict === 'CLEAN' && input.record.kind !== null) {
    throw new TrustInteropError({
      violation: 'AMBIGUITY_COLLAPSED_OUTBOUND',
      message: `Outbound replay record verdict=CLEAN but carries kind=${input.record.kind}.`,
      contractId: input.contract.contractId,
      systemId: toSystem,
    });
  }
  if (input.contract.ambiguityPolicy !== 'PRESERVE') {
    throw new TrustInteropError({
      violation: 'AMBIGUITY_COLLAPSED_OUTBOUND',
      message: `Outbound contract ${input.contract.contractId} declares ambiguityPolicy=${input.contract.ambiguityPolicy} — refusing to emit.`,
      contractId: input.contract.contractId,
      systemId: toSystem,
    });
  }

  const replayRecord: ReplayBridgeEnvelope['replayRecord'] = {
    capsuleId: input.record.capsuleId,
    verdict: input.record.verdict,
    kind: input.record.kind,
    ambiguous: input.record.ambiguous,
    integrityDigest: input.record.containmentDigest,
    isolatedAt: input.record.isolatedAt,
  };

  const direction: ReplayBridgeDirection = 'OUTBOUND';
  const bridgeDigest = bridgeDigestFor({
    bridgeId: input.bridgeId,
    fromSystem,
    toSystem,
    contractId: input.contract.contractId,
    contractVersion: input.contract.contractVersion,
    replayRecord,
  });

  return {
    schema: SCHEMA_BRIDGE,
    bridgeId: input.bridgeId,
    direction,
    fromSystem,
    toSystem,
    contractId: input.contract.contractId,
    contractVersion: input.contract.contractVersion,
    replayRecord,
    bridgeDigest,
    bridgedAt: new Date().toISOString(),
  };
}

/**
 * Verify an INBOUND replay envelope and translate it into a local
 * ReplayQuarantineRecord. Bridge integrity is enforced by recomputing
 * `bridgeDigest` from the envelope's surface and rejecting mismatches.
 *
 * The local record's `containmentDigest` is recomputed via the local
 * containment classifier — so a remote's claimed digest never overrides
 * local cryptographic verification.
 */
export function bridgeReplayInbound(input: {
  envelope: ReplayBridgeEnvelope;
  contract: TrustContract;
  /** Optional integrity signal — when supplied the local verdict is recomputed
   *  via classifyIntegrity. When absent, the envelope's verdict is honored
   *  but its containment digest is salted with the envelope's bridgeId so it
   *  cannot collide with a locally-issued record. */
  localIntegrity?: IntegritySignal;
  lineageHints?: Partial<LineageHints> | null;
}): ReplayQuarantineRecord {
  if (input.envelope.contractId !== input.contract.contractId) {
    throw new TrustInteropError({
      violation: 'UNDECLARED_SYSTEM',
      message: `Envelope contractId ${input.envelope.contractId} does not match supplied contract ${input.contract.contractId}.`,
      contractId: input.contract.contractId,
      systemId: input.envelope.fromSystem,
    });
  }
  if (input.envelope.contractVersion !== input.contract.contractVersion) {
    throw new TrustInteropError({
      violation: 'CONTRACT_VERSION_DRIFT',
      message: `Inbound envelope contractVersion ${input.envelope.contractVersion} does not match local ${input.contract.contractVersion}.`,
      contractId: input.contract.contractId,
      systemId: input.envelope.fromSystem,
    });
  }
  const recomputed = bridgeDigestFor({
    bridgeId: input.envelope.bridgeId,
    fromSystem: input.envelope.fromSystem,
    toSystem: input.envelope.toSystem,
    contractId: input.envelope.contractId,
    contractVersion: input.envelope.contractVersion,
    replayRecord: input.envelope.replayRecord,
  });
  if (recomputed !== input.envelope.bridgeDigest) {
    throw new TrustInteropError({
      violation: 'BRIDGE_INTEGRITY_FAILURE',
      message: `Inbound bridge digest mismatch: recomputed ${recomputed} vs envelope ${input.envelope.bridgeDigest}.`,
      contractId: input.contract.contractId,
      systemId: input.envelope.fromSystem,
    });
  }

  if (
    input.envelope.replayRecord.ambiguous &&
    input.envelope.replayRecord.verdict !== 'AMBIGUOUS'
  ) {
    throw new TrustInteropError({
      violation: 'AMBIGUITY_COLLAPSED_INBOUND',
      message: `Inbound envelope flagged ambiguous=true but verdict=${input.envelope.replayRecord.verdict} — refusing to coerce.`,
      contractId: input.contract.contractId,
      systemId: input.envelope.fromSystem,
    });
  }
  if (
    input.envelope.replayRecord.verdict === 'CLEAN' &&
    input.envelope.replayRecord.kind !== null
  ) {
    throw new TrustInteropError({
      violation: 'AMBIGUITY_COLLAPSED_INBOUND',
      message: `Inbound envelope verdict=CLEAN but carries kind=${input.envelope.replayRecord.kind}.`,
      contractId: input.contract.contractId,
      systemId: input.envelope.fromSystem,
    });
  }

  // If a local integrity signal is provided, defer to the local containment
  // classifier so a hostile envelope cannot certify itself.
  if (input.localIntegrity) {
    return evaluateContainment({
      capsuleId: input.envelope.replayRecord.capsuleId,
      integrity: input.localIntegrity,
      lineageHints: input.lineageHints ?? null,
    });
  }

  // No local integrity signal — synthesize a quarantine record that mirrors the
  // envelope but uses a boundary-salted digest that includes the bridgeId so it
  // cannot be substituted for a locally-classified record.
  const verdict = input.envelope.replayRecord.verdict;
  const kind = input.envelope.replayRecord.kind;
  const ambiguous = input.envelope.replayRecord.ambiguous;
  const reason =
    verdict === 'AMBIGUOUS'
      ? `Inbound bridge ${input.envelope.bridgeId} from ${input.envelope.fromSystem} flagged AMBIGUOUS — preserved at boundary.`
      : verdict === 'CLEAN'
        ? `Inbound bridge ${input.envelope.bridgeId} from ${input.envelope.fromSystem} attested CLEAN; awaiting local revalidation.`
        : `Inbound bridge ${input.envelope.bridgeId} from ${input.envelope.fromSystem} reported ${verdict}.`;
  const integrity: IntegritySignal = {
    hashMatch: verdict === 'CLEAN',
    storedHash: input.envelope.replayRecord.integrityDigest,
    recomputedHash: input.envelope.replayRecord.integrityDigest,
    tamperEvidence: ambiguous
      ? 'Inbound envelope flagged ambiguous; local verdict deferred.'
      : null,
  };
  const localDigest = containmentDigest({
    capsuleId: input.envelope.replayRecord.capsuleId,
    verdict,
    kind,
    integrity,
  });
  const lineageHints: LineageHints = {
    subjectNpi: input.lineageHints?.subjectNpi ?? null,
    credentialIds: dedupeSorted(input.lineageHints?.credentialIds ?? []),
    sourceReferenceId: input.lineageHints?.sourceReferenceId ?? null,
  };

  return {
    schema: 'vitalcv.replay-corruption-containment.v1',
    capsuleId: input.envelope.replayRecord.capsuleId,
    verdict,
    kind,
    ambiguous,
    reason,
    containmentDigest: localDigest,
    isolatedAt: input.envelope.replayRecord.isolatedAt,
    lineageHints,
  };
}

// ── External lineage adapter ─────────────────────────────────────────────────

/**
 * Translate a raw external lineage record into the local LineageHints shape
 * the corruption-lineage tracer consumes. Pure — never throws on a missing
 * subject ID; instead the result records `subjectAdapted: false` so callers
 * cannot silently treat an un-anchored record as anchored.
 */
export function adaptExternalLineage(input: {
  contract: TrustContract;
  record: ExternalLineageRecord;
}): AdaptedLineage {
  const externalCapsuleId = (input.record.externalCapsuleId ?? '').trim();
  if (!externalCapsuleId) {
    throw new TrustInteropError({
      violation: 'LINEAGE_ADAPTER_MISMATCH',
      message: `External lineage record from ${input.contract.systemId} has no externalCapsuleId.`,
      contractId: input.contract.contractId,
      systemId: input.contract.systemId,
    });
  }
  if (input.record.systemSchemaVersion !== input.contract.contractVersion) {
    throw new TrustInteropError({
      violation: 'CONTRACT_VERSION_DRIFT',
      message: `External record systemSchemaVersion=${input.record.systemSchemaVersion} != contractVersion=${input.contract.contractVersion}.`,
      contractId: input.contract.contractId,
      systemId: input.contract.systemId,
    });
  }

  const rawSubject = typeof input.record.externalSubjectId === 'string'
    ? input.record.externalSubjectId.trim()
    : null;
  const scheme = typeof input.record.externalSubjectIdScheme === 'string'
    ? input.record.externalSubjectIdScheme.trim().toLowerCase()
    : null;

  // Only NPI-shape subjects map to local subjectNpi. Other schemes (MRN,
  // employee#, externalId) are NOT promoted — record carries subjectAdapted=false.
  const subjectNpi: string | null =
    rawSubject !== null && (scheme === 'npi' || scheme === null) && isLikelyNpi(rawSubject)
      ? rawSubject
      : null;
  const subjectAdapted = subjectNpi !== null;

  const credentialIds = dedupeSorted(input.record.externalCredentialIds ?? []);
  const sourceReferenceId =
    typeof input.record.externalSourceReferenceId === 'string'
    && input.record.externalSourceReferenceId.trim().length > 0
      ? input.record.externalSourceReferenceId.trim()
      : null;

  const lineageHints: LineageHints = {
    subjectNpi,
    credentialIds,
    sourceReferenceId,
  };

  const adapterDigest = sha256ForPayload({
    schema: SCHEMA_LINEAGE,
    systemId: input.contract.systemId,
    contractId: input.contract.contractId,
    contractVersion: input.contract.contractVersion,
    externalCapsuleId,
    lineageHints,
    subjectAdapted,
  });

  return {
    schema: SCHEMA_LINEAGE,
    systemId: input.contract.systemId,
    contractId: input.contract.contractId,
    externalCapsuleId,
    lineageHints,
    subjectAdapted,
    adapterDigest,
    adaptedAt: new Date().toISOString(),
  };
}

// ── Trust synchronization ────────────────────────────────────────────────────

/**
 * Reconstructable, order-independent sync state across N external systems
 * for a single subject. Pure — never throws.
 *
 * verdict table:
 *   - INSUFFICIENT  → fewer than 2 systems supplied a snapshot
 *   - AMBIGUOUS     → at least one snapshot has trustBand === null (signal missing)
 *   - DIVERGENT     → two or more snapshots disagree on trustBand
 *   - CONVERGED     → all non-null bands agree
 *
 * The `reconstructionDigest` hashes the SORTED snapshot list — so any caller
 * supplying the same set of snapshots in any order produces an identical
 * digest. That is the structural guarantee that synchronization is
 * reconstructable.
 */
export function synchronizeTrustState(input: {
  syncId: string;
  subjectKey: string;
  snapshots: ReadonlyArray<SystemTrustSnapshot>;
}): SyncState {
  const subjectKey = (input.subjectKey ?? '').trim();
  if (!subjectKey) {
    throw new TrustInteropError({
      violation: 'SYNC_RECONSTRUCTION_FAILURE',
      message: 'synchronizeTrustState requires a non-empty subjectKey.',
      subjectKey: null,
    });
  }
  const sortedSnapshots = (input.snapshots ?? [])
    .slice()
    .sort((a, b) => (a.systemId ?? '').localeCompare(b.systemId ?? ''))
    .map(s => ({
      systemId: normalizeSystemId(s.systemId) ?? '__unknown_system__',
      trustBand: s.trustBand ?? null,
      capturedAt: s.capturedAt ?? null,
      sourceDigest: s.sourceDigest,
    }));

  let verdict: SyncVerdict;
  let divergent = false;
  let divergenceReason: string | null = null;

  if (sortedSnapshots.length < 2) {
    verdict = 'INSUFFICIENT';
    divergenceReason = `Sync requires ≥2 systems; got ${sortedSnapshots.length}.`;
  } else if (sortedSnapshots.some(s => s.trustBand === null)) {
    verdict = 'AMBIGUOUS';
    divergenceReason = 'At least one system reported trustBand=null; preserving as ambiguous.';
  } else {
    const bands = new Set(sortedSnapshots.map(s => s.trustBand));
    if (bands.size > 1) {
      verdict = 'DIVERGENT';
      divergent = true;
      divergenceReason = `Systems disagree on trustBand: ${[...bands].sort().join(', ')}`;
    } else {
      verdict = 'CONVERGED';
    }
  }

  const reconstructionDigest = sha256ForPayload({
    schema: SCHEMA_SYNC,
    syncId: input.syncId,
    subjectKey,
    snapshots: sortedSnapshots,
  });

  return {
    schema: SCHEMA_SYNC,
    syncId: input.syncId,
    subjectKey,
    verdict,
    systems: sortedSnapshots,
    divergent,
    divergenceReason,
    reconstructionDigest,
    reconstructedAt: new Date().toISOString(),
  };
}

/**
 * Strict variant — throws when sync verdict is DIVERGENT but caller intended
 * CONVERGED (the sync-collapse anti-pattern). Silent convergence on a
 * divergent set would be the cross-system equivalent of forcing AMBIGUOUS to
 * CLEAN.
 */
export function assertSyncVerdict(state: SyncState, expected: SyncVerdict): void {
  if (state.verdict === expected) return;
  if (state.divergent && expected === 'CONVERGED') {
    throw new TrustInteropError({
      violation: 'SYNC_DIVERGENCE_FORCED_CONVERGENT',
      message: `Sync ${state.syncId} reported ${state.verdict} but caller asserted CONVERGED — divergence forcibly collapsed.`,
      subjectKey: state.subjectKey,
    });
  }
  throw new TrustInteropError({
    violation: 'SYNC_RECONSTRUCTION_FAILURE',
    message: `Sync ${state.syncId} verdict ${state.verdict} did not match expected ${expected}.`,
    subjectKey: state.subjectKey,
  });
}

// ── Boundary computation ─────────────────────────────────────────────────────

export function computeInteropBoundary(input: {
  envelopes: ReadonlyArray<ReplayBridgeEnvelope>;
  /** Quarantines emitted locally for envelopes that failed bridge integrity. */
  rejectedIds?: ReadonlyArray<string>;
  minPartialSurvivabilityPct?: number;
}): InteropBoundary {
  const envelopes = input.envelopes ?? [];
  const rejected = new Set(input.rejectedIds ?? []);
  const total = envelopes.length + rejected.size;

  let cleanCount = 0;
  let ambiguousCount = 0;
  let quarantinedCount = 0;
  const systems = new Set<ExternalSystemId>();
  const contracts = new Set<string>();

  for (const e of envelopes) {
    systems.add(e.fromSystem);
    systems.add(e.toSystem);
    contracts.add(e.contractId);
    switch (e.replayRecord.verdict) {
      case 'CLEAN':
        cleanCount += 1;
        break;
      case 'AMBIGUOUS':
        ambiguousCount += 1;
        break;
      case 'QUARANTINED':
      case 'CONTAMINATED':
      case 'CONTAINMENT_BREACH':
      default:
        quarantinedCount += 1;
        break;
    }
  }

  const rejectedCount = rejected.size;
  const denominator = total > 0 ? total : 1;
  const bridgeFidelityRatio = cleanCount / denominator;
  const partialSurvivabilityPct = ((cleanCount + ambiguousCount + quarantinedCount) / denominator) * 100;

  const minFloor = input.minPartialSurvivabilityPct ?? DEFAULT_MIN_PARTIAL_INTEROP_PCT;
  const partitioned = rejectedCount === 0 && partialSurvivabilityPct >= minFloor;

  let tier: InteropContainmentTier;
  if (rejectedCount > 0) {
    tier = 'INTEROP_BLAST_RADIUS_BREACH';
  } else if (contracts.size > 1) {
    tier = 'CROSS_CONTRACT';
  } else {
    tier = 'SINGLE_SYSTEM';
  }

  const containmentReason = rejectedCount > 0
    ? `Interop blast radius breached — ${rejectedCount} envelope(s) rejected at boundary; cannot certify partial bridge integrity.`
    : partitioned
      ? `Interop boundary intact — ${cleanCount}/${denominator} clean across ${systems.size} system(s) and ${contracts.size} contract(s).`
      : `Partial interop survivability ${partialSurvivabilityPct.toFixed(2)}% below floor ${minFloor}%.`;

  const boundaryDigest = sha256ForPayload({
    schema: SCHEMA_BOUNDARY,
    totalBridged: total,
    cleanCount,
    ambiguousCount,
    quarantinedCount,
    rejectedCount,
    bridgeDigests: envelopes.map(e => e.bridgeDigest).slice().sort(),
    rejectedIds: [...rejected].sort(),
  });

  return {
    schema: SCHEMA_BOUNDARY,
    totalBridged: total,
    cleanCount,
    ambiguousCount,
    quarantinedCount,
    rejectedCount,
    bridgeFidelityRatio,
    partialSurvivabilityPct,
    tier,
    systemsTouched: [...systems].sort(),
    contractsTouched: [...contracts].sort(),
    partitioned,
    containmentReason,
    boundaryDigest,
    partitionedAt: new Date().toISOString(),
  };
}

export function assertInteropBoundary(
  boundary: InteropBoundary,
  options: { minPartialSurvivabilityPct?: number } = {},
): void {
  const minFloor = options.minPartialSurvivabilityPct ?? DEFAULT_MIN_PARTIAL_INTEROP_PCT;
  if (boundary.tier === 'INTEROP_BLAST_RADIUS_BREACH') {
    throw new TrustInteropError({
      violation: 'INTEROP_BLAST_RADIUS_BREACH',
      message: boundary.containmentReason,
    });
  }
  if (!boundary.partitioned) {
    throw new TrustInteropError({
      violation: 'INTEROP_BLAST_RADIUS_BREACH',
      message: `Partial interop survivability ${boundary.partialSurvivabilityPct.toFixed(2)}% below floor ${minFloor}%.`,
    });
  }
}

/**
 * Hard-fail guard for the cross-system equivalent of "forced clean":
 * detect that a record marked ambiguous=true is being shipped with a
 * non-AMBIGUOUS verdict in either direction.
 */
export function assertCrossSystemAmbiguityPreserved(envelope: ReplayBridgeEnvelope): void {
  if (envelope.replayRecord.ambiguous && envelope.replayRecord.verdict !== 'AMBIGUOUS') {
    throw new TrustInteropError({
      violation: envelope.direction === 'INBOUND'
        ? 'AMBIGUITY_COLLAPSED_INBOUND'
        : 'AMBIGUITY_COLLAPSED_OUTBOUND',
      message: `Envelope ${envelope.bridgeId} ambiguous=true but verdict=${envelope.replayRecord.verdict}.`,
      contractId: envelope.contractId,
      systemId: envelope.direction === 'INBOUND' ? envelope.fromSystem : envelope.toSystem,
    });
  }
  if (envelope.replayRecord.verdict === 'CLEAN' && envelope.replayRecord.kind !== null) {
    throw new TrustInteropError({
      violation: envelope.direction === 'INBOUND'
        ? 'AMBIGUITY_COLLAPSED_INBOUND'
        : 'AMBIGUITY_COLLAPSED_OUTBOUND',
      message: `Envelope ${envelope.bridgeId} verdict=CLEAN but kind=${envelope.replayRecord.kind}.`,
      contractId: envelope.contractId,
    });
  }
}

// ── Sentinels (exported for tests + CI gates) ────────────────────────────────

export const INTEROP_SENTINELS = Object.freeze({
  SCHEMA_CONTRACT,
  SCHEMA_BRIDGE,
  SCHEMA_LINEAGE,
  SCHEMA_SYNC,
  SCHEMA_BOUNDARY,
  DEFAULT_MIN_PARTIAL_INTEROP_PCT,
});

export const KNOWN_INTEROP_VIOLATIONS = Object.freeze([
  'UNDECLARED_SYSTEM',
  'CONTRACT_VERSION_DRIFT',
  'CONTRACT_FIELD_DRIFT',
  'BRIDGE_INTEGRITY_FAILURE',
  'AMBIGUITY_COLLAPSED_INBOUND',
  'AMBIGUITY_COLLAPSED_OUTBOUND',
  'LINEAGE_ADAPTER_MISMATCH',
  'SYNC_DIVERGENCE_FORCED_CONVERGENT',
  'SYNC_RECONSTRUCTION_FAILURE',
  'INTEROP_BLAST_RADIUS_BREACH',
] as const);

export const KNOWN_SYNC_VERDICTS = Object.freeze([
  'CONVERGED',
  'DIVERGENT',
  'INSUFFICIENT',
  'AMBIGUOUS',
] as const);

export const KNOWN_INTEROP_TIERS = Object.freeze([
  'SINGLE_SYSTEM',
  'CROSS_CONTRACT',
  'INTEROP_BLAST_RADIUS_BREACH',
] as const);

/** Re-exported here so CI gate inputs can stay self-contained. */
export const KNOWN_BRIDGED_VERDICTS = KNOWN_CONTAINMENT_VERDICTS;

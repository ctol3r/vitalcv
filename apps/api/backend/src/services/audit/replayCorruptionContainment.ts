/**
 * replayCorruptionContainment.ts — W2-PR64A: Replay Corruption Containment
 *
 * Pure transforms enforcing the corruption boundary across the replay pipeline.
 * Goal: prevent localized replay corruption from becoming systemic replay
 * collapse. Companion to multi-tenant/tenantIsolation.ts — same shape, same
 * fail-closed contract, different axis.
 *
 * Hard invariants (fail-closed):
 *   - A corrupt replay is QUARANTINED, never silently merged with clean
 *     neighbors. Ambiguous integrity signals are preserved as AMBIGUOUS, not
 *     coerced to CLEAN.
 *   - Contamination spread is bounded: a bundle whose contaminated set
 *     exceeds the configured floor raises CONTAINMENT_BREACH so the operator
 *     sees the breach, never a partial bundle dressed as clean.
 *   - Quarantine records carry deterministic, tamper-evident containment
 *     digests so a forged "clean" record cannot replace a real quarantine.
 *   - Lineage is reconstructable: every quarantine record carries the
 *     hints needed to walk back to the corruption source.
 *
 * No fetches, no DB writes, no audit-event writes. This module is the
 * boundary checker; replayEngine.ts and buildAuditBundle call it.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

/** What kind of corruption the integrity signal is reporting. */
export type CorruptionKind =
  | 'HASH_MISMATCH'           // stored vs. recomputed artifact hash differ
  | 'EVIDENCE_SPINE_DRIFT'    // referenced artifacts no longer reproduce the stored spine
  | 'METADATA_CORRUPTION'     // capsule metadata is structurally invalid
  | 'STRUCTURAL_CORRUPTION'   // capsule shape itself is bad (missing fields, broken types)
  | 'DEPENDENCY_CORRUPTION'   // a referenced capsule/artifact is corrupt (lineage child)
  | 'AMBIGUOUS_INTEGRITY';    // signals contradict — preserve uncertainty

/** Containment verdict for a single replay. */
export type ContainmentVerdict =
  | 'CLEAN'                   // no corruption surfaced
  | 'QUARANTINED'             // corruption surfaced and isolated
  | 'AMBIGUOUS'               // signals ambiguous — quarantine + flag
  | 'CONTAMINATED'            // downstream of a quarantined capsule by lineage
  | 'CONTAINMENT_BREACH';     // boundary breached — operator-visible failure

export type ContainmentViolationKind =
  | 'AMBIGUOUS_QUARANTINE_FORCED_CLEAN'
  | 'BOUNDARY_BREACH'
  | 'PARTIAL_SURVIVABILITY_FLOOR_BREACHED'
  | 'QUARANTINE_OPEN_FAILURE';

export class ReplayContainmentError extends Error {
  readonly code = 'REPLAY_CONTAINMENT_VIOLATION' as const;
  readonly violation: ContainmentViolationKind;
  readonly capsuleId: string | null;
  readonly kind: CorruptionKind | null;
  readonly partialSurvivabilityPct: number | null;

  constructor(args: {
    violation: ContainmentViolationKind;
    message: string;
    capsuleId?: string | null;
    kind?: CorruptionKind | null;
    partialSurvivabilityPct?: number | null;
  }) {
    super(args.message);
    this.name = 'ReplayContainmentError';
    this.violation = args.violation;
    this.capsuleId = args.capsuleId ?? null;
    this.kind = args.kind ?? null;
    this.partialSurvivabilityPct = args.partialSurvivabilityPct ?? null;
  }
}

/**
 * The integrity signal a containment classifier consumes. Mirrors the shape
 * of replayEngine's IntegrityCheck so call sites can pass it directly, but
 * stays narrow so this module never depends on replayEngine.
 */
export interface IntegritySignal {
  hashMatch: boolean;
  storedHash: string;
  recomputedHash: string;
  tamperEvidence: string | null;
  evidenceSpineExpected?: string | null;
  evidenceSpineActual?: string | null;
}

export interface LineageHints {
  subjectNpi: string | null;
  credentialIds: string[];
  sourceReferenceId: string | null;
}

export interface ReplayQuarantineRecord {
  schema: 'vitalcv.replay-corruption-containment.v1';
  capsuleId: string;
  verdict: ContainmentVerdict;
  /** Null when verdict === 'CLEAN'. */
  kind: CorruptionKind | null;
  /** True iff verdict === 'AMBIGUOUS'. Mirrored for fast filtering. */
  ambiguous: boolean;
  reason: string;
  /** SHA-256 over (capsuleId, kind, verdict, integrity signal). Tamper-evident boundary marker. */
  containmentDigest: string;
  isolatedAt: string;
  lineageHints: LineageHints;
}

export interface ContainmentBoundary {
  schema: 'vitalcv.replay-containment-boundary.v1';
  /** True iff containment is intact — no breach, ambiguity preserved as flag. */
  partitioned: boolean;
  totalReplayed: number;
  cleanCount: number;
  quarantinedCount: number;
  ambiguousCount: number;
  contaminatedCount: number;
  /** clean / total — 1.0 when nothing is corrupt. */
  containmentRatio: number;
  /** (clean + quarantined-but-isolated + ambiguous) / total * 100 — what survived. */
  partialSurvivabilityPct: number;
  containmentReason: string;
  boundaryDigest: string;
  partitionedAt: string;
}

export interface CorruptionLineageEdge {
  fromCapsuleId: string;
  toCapsuleId: string;
  reason: 'SHARED_SUBJECT' | 'SHARED_CREDENTIAL' | 'SHARED_SOURCE_REFERENCE';
}

export interface CorruptionLineage {
  schema: 'vitalcv.replay-corruption-lineage.v1';
  rootCapsuleId: string;
  /** Capsules contaminated via the root's lineage hints. Excludes the root. */
  contaminatedCapsuleIds: string[];
  edges: CorruptionLineageEdge[];
  /** SHA-256 over (rootCapsuleId, sorted contaminated ids, sorted edges). */
  reconstructionDigest: string;
  reconstructedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCHEMA_QUARANTINE = 'vitalcv.replay-corruption-containment.v1' as const;
const SCHEMA_BOUNDARY   = 'vitalcv.replay-containment-boundary.v1' as const;
const SCHEMA_LINEAGE    = 'vitalcv.replay-corruption-lineage.v1' as const;

function normalizeHints(hints: Partial<LineageHints> | undefined | null): LineageHints {
  return {
    subjectNpi: typeof hints?.subjectNpi === 'string' && hints.subjectNpi.trim().length > 0
      ? hints.subjectNpi.trim()
      : null,
    credentialIds: Array.isArray(hints?.credentialIds)
      ? Array.from(new Set(hints!.credentialIds.filter(id => typeof id === 'string' && id.trim().length > 0))).sort()
      : [],
    sourceReferenceId: typeof hints?.sourceReferenceId === 'string' && hints.sourceReferenceId.trim().length > 0
      ? hints.sourceReferenceId.trim()
      : null,
  };
}

export function containmentDigest(input: {
  capsuleId: string;
  verdict: ContainmentVerdict;
  kind: CorruptionKind | null;
  integrity: IntegritySignal;
}): string {
  return sha256ForPayload({
    schema: 'vitalcv.replay-containment-digest.v1',
    capsuleId: input.capsuleId,
    verdict: input.verdict,
    kind: input.kind,
    integrity: {
      hashMatch: input.integrity.hashMatch,
      storedHash: input.integrity.storedHash,
      recomputedHash: input.integrity.recomputedHash,
      tamperEvidence: input.integrity.tamperEvidence ?? null,
      evidenceSpineExpected: input.integrity.evidenceSpineExpected ?? null,
      evidenceSpineActual: input.integrity.evidenceSpineActual ?? null,
    },
  });
}

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Pure classifier — given an integrity signal, return the corruption kind,
 * an ambiguity flag, and a human-readable reason.
 *
 * Fail-closed table:
 *
 *   hashMatch | tamperEvidence | spineMismatch | result
 *   ----------+----------------+---------------+----------------------
 *   true      | null           | n/a           | CLEAN (kind null)
 *   true      | set            | n/a           | AMBIGUOUS_INTEGRITY
 *   false     | null           | n/a           | AMBIGUOUS_INTEGRITY
 *   false     | set            | true          | EVIDENCE_SPINE_DRIFT
 *   false     | set            | false (hash)  | HASH_MISMATCH
 *   false     | set            | none of above | STRUCTURAL_CORRUPTION
 */
export function classifyIntegrity(integrity: IntegritySignal): {
  kind: CorruptionKind | null;
  ambiguous: boolean;
  reason: string;
} {
  const expected = integrity.evidenceSpineExpected ?? null;
  const actual   = integrity.evidenceSpineActual ?? null;
  const spineMismatch = expected !== null && actual !== null && expected !== actual;

  if (integrity.hashMatch && integrity.tamperEvidence === null) {
    return {
      kind: null,
      ambiguous: false,
      reason: 'Integrity check passed; no corruption surfaced.',
    };
  }
  if (integrity.hashMatch && integrity.tamperEvidence !== null) {
    return {
      kind: 'AMBIGUOUS_INTEGRITY',
      ambiguous: true,
      reason: `Contradictory signals: hashMatch=true but tamperEvidence present — ${integrity.tamperEvidence}`,
    };
  }
  if (!integrity.hashMatch && integrity.tamperEvidence === null) {
    return {
      kind: 'AMBIGUOUS_INTEGRITY',
      ambiguous: true,
      reason: 'Contradictory signals: hashMatch=false but no tamperEvidence text. Quarantining as ambiguous.',
    };
  }

  // hashMatch=false and evidence present — pick a concrete kind.
  if (spineMismatch) {
    return {
      kind: 'EVIDENCE_SPINE_DRIFT',
      ambiguous: false,
      reason: integrity.tamperEvidence ?? 'Evidence spine digest mismatch.',
    };
  }
  if (integrity.storedHash !== integrity.recomputedHash) {
    return {
      kind: 'HASH_MISMATCH',
      ambiguous: false,
      reason: integrity.tamperEvidence ?? 'Artifact hash mismatch.',
    };
  }
  return {
    kind: 'STRUCTURAL_CORRUPTION',
    ambiguous: false,
    reason: integrity.tamperEvidence ?? 'Replay validation failed without a specific signal.',
  };
}

// ── Quarantine builder ────────────────────────────────────────────────────────

/**
 * Build a quarantine record for a single replay. Pure — never throws.
 *
 * Use `forcedKind: 'DEPENDENCY_CORRUPTION'` to mark a replay CONTAMINATED via
 * lineage even though its own integrity signal is clean (a downstream caller
 * decided the replay's lineage parent is corrupt).
 */
export function quarantineReplay(input: {
  capsuleId: string;
  integrity: IntegritySignal;
  lineageHints?: Partial<LineageHints> | null;
  forcedKind?: CorruptionKind;
  forcedReason?: string;
}): ReplayQuarantineRecord {
  const isolatedAt = new Date().toISOString();
  const hints = normalizeHints(input.lineageHints);

  if (input.forcedKind === 'DEPENDENCY_CORRUPTION') {
    const verdict: ContainmentVerdict = 'CONTAMINATED';
    const reason = input.forcedReason
      ?? `Capsule ${input.capsuleId} contaminated via lineage from a quarantined parent.`;
    return {
      schema: SCHEMA_QUARANTINE,
      capsuleId: input.capsuleId,
      verdict,
      kind: 'DEPENDENCY_CORRUPTION',
      ambiguous: false,
      reason,
      containmentDigest: containmentDigest({
        capsuleId: input.capsuleId,
        verdict,
        kind: 'DEPENDENCY_CORRUPTION',
        integrity: input.integrity,
      }),
      isolatedAt,
      lineageHints: hints,
    };
  }

  const classified = classifyIntegrity(input.integrity);
  const kind = input.forcedKind ?? classified.kind;
  const reason = input.forcedReason ?? classified.reason;

  let verdict: ContainmentVerdict;
  if (kind === null) {
    verdict = 'CLEAN';
  } else if (classified.ambiguous || kind === 'AMBIGUOUS_INTEGRITY') {
    verdict = 'AMBIGUOUS';
  } else {
    verdict = 'QUARANTINED';
  }

  return {
    schema: SCHEMA_QUARANTINE,
    capsuleId: input.capsuleId,
    verdict,
    kind,
    ambiguous: verdict === 'AMBIGUOUS',
    reason,
    containmentDigest: containmentDigest({
      capsuleId: input.capsuleId,
      verdict,
      kind,
      integrity: input.integrity,
    }),
    isolatedAt,
    lineageHints: hints,
  };
}

/**
 * Non-throwing variant of the quarantine builder for call sites that want
 * a verdict object even on internal failure. Mirrors evaluateTenantScope.
 *
 * If quarantine construction throws (it never should — pure transform), the
 * record returned is a CONTAINMENT_BREACH placeholder so a swallowed error
 * cannot masquerade as CLEAN.
 */
export function evaluateContainment(input: {
  capsuleId: string;
  integrity: IntegritySignal;
  lineageHints?: Partial<LineageHints> | null;
  forcedKind?: CorruptionKind;
  forcedReason?: string;
}): ReplayQuarantineRecord {
  try {
    return quarantineReplay(input);
  } catch (err) {
    const isolatedAt = new Date().toISOString();
    const hints = normalizeHints(input.lineageHints);
    const kind: CorruptionKind = 'STRUCTURAL_CORRUPTION';
    const verdict: ContainmentVerdict = 'CONTAINMENT_BREACH';
    const reason = `Containment evaluator failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      schema: SCHEMA_QUARANTINE,
      capsuleId: input.capsuleId,
      verdict,
      kind,
      ambiguous: false,
      reason,
      containmentDigest: containmentDigest({
        capsuleId: input.capsuleId,
        verdict,
        kind,
        integrity: input.integrity,
      }),
      isolatedAt,
      lineageHints: hints,
    };
  }
}

// ── Boundary computation ──────────────────────────────────────────────────────

const DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT = 50;

/**
 * Compute the containment boundary for a population of replay outcomes.
 * Pure — never throws.
 *
 * `containmentRatio` is the fraction of fully clean replays.
 * `partialSurvivabilityPct` reports how much of the population survived in
 * an operator-actionable form (clean + quarantined + ambiguous). Failures
 * that vanished from the bundle entirely do NOT count toward survivability.
 */
export function computeContainmentBoundary(input: {
  totalReplayed: number;
  quarantines: ReadonlyArray<ReplayQuarantineRecord>;
  /** When provided, asserts no breach exceeded the configured percentage. */
  minPartialSurvivabilityPct?: number;
}): ContainmentBoundary {
  const total = Math.max(0, input.totalReplayed);
  const quarantines = input.quarantines;
  const cleanCount        = quarantines.filter(q => q.verdict === 'CLEAN').length;
  const quarantinedCount  = quarantines.filter(q => q.verdict === 'QUARANTINED').length;
  const ambiguousCount    = quarantines.filter(q => q.verdict === 'AMBIGUOUS').length;
  const contaminatedCount = quarantines.filter(q => q.verdict === 'CONTAMINATED').length;
  const breachCount       = quarantines.filter(q => q.verdict === 'CONTAINMENT_BREACH').length;

  const surfaceObserved = cleanCount + quarantinedCount + ambiguousCount + contaminatedCount + breachCount;
  const denominator = total > 0 ? total : Math.max(1, surfaceObserved);
  const containmentRatio = denominator === 0 ? 1 : cleanCount / denominator;
  const partialSurvivabilityPct = denominator === 0
    ? 100
    : ((cleanCount + quarantinedCount + ambiguousCount) / denominator) * 100;

  const minFloor = input.minPartialSurvivabilityPct ?? DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT;
  const partitioned = breachCount === 0 && partialSurvivabilityPct >= minFloor;

  const containmentReason = breachCount > 0
    ? `Containment breached on ${breachCount} replay(s); evaluator-level failure cannot be silently merged with clean lineage.`
    : partitioned
      ? `Containment intact — ${cleanCount}/${denominator} clean, ${quarantinedCount} quarantined, ${ambiguousCount} ambiguous, ${contaminatedCount} contaminated.`
      : `Partial survivability ${partialSurvivabilityPct.toFixed(2)}% below floor ${minFloor}%; containment cannot certify partial-bundle integrity.`;

  const boundaryDigest = sha256ForPayload({
    schema: SCHEMA_BOUNDARY,
    totalReplayed: total,
    cleanCount,
    quarantinedCount,
    ambiguousCount,
    contaminatedCount,
    breachCount,
    quarantineDigests: quarantines
      .map(q => q.containmentDigest)
      .slice()
      .sort(),
  });

  return {
    schema: SCHEMA_BOUNDARY,
    partitioned,
    totalReplayed: total,
    cleanCount,
    quarantinedCount,
    ambiguousCount,
    contaminatedCount,
    containmentRatio,
    partialSurvivabilityPct,
    containmentReason,
    boundaryDigest,
    partitionedAt: new Date().toISOString(),
  };
}

/**
 * Strict variant — throws ReplayContainmentError if the boundary is breached
 * or partial survivability is below the configured floor.
 */
export function assertContainmentBoundary(
  boundary: ContainmentBoundary,
  options: { minPartialSurvivabilityPct?: number } = {},
): void {
  const minFloor = options.minPartialSurvivabilityPct ?? DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT;

  if (!boundary.partitioned) {
    if (boundary.partialSurvivabilityPct < minFloor) {
      throw new ReplayContainmentError({
        violation: 'PARTIAL_SURVIVABILITY_FLOOR_BREACHED',
        message: `Partial survivability ${boundary.partialSurvivabilityPct.toFixed(2)}% below floor ${minFloor}%.`,
        partialSurvivabilityPct: boundary.partialSurvivabilityPct,
      });
    }
    throw new ReplayContainmentError({
      violation: 'BOUNDARY_BREACH',
      message: boundary.containmentReason,
      partialSurvivabilityPct: boundary.partialSurvivabilityPct,
    });
  }
}

/**
 * Hard-fail guard for the "ambiguous quarantine forced clean" anti-pattern.
 * Catches a future regression that would coerce an AMBIGUOUS verdict back
 * to CLEAN — the kind of silent collapse this PR exists to prevent.
 */
export function assertAmbiguityPreserved(record: ReplayQuarantineRecord): void {
  if (record.ambiguous && record.verdict !== 'AMBIGUOUS') {
    throw new ReplayContainmentError({
      violation: 'AMBIGUOUS_QUARANTINE_FORCED_CLEAN',
      message: `Quarantine record for ${record.capsuleId} flagged ambiguous but verdict ${record.verdict} discards uncertainty.`,
      capsuleId: record.capsuleId,
      kind: record.kind,
    });
  }
  if (record.verdict === 'CLEAN' && record.kind !== null) {
    throw new ReplayContainmentError({
      violation: 'AMBIGUOUS_QUARANTINE_FORCED_CLEAN',
      message: `Quarantine record for ${record.capsuleId} marked CLEAN but carries kind ${record.kind} — ambiguity discarded.`,
      capsuleId: record.capsuleId,
      kind: record.kind,
    });
  }
}

// ── Lineage reconstruction ────────────────────────────────────────────────────

/**
 * Trace a corruption lineage from a single quarantined root through a set of
 * candidate replays. Pure — never throws. An edge is emitted whenever a
 * candidate shares one of the root's lineage hints (subjectNpi, a credentialId,
 * or sourceReferenceId).
 *
 * The reconstruction digest hashes the deterministic shape of the lineage so
 * downstream consumers can assert it has not been silently rewritten.
 */
export function traceCorruptionLineage(input: {
  rootCapsuleId: string;
  rootHints: Partial<LineageHints>;
  candidates: ReadonlyArray<{ capsuleId: string; hints: Partial<LineageHints> }>;
}): CorruptionLineage {
  const root = normalizeHints(input.rootHints);
  const reconstructedAt = new Date().toISOString();
  const edges: CorruptionLineageEdge[] = [];
  const contaminatedSet = new Set<string>();

  for (const c of input.candidates) {
    if (c.capsuleId === input.rootCapsuleId) continue;
    const cand = normalizeHints(c.hints);
    let edged = false;

    if (root.subjectNpi !== null && cand.subjectNpi === root.subjectNpi) {
      edges.push({ fromCapsuleId: input.rootCapsuleId, toCapsuleId: c.capsuleId, reason: 'SHARED_SUBJECT' });
      edged = true;
    }
    if (root.credentialIds.length > 0) {
      const overlap = cand.credentialIds.some(id => root.credentialIds.includes(id));
      if (overlap) {
        edges.push({ fromCapsuleId: input.rootCapsuleId, toCapsuleId: c.capsuleId, reason: 'SHARED_CREDENTIAL' });
        edged = true;
      }
    }
    if (root.sourceReferenceId !== null && cand.sourceReferenceId === root.sourceReferenceId) {
      edges.push({ fromCapsuleId: input.rootCapsuleId, toCapsuleId: c.capsuleId, reason: 'SHARED_SOURCE_REFERENCE' });
      edged = true;
    }
    if (edged) contaminatedSet.add(c.capsuleId);
  }

  const contaminated = [...contaminatedSet].sort();
  const sortedEdges = edges
    .slice()
    .sort((a, b) =>
      a.toCapsuleId.localeCompare(b.toCapsuleId) || a.reason.localeCompare(b.reason),
    );

  const reconstructionDigest = sha256ForPayload({
    schema: SCHEMA_LINEAGE,
    rootCapsuleId: input.rootCapsuleId,
    contaminated,
    edges: sortedEdges,
  });

  return {
    schema: SCHEMA_LINEAGE,
    rootCapsuleId: input.rootCapsuleId,
    contaminatedCapsuleIds: contaminated,
    edges: sortedEdges,
    reconstructionDigest,
    reconstructedAt,
  };
}

// ── Sentinels (exported for tests / CI gates) ─────────────────────────────────

export const CONTAINMENT_SENTINELS = Object.freeze({
  DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT,
  SCHEMA_QUARANTINE,
  SCHEMA_BOUNDARY,
  SCHEMA_LINEAGE,
});

export const KNOWN_CONTAINMENT_VERDICTS = Object.freeze([
  'CLEAN',
  'QUARANTINED',
  'AMBIGUOUS',
  'CONTAMINATED',
  'CONTAINMENT_BREACH',
] as const);

export const KNOWN_CORRUPTION_KINDS = Object.freeze([
  'HASH_MISMATCH',
  'EVIDENCE_SPINE_DRIFT',
  'METADATA_CORRUPTION',
  'STRUCTURAL_CORRUPTION',
  'DEPENDENCY_CORRUPTION',
  'AMBIGUOUS_INTEGRITY',
] as const);

export const KNOWN_CONTAINMENT_VIOLATIONS = Object.freeze([
  'AMBIGUOUS_QUARANTINE_FORCED_CLEAN',
  'BOUNDARY_BREACH',
  'PARTIAL_SURVIVABILITY_FLOOR_BREACHED',
  'QUARANTINE_OPEN_FAILURE',
] as const);

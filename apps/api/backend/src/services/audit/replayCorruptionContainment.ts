/**
 * replayCorruptionContainment.ts — W2-PR64A containment record set
 *
 * Narrow-shim restoration of the module orphaned by commit 8912bc7e.
 * Provides the corruption-containment surface that replayEngine.ts
 * relies on:
 *
 *   - quarantineReplay              — per-replay verdict from integrity signal
 *   - evaluateContainment           — per-replay verdict, optionally forced
 *   - computeContainmentBoundary    — bundle-level aggregate
 *   - traceCorruptionLineage        — contamination edges across replays
 *
 * Doctrine:
 *   - **Pure transforms.** No throws. CLEAN replays still produce a
 *     full record so downstream code can rely on the field always
 *     being present (the comment at replayEngine.ts:450 documents
 *     this contract).
 *   - **No silent upgrades.** A quarantine verdict can be forced via
 *     `forcedKind` (used when a replay raised before classification
 *     could complete); it can never be downgraded.
 *   - **Deterministic.** Same input → same record. Lineage tracing
 *     is order-independent.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Integrity signal handed to the containment classifier. Built by the
 * replay engine after it has computed `hashMatch` / `evidenceSpineExpected` /
 * `evidenceSpineActual`.
 */
export interface IntegritySignal {
  hashMatch: boolean;
  storedHash: string;
  recomputedHash: string;
  tamperEvidence: string | null;
  evidenceSpineExpected?: string | null;
  evidenceSpineActual?: string | null;
}

/** Quarantine kinds — narrow set used by the verdict ladder. */
export type QuarantineKind =
  | 'NONE'
  | 'HASH_MISMATCH'
  | 'EVIDENCE_DRIFT'
  | 'STRUCTURAL_CORRUPTION';

/**
 * Per-replay containment record. Always present — CLEAN replays get a
 * `verdict: 'CLEAN'` record with `kind: 'NONE'` so the downstream
 * boundary calculation can sum verdicts without nullability checks.
 */
export interface ReplayQuarantineRecord {
  schema: 'vitalcv.replay-quarantine.v1';
  capsuleId: string;
  /**
   * Verdict ladder:
   *   - CLEAN              — no integrity issue
   *   - QUARANTINED        — clear corruption (hash mismatch / structural)
   *   - AMBIGUOUS          — partial evidence of drift (e.g. spine drift
   *                          without hash mismatch)
   *   - CONTAINMENT_BREACH — quarantine itself failed (forced)
   */
  verdict: 'CLEAN' | 'QUARANTINED' | 'AMBIGUOUS' | 'CONTAINMENT_BREACH';
  kind: QuarantineKind;
  ambiguous: boolean;
  reason: string | null;
  /**
   * Lineage hints — copied from the source capsule so downstream
   * lineage tracing can match contamination edges without re-fetching.
   */
  lineageHints: {
    subjectNpi: string;
    credentialIds: ReadonlyArray<string>;
    sourceReferenceId: string | null;
  };
  /**
   * ISO-8601 timestamp the quarantine record was created at. Read by
   * the audit-bundle custody log (replayEngine.ts:800). Alias of
   * `classifiedAt` for legacy compatibility.
   */
  isolatedAt: string;
  /** ISO-8601 timestamp this record was classified at. */
  classifiedAt: string;
}

/** Bundle-level aggregate of every per-replay record. */
export interface ContainmentBoundary {
  schema: 'vitalcv.replay-containment-boundary.v1';
  totalReplayed: number;
  cleanCount: number;
  quarantinedCount: number;
  ambiguousCount: number;
  breachCount: number;
  /** 0..1 — fraction of CLEAN replays. */
  survivabilityScore: number;
  /** Whether the boundary remains intact (no CONTAINMENT_BREACH). */
  partitioned: boolean;
  /** Survivability expressed as a percent (0..100). Read directly by
   *  the audit-bundle custody log. */
  partialSurvivabilityPct: number;
  classifiedAt: string;
}

/**
 * Contamination edge from a corrupt root through any downstream
 * replays that share a lineage hint with it. Always emitted, even
 * when no candidates match (downstream consumers can rely on the
 * shape).
 */
export interface CorruptionLineage {
  schema: 'vitalcv.replay-corruption-lineage.v1';
  rootCapsuleId: string;
  rootHints: ReplayQuarantineRecord['lineageHints'];
  /** Downstream capsules sharing at least one lineage hint with the root. */
  contaminationEdges: Array<{
    capsuleId: string;
    sharedHints: ReadonlyArray<'subjectNpi' | 'credentialIds' | 'sourceReferenceId'>;
  }>;
  classifiedAt: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function classifyKindFromIntegrity(signal: IntegritySignal): {
  kind: QuarantineKind;
  verdict: ReplayQuarantineRecord['verdict'];
  ambiguous: boolean;
  reason: string | null;
} {
  if (signal.hashMatch === false) {
    return {
      kind: 'HASH_MISMATCH',
      verdict: 'QUARANTINED',
      ambiguous: false,
      reason: signal.tamperEvidence ?? 'Hash mismatch detected on replay.',
    };
  }
  const spineDrifted =
    signal.evidenceSpineExpected != null &&
    signal.evidenceSpineActual != null &&
    signal.evidenceSpineExpected !== signal.evidenceSpineActual;
  if (spineDrifted) {
    return {
      kind: 'EVIDENCE_DRIFT',
      verdict: 'AMBIGUOUS',
      ambiguous: true,
      reason: 'Evidence spine digest drift without hash mismatch.',
    };
  }
  return { kind: 'NONE', verdict: 'CLEAN', ambiguous: false, reason: null };
}

// ── Public surface ────────────────────────────────────────────────────────────

export interface QuarantineReplayInput {
  capsuleId: string;
  integrity: IntegritySignal;
  lineageHints: ReplayQuarantineRecord['lineageHints'];
}

/**
 * Classify a replay's containment verdict from its integrity signal.
 * Pure transform — never throws.
 */
export function quarantineReplay(input: QuarantineReplayInput): ReplayQuarantineRecord {
  const c = classifyKindFromIntegrity(input.integrity);
  const now = nowIso();
  return {
    schema: 'vitalcv.replay-quarantine.v1',
    capsuleId: input.capsuleId,
    verdict: c.verdict,
    kind: c.kind,
    ambiguous: c.ambiguous,
    reason: c.reason,
    lineageHints: input.lineageHints,
    isolatedAt: now,
    classifiedAt: now,
  };
}

export interface EvaluateContainmentInput {
  capsuleId: string;
  integrity: IntegritySignal;
  /** Optional forced kind — used when a replay raised before
   *  classification could complete. The verdict is upgraded to
   *  CONTAINMENT_BREACH (the quarantine itself failed). */
  forcedKind?: QuarantineKind;
  forcedReason?: string;
  /** Lineage hints fall back to zero-length collections when forced
   *  (the caller didn't get far enough to read them). */
  lineageHints?: ReplayQuarantineRecord['lineageHints'];
}

/**
 * Same shape as `quarantineReplay`, plus the ability to *force* a
 * verdict. Used by the audit-bundle builder when a single replay
 * raised before its own integrity signal could be computed — the
 * containment boundary needs an entry for that replay so the
 * survivability score reflects it.
 */
export function evaluateContainment(input: EvaluateContainmentInput): ReplayQuarantineRecord {
  const baseHints: ReplayQuarantineRecord['lineageHints'] =
    input.lineageHints ?? { subjectNpi: '', credentialIds: [], sourceReferenceId: null };
  if (input.forcedKind && input.forcedKind !== 'NONE') {
    const now = nowIso();
    return {
      schema: 'vitalcv.replay-quarantine.v1',
      capsuleId: input.capsuleId,
      verdict: 'CONTAINMENT_BREACH',
      kind: input.forcedKind,
      ambiguous: false,
      reason: input.forcedReason ?? 'Containment breached: classification raised before completion.',
      lineageHints: baseHints,
      isolatedAt: now,
      classifiedAt: now,
    };
  }
  return quarantineReplay({
    capsuleId: input.capsuleId,
    integrity: input.integrity,
    lineageHints: baseHints,
  });
}

export interface ComputeBoundaryInput {
  totalReplayed: number;
  quarantines: ReadonlyArray<ReplayQuarantineRecord>;
}

/**
 * Bundle-level aggregate. Pure transform — sums the verdicts and
 * computes the survivability score.
 */
export function computeContainmentBoundary(
  input: ComputeBoundaryInput,
): ContainmentBoundary {
  let cleanCount = 0;
  let quarantinedCount = 0;
  let ambiguousCount = 0;
  let breachCount = 0;
  for (const q of input.quarantines) {
    switch (q.verdict) {
      case 'CLEAN':
        cleanCount += 1;
        break;
      case 'QUARANTINED':
        quarantinedCount += 1;
        break;
      case 'AMBIGUOUS':
        ambiguousCount += 1;
        break;
      case 'CONTAINMENT_BREACH':
        breachCount += 1;
        break;
    }
  }
  const denom = Math.max(input.totalReplayed, 1);
  const survivabilityScore = Math.max(0, Math.min(1, cleanCount / denom));
  return {
    schema: 'vitalcv.replay-containment-boundary.v1',
    totalReplayed: input.totalReplayed,
    cleanCount,
    quarantinedCount,
    ambiguousCount,
    breachCount,
    survivabilityScore,
    partitioned: breachCount === 0,
    partialSurvivabilityPct: survivabilityScore * 100,
    classifiedAt: nowIso(),
  };
}

export interface TraceCorruptionLineageInput {
  rootCapsuleId: string;
  rootHints: ReplayQuarantineRecord['lineageHints'];
  candidates: ReadonlyArray<{
    capsuleId: string;
    hints: ReplayQuarantineRecord['lineageHints'];
  }>;
}

/**
 * Identify contamination edges: candidates that share at least one
 * lineage hint with the corrupt root. The result is always returned;
 * `contaminationEdges` is `[]` when no candidates match.
 */
export function traceCorruptionLineage(
  input: TraceCorruptionLineageInput,
): CorruptionLineage {
  const edges: CorruptionLineage['contaminationEdges'] = [];
  const rootCredentialSet = new Set(input.rootHints.credentialIds ?? []);

  for (const candidate of input.candidates) {
    if (candidate.capsuleId === input.rootCapsuleId) continue;
    const shared: Array<'subjectNpi' | 'credentialIds' | 'sourceReferenceId'> = [];
    if (
      input.rootHints.subjectNpi &&
      candidate.hints.subjectNpi &&
      input.rootHints.subjectNpi === candidate.hints.subjectNpi
    ) {
      shared.push('subjectNpi');
    }
    if (
      rootCredentialSet.size > 0 &&
      candidate.hints.credentialIds.some((c) => rootCredentialSet.has(c))
    ) {
      shared.push('credentialIds');
    }
    if (
      input.rootHints.sourceReferenceId &&
      candidate.hints.sourceReferenceId &&
      input.rootHints.sourceReferenceId === candidate.hints.sourceReferenceId
    ) {
      shared.push('sourceReferenceId');
    }
    if (shared.length > 0) {
      edges.push({ capsuleId: candidate.capsuleId, sharedHints: shared });
    }
  }

  return {
    schema: 'vitalcv.replay-corruption-lineage.v1',
    rootCapsuleId: input.rootCapsuleId,
    rootHints: input.rootHints,
    contaminationEdges: edges,
    classifiedAt: nowIso(),
  };
}

/**
 * Institutional replay search + discovery (W2-PR76A).
 *
 * Pure deterministic index over a sealed ledger + archive. Queries are
 * ambiguity-aware: a query that filters by replay state MUST explicitly
 * declare whether R-AMBIGUOUS rows are included; the default is INCLUDED
 * (fail-closed against silent ambiguity erasure).
 *
 * Lineage citation: every result carries the source epochHash + sequence
 * index so the caller can re-derive the underlying evidence.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import type { SealedGovernanceLedger, SealedGovernanceEpoch } from "./tamper-evident-persistence.js";

// ---------------------------------------------------------------------------
// Index shape
// ---------------------------------------------------------------------------

export interface ReplaySearchIndex {
  readonly indexVersion: 1;
  readonly capturedAt: string;
  readonly entries: readonly IndexEntry[];
  readonly indexHash: string;
}

export interface IndexEntry {
  readonly sequenceIndex: number;
  readonly epochHash: string;
  readonly observedAt: string;
  readonly hasReplayAmbiguous: boolean;
  readonly hasReplayCollapsed: boolean;
  readonly hasIntegrityDegraded: boolean;
  readonly hasContainmentDegraded: boolean;
  readonly hasContradiction: boolean;
  readonly aggregateConfidence: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function buildReplaySearchIndex(
  sealed: SealedGovernanceLedger,
  capturedAt: string,
): ReplaySearchIndex {
  const entries: IndexEntry[] = sealed.sealed.map((s: SealedGovernanceEpoch) => Object.freeze({
    sequenceIndex: s.sequenceIndex,
    epochHash: s.epochHash,
    observedAt: s.epoch.observedAt,
    hasReplayAmbiguous: s.epoch.replayAmbiguousCount > 0,
    hasReplayCollapsed: s.epoch.replayCollapsedCount > 0,
    hasIntegrityDegraded: s.epoch.integrityDegradedCount > 0,
    hasContainmentDegraded: s.epoch.containmentDegradedCount > 0,
    hasContradiction: s.epoch.contradictionCount > 0,
    aggregateConfidence: s.epoch.aggregateVerificationConfidence,
  }));
  const preHash = {
    indexVersion: 1 as const,
    capturedAt,
    entries,
  };
  return Object.freeze({
    ...preHash,
    indexHash: sha256Hex(canonicalize(preHash)),
  });
}

// ---------------------------------------------------------------------------
// Query semantics
// ---------------------------------------------------------------------------

export interface ReplaySearchQuery {
  /** Time-window filter (inclusive). */
  readonly fromIso?: string;
  readonly toIso?: string;
  readonly hasReplayAmbiguous?: boolean;
  readonly hasReplayCollapsed?: boolean;
  readonly hasIntegrityDegraded?: boolean;
  readonly hasContainmentDegraded?: boolean;
  readonly aggregateConfidenceIn?: readonly string[];
  /**
   * Whether R-AMBIGUOUS-bearing rows are included in the result. DEFAULT
   * IS true (fail-closed against silent ambiguity erasure). To intentionally
   * exclude, the caller MUST pass false explicitly.
   */
  readonly includeAmbiguous?: boolean;
}

export interface ReplaySearchResult {
  readonly query: ReplaySearchQuery;
  readonly matchedEntries: readonly IndexEntry[];
  /** Number of entries elided ONLY because includeAmbiguous=false. */
  readonly ambiguousElidedCount: number;
  /** True if at least one ambiguous result was elided — surface to UI. */
  readonly elidedAmbiguityVisible: boolean;
  readonly resultHash: string;
}

export function searchReplay(
  index: ReplaySearchIndex,
  query: ReplaySearchQuery,
): ReplaySearchResult {
  const includeAmbig = query.includeAmbiguous !== false; // default true
  const matched: IndexEntry[] = [];
  let elided = 0;
  for (const e of index.entries) {
    if (query.fromIso && Date.parse(e.observedAt) < Date.parse(query.fromIso)) continue;
    if (query.toIso && Date.parse(e.observedAt) > Date.parse(query.toIso)) continue;
    if (query.hasReplayAmbiguous !== undefined && e.hasReplayAmbiguous !== query.hasReplayAmbiguous) continue;
    if (query.hasReplayCollapsed !== undefined && e.hasReplayCollapsed !== query.hasReplayCollapsed) continue;
    if (query.hasIntegrityDegraded !== undefined && e.hasIntegrityDegraded !== query.hasIntegrityDegraded) continue;
    if (query.hasContainmentDegraded !== undefined && e.hasContainmentDegraded !== query.hasContainmentDegraded) continue;
    if (query.aggregateConfidenceIn && !query.aggregateConfidenceIn.includes(e.aggregateConfidence)) continue;
    if (!includeAmbig && e.hasReplayAmbiguous) {
      elided += 1;
      continue;
    }
    matched.push(e);
  }
  const resultHash = sha256Hex(canonicalize({ query, matched, elided }));
  return Object.freeze({
    query,
    matchedEntries: Object.freeze(matched),
    ambiguousElidedCount: elided,
    elidedAmbiguityVisible: elided > 0,
    resultHash,
  });
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export type SearchViolation =
  | { readonly tag: "result-hash-mismatch"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "silent-ambiguity-elision"; readonly elidedCount: number }
  | { readonly tag: "index-hash-mismatch"; readonly recorded: string; readonly recomputed: string };

export function verifySearchResult(
  index: ReplaySearchIndex,
  result: ReplaySearchResult,
): readonly SearchViolation[] {
  const violations: SearchViolation[] = [];
  // Recompute result against current index
  const recomputed = searchReplay(index, result.query);
  if (recomputed.resultHash !== result.resultHash) {
    violations.push({
      tag: "result-hash-mismatch",
      recorded: result.resultHash,
      recomputed: recomputed.resultHash,
    });
  }
  // Silent elision: if ambiguous rows were excluded but elidedAmbiguityVisible=false
  if (result.ambiguousElidedCount > 0 && !result.elidedAmbiguityVisible) {
    violations.push({ tag: "silent-ambiguity-elision", elidedCount: result.ambiguousElidedCount });
  }
  return violations;
}

export function verifyReplaySearchIndex(
  sealed: SealedGovernanceLedger,
  index: ReplaySearchIndex,
): readonly SearchViolation[] {
  const violations: SearchViolation[] = [];
  const recomputed = buildReplaySearchIndex(sealed, index.capturedAt);
  if (recomputed.indexHash !== index.indexHash) {
    violations.push({
      tag: "index-hash-mismatch",
      recorded: index.indexHash,
      recomputed: recomputed.indexHash,
    });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export interface ReplaySearchReport {
  readonly executedAt: string;
  readonly entriesIndexed: number;
  readonly violations: readonly SearchViolation[];
  readonly hasCiGatingCondition: boolean;
}

export function buildReplaySearchReport(
  sealed: SealedGovernanceLedger,
  index: ReplaySearchIndex,
  results: readonly ReplaySearchResult[],
  nowIso: string,
): ReplaySearchReport {
  const violations: SearchViolation[] = [];
  for (const v of verifyReplaySearchIndex(sealed, index)) violations.push(v);
  for (const r of results) {
    for (const v of verifySearchResult(index, r)) violations.push(v);
  }
  return Object.freeze({
    executedAt: nowIso,
    entriesIndexed: index.entries.length,
    violations: Object.freeze(violations),
    hasCiGatingCondition: violations.length > 0,
  });
}

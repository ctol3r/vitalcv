/**
 * Production replay snapshotting (W2-PR103A).
 *
 * Distinct from the W2-PR32A `GovernanceSnapshot` (tamper-evident
 * ledger snapshot, one-shot) and W2-PR66A `ArchivedEpochEnvelope`
 * (per-epoch schema-migration archival): this layer is the
 * production-side checkpoint chain that supports institutional
 * recovery, rollback, and audit continuity over a deployed system's
 * lifetime.
 *
 * A `ProductionSnapshot` wraps a (sealed ledger, governance snapshot)
 * pair with:
 *   - a chain pointer to its parent (rollback lineage)
 *   - a `restorationCheckpoint: boolean` flag marking known-good
 *     restoration points
 *   - a `productionLabel` (release tag / deployment id)
 *   - a deterministic snapshotId hash binding all of the above
 *
 * Drift detection compares two snapshots and surfaces field-level
 * deltas + replay-state divergence + ambiguity-erasure attempts.
 *
 * Lexicon-aligned: snapshots are "tamper-evident given DB integrity"
 * + "audit-traceable lineage". This is not a substrate guarantee.
 */

import { createHash } from "node:crypto";
import { canonicalize, type GovernanceSnapshot, type SealedGovernanceLedger } from "./tamper-evident-persistence.js";

// ---------------------------------------------------------------------------
// ProductionSnapshot
// ---------------------------------------------------------------------------

/** Sentinel parent id for the first production snapshot. */
export const ROOT_PRODUCTION_PARENT = "ROOT" as const;

export interface ProductionSnapshot {
  readonly snapshotId: string;
  readonly parentSnapshotId: string;
  readonly capturedAt: string;
  readonly productionLabel: string;
  readonly restorationCheckpoint: boolean;
  /** ledger head hash from the sealed ledger this snapshot describes. */
  readonly ledgerHeadHash: string;
  readonly ledgerLength: number;
  /** Hash of the underlying GovernanceSnapshot (W2-PR32A). */
  readonly governanceSnapshotHash: string;
  /** Total replay-ambiguous observations across the ledger window. */
  readonly totalReplayAmbiguous: number;
  /** Total replay-collapsed observations across the ledger window. */
  readonly totalReplayCollapsed: number;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Compute the deterministic snapshotId. Pure: identical input ⇒
 * identical id, so re-snapshotting the same state is idempotent.
 */
export function computeProductionSnapshotId(input: {
  readonly parentSnapshotId: string;
  readonly capturedAt: string;
  readonly productionLabel: string;
  readonly restorationCheckpoint: boolean;
  readonly ledgerHeadHash: string;
  readonly ledgerLength: number;
  readonly governanceSnapshotHash: string;
  readonly totalReplayAmbiguous: number;
  readonly totalReplayCollapsed: number;
}): string {
  return sha256Hex(canonicalize(input));
}

/**
 * Build a production snapshot from the underlying tamper-evident
 * snapshot + sealed ledger. Pure transform.
 */
export function buildProductionSnapshot(input: {
  readonly parentSnapshotId: string;
  readonly capturedAt: string;
  readonly productionLabel: string;
  readonly restorationCheckpoint: boolean;
  readonly governanceSnapshot: GovernanceSnapshot;
  readonly sealed: SealedGovernanceLedger;
}): ProductionSnapshot {
  let totalAmbig = 0;
  let totalCollapsed = 0;
  for (const s of input.sealed.sealed) {
    totalAmbig += s.epoch.replayAmbiguousCount;
    totalCollapsed += s.epoch.replayCollapsedCount;
  }
  const preId = {
    parentSnapshotId: input.parentSnapshotId,
    capturedAt: input.capturedAt,
    productionLabel: input.productionLabel,
    restorationCheckpoint: input.restorationCheckpoint,
    ledgerHeadHash: input.governanceSnapshot.ledgerHeadHash,
    ledgerLength: input.governanceSnapshot.ledgerLength,
    governanceSnapshotHash: input.governanceSnapshot.snapshotHash,
    totalReplayAmbiguous: totalAmbig,
    totalReplayCollapsed: totalCollapsed,
  } as const;
  const snapshotId = computeProductionSnapshotId(preId);
  return Object.freeze({
    ...preId,
    snapshotId,
  });
}

// ---------------------------------------------------------------------------
// Snapshot lineage
// ---------------------------------------------------------------------------

export interface SnapshotChain {
  readonly snapshots: readonly ProductionSnapshot[];
}

export const emptySnapshotChain = (): SnapshotChain =>
  Object.freeze({ snapshots: Object.freeze([]) });

/**
 * Append a production snapshot to the chain. Enforces:
 *   - first snapshot's parent must be ROOT_PRODUCTION_PARENT
 *   - subsequent snapshot's parent must equal the prior snapshotId
 *   - timestamps must be monotonically non-decreasing
 *   - ledgerLength must be monotonically non-decreasing (append-only
 *     production state)
 */
export function appendProductionSnapshot(
  chain: SnapshotChain,
  snap: ProductionSnapshot,
): SnapshotChain {
  const last = chain.snapshots[chain.snapshots.length - 1];
  if (!last) {
    if (snap.parentSnapshotId !== ROOT_PRODUCTION_PARENT) {
      throw new Error(`appendProductionSnapshot: first snapshot must have parent=ROOT, got ${snap.parentSnapshotId}`);
    }
  } else {
    if (snap.parentSnapshotId !== last.snapshotId) {
      throw new Error(`appendProductionSnapshot: parent mismatch; expected ${last.snapshotId}, got ${snap.parentSnapshotId}`);
    }
    if (Date.parse(snap.capturedAt) < Date.parse(last.capturedAt)) {
      throw new Error(`appendProductionSnapshot: out-of-order timestamp (${snap.capturedAt} < ${last.capturedAt})`);
    }
    if (snap.ledgerLength < last.ledgerLength) {
      throw new Error(`appendProductionSnapshot: ledger length regressed (${snap.ledgerLength} < ${last.ledgerLength})`);
    }
  }
  return Object.freeze({ snapshots: Object.freeze([...chain.snapshots, snap]) });
}

// ---------------------------------------------------------------------------
// Restoration checkpoint discovery
// ---------------------------------------------------------------------------

/**
 * Find the most recent restoration checkpoint at-or-before the given
 * snapshotId. Returns null if no checkpoint exists.
 */
export function findRestorationCheckpoint(
  chain: SnapshotChain,
  beforeSnapshotId: string | null = null,
): ProductionSnapshot | null {
  let stopAfterFinding = false;
  for (let i = chain.snapshots.length - 1; i >= 0; i--) {
    const s = chain.snapshots[i]!;
    if (beforeSnapshotId !== null && s.snapshotId === beforeSnapshotId) {
      stopAfterFinding = true; // stop searching beyond this point
    }
    if (beforeSnapshotId === null || stopAfterFinding) {
      if (s.restorationCheckpoint) return s;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------

export interface SnapshotDrift {
  readonly fromSnapshotId: string;
  readonly toSnapshotId: string;
  readonly ledgerLengthDelta: number;
  readonly replayAmbiguousDelta: number;
  readonly replayCollapsedDelta: number;
  readonly headHashChanged: boolean;
  readonly governanceSnapshotChanged: boolean;
  readonly productionLabelChanged: boolean;
  readonly checkpointStateChanged: boolean;
}

export function detectSnapshotDrift(
  fromSnap: ProductionSnapshot,
  toSnap: ProductionSnapshot,
): SnapshotDrift {
  return Object.freeze({
    fromSnapshotId: fromSnap.snapshotId,
    toSnapshotId: toSnap.snapshotId,
    ledgerLengthDelta: toSnap.ledgerLength - fromSnap.ledgerLength,
    replayAmbiguousDelta: toSnap.totalReplayAmbiguous - fromSnap.totalReplayAmbiguous,
    replayCollapsedDelta: toSnap.totalReplayCollapsed - fromSnap.totalReplayCollapsed,
    headHashChanged: fromSnap.ledgerHeadHash !== toSnap.ledgerHeadHash,
    governanceSnapshotChanged: fromSnap.governanceSnapshotHash !== toSnap.governanceSnapshotHash,
    productionLabelChanged: fromSnap.productionLabel !== toSnap.productionLabel,
    checkpointStateChanged: fromSnap.restorationCheckpoint !== toSnap.restorationCheckpoint,
  });
}

// ---------------------------------------------------------------------------
// Restoration verifier — what would happen if we rolled back?
// ---------------------------------------------------------------------------

export interface RestorationPlan {
  readonly fromSnapshotId: string; // current head
  readonly toSnapshotId: string; // target restoration point
  readonly epochsRolledBack: number;
  readonly replayAmbiguousLost: number;
  readonly replayCollapsedLost: number;
  /**
   * True iff the rollback would erase R-AMBIGUOUS observations. Per
   * rule "ambiguity preserved during restoration" — caller MUST surface
   * this in operator UI before approving rollback.
   */
  readonly ambiguityErasureRisk: boolean;
}

export function planRestoration(
  chain: SnapshotChain,
  toSnapshotId: string,
): RestorationPlan {
  const head = chain.snapshots[chain.snapshots.length - 1];
  if (!head) {
    throw new Error("planRestoration: empty chain");
  }
  const target = chain.snapshots.find((s) => s.snapshotId === toSnapshotId);
  if (!target) {
    throw new Error(`planRestoration: target snapshot ${toSnapshotId} not in chain`);
  }
  const epochsRolledBack = head.ledgerLength - target.ledgerLength;
  const replayAmbiguousLost = head.totalReplayAmbiguous - target.totalReplayAmbiguous;
  const replayCollapsedLost = head.totalReplayCollapsed - target.totalReplayCollapsed;
  return Object.freeze({
    fromSnapshotId: head.snapshotId,
    toSnapshotId: target.snapshotId,
    epochsRolledBack,
    replayAmbiguousLost,
    replayCollapsedLost,
    ambiguityErasureRisk: replayAmbiguousLost > 0,
  });
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export type SnapshotChainViolation =
  | { readonly tag: "snapshot-id-mismatch"; readonly index: number; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "broken-parent-chain"; readonly index: number; readonly expectedParent: string; readonly actualParent: string }
  | { readonly tag: "ledger-length-regression"; readonly index: number; readonly priorLength: number; readonly currentLength: number }
  | { readonly tag: "no-restoration-checkpoint"; readonly chainLength: number };

export interface ProductionSnapshotReport {
  readonly executedAt: string;
  readonly chainLength: number;
  readonly violations: readonly SnapshotChainViolation[];
  readonly mostRecentCheckpointId: string | null;
  readonly hasCiGatingCondition: boolean;
}

export function buildProductionSnapshotReport(
  chain: SnapshotChain,
  nowIso: string,
  options: { readonly requireCheckpointEvery?: number } = {},
): ProductionSnapshotReport {
  const violations: SnapshotChainViolation[] = [];
  for (let i = 0; i < chain.snapshots.length; i++) {
    const s = chain.snapshots[i]!;
    // Recompute snapshotId
    const recomputed = computeProductionSnapshotId({
      parentSnapshotId: s.parentSnapshotId,
      capturedAt: s.capturedAt,
      productionLabel: s.productionLabel,
      restorationCheckpoint: s.restorationCheckpoint,
      ledgerHeadHash: s.ledgerHeadHash,
      ledgerLength: s.ledgerLength,
      governanceSnapshotHash: s.governanceSnapshotHash,
      totalReplayAmbiguous: s.totalReplayAmbiguous,
      totalReplayCollapsed: s.totalReplayCollapsed,
    });
    if (recomputed !== s.snapshotId) {
      violations.push({
        tag: "snapshot-id-mismatch",
        index: i,
        recorded: s.snapshotId,
        recomputed,
      });
    }
    // Parent chain
    const expectedParent = i === 0 ? ROOT_PRODUCTION_PARENT : chain.snapshots[i - 1]!.snapshotId;
    if (s.parentSnapshotId !== expectedParent) {
      violations.push({
        tag: "broken-parent-chain",
        index: i,
        expectedParent,
        actualParent: s.parentSnapshotId,
      });
    }
    // Ledger length monotonic
    if (i > 0) {
      const prev = chain.snapshots[i - 1]!;
      if (s.ledgerLength < prev.ledgerLength) {
        violations.push({
          tag: "ledger-length-regression",
          index: i,
          priorLength: prev.ledgerLength,
          currentLength: s.ledgerLength,
        });
      }
    }
  }

  const checkpoint = findRestorationCheckpoint(chain);
  const requireEvery = options.requireCheckpointEvery;
  if (
    requireEvery !== undefined &&
    chain.snapshots.length >= requireEvery &&
    checkpoint === null
  ) {
    violations.push({ tag: "no-restoration-checkpoint", chainLength: chain.snapshots.length });
  }

  return Object.freeze({
    executedAt: nowIso,
    chainLength: chain.snapshots.length,
    violations: Object.freeze(violations),
    mostRecentCheckpointId: checkpoint?.snapshotId ?? null,
    hasCiGatingCondition: violations.length > 0,
  });
}

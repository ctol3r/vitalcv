/**
 * Tamper-evident governance persistence (W2-PR32A).
 *
 * Builds a hash-linked chain layer over the W2-PR30A append-only
 * GovernanceLedger. Each epoch is sealed with:
 *   - epochHash:        SHA-256 of canonical(epoch + previousEpochHash)
 *   - previousEpochHash: prior epochHash, or GENESIS sentinel
 *
 * The wording here follows TRUST_GUARANTEE_LEXICON.md: this layer is
 * "tamper-evident given DB integrity" and "hash-checked" — it does NOT
 * provide cryptographically-guaranteed non-repudiation. Anyone with write
 * access to the persistence substrate can rewrite the chain; the value of
 * this layer is that downstream verification will surface the rewrite.
 *
 * Pure transforms. No fetches. No DB writes. Persistence is the caller's
 * responsibility (file, DB, content-addressed store).
 *
 * Non-negotiable rules (W2-PR32A):
 *   1. Governance history must remain append-only.
 *   2. Replay history may not be rewritten.
 *   3. Ambiguity history may not disappear silently.
 *   4. Confidence trajectories must remain historically reconstructable.
 *   5. Snapshot replay must remain deterministic.
 *   6. Tampering must remain detectable.
 *   7. Missing history must degrade trust confidence.
 */

import { createHash } from "node:crypto";

import {
  appendEpoch,
  buildInstitutionalDriftReport,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
  type InstitutionalDriftReport,
} from "./longitudinal-memory.js";

// ---------------------------------------------------------------------------
// Constants & canonical serialization
// ---------------------------------------------------------------------------

/** Sentinel previousEpochHash for the genesis (first) epoch. */
export const GENESIS_HASH = "GENESIS";

/** Hash algorithm used throughout this module. */
const HASH_ALGO = "sha256";

/**
 * Canonical JSON serialization: keys sorted recursively. Required so that
 * two semantically-equal epochs always hash identically regardless of
 * key insertion order.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalize: non-finite numbers are not representable");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined) continue; // omit undefined for canonical stability
      parts.push(JSON.stringify(k) + ":" + canonicalize(v));
    }
    return "{" + parts.join(",") + "}";
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}

function sha256Hex(s: string): string {
  return createHash(HASH_ALGO).update(s, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// TARGET 1 — Hash-linked epochs
// ---------------------------------------------------------------------------

export interface SealedGovernanceEpoch {
  readonly epoch: GovernanceEpoch;
  readonly previousEpochHash: string; // GENESIS_HASH for first
  readonly epochHash: string;
  readonly sequenceIndex: number;
}

export interface SealedGovernanceLedger {
  readonly sealed: readonly SealedGovernanceEpoch[];
}

export const emptySealedLedger = (): SealedGovernanceLedger =>
  Object.freeze({ sealed: Object.freeze([]) });

/**
 * Compute the canonical hash for an epoch given the previous-epoch hash.
 * Pure; deterministic.
 */
export function computeEpochHash(epoch: GovernanceEpoch, previousEpochHash: string): string {
  const payload = canonicalize({
    epoch,
    previousEpochHash,
  });
  return sha256Hex(payload);
}

/**
 * Seal a single epoch onto an existing sealed ledger. Order-enforced
 * (rejects out-of-order observation timestamps).
 */
export function sealEpoch(
  ledger: SealedGovernanceLedger,
  epoch: GovernanceEpoch,
): SealedGovernanceLedger {
  const last = ledger.sealed[ledger.sealed.length - 1];
  if (last && Date.parse(epoch.observedAt) < Date.parse(last.epoch.observedAt)) {
    throw new Error(
      `sealEpoch: out-of-order epoch (${epoch.observedAt} < ${last.epoch.observedAt}); ledger is append-only`,
    );
  }
  const previousEpochHash = last ? last.epochHash : GENESIS_HASH;
  const epochHash = computeEpochHash(epoch, previousEpochHash);
  const sealedEpoch: SealedGovernanceEpoch = Object.freeze({
    epoch,
    previousEpochHash,
    epochHash,
    sequenceIndex: ledger.sealed.length,
  });
  return Object.freeze({ sealed: Object.freeze([...ledger.sealed, sealedEpoch]) });
}

/** Seal an unsealed GovernanceLedger in one shot. */
export function sealLedger(ledger: GovernanceLedger): SealedGovernanceLedger {
  let out = emptySealedLedger();
  for (const e of ledger.epochs) out = sealEpoch(out, e);
  return out;
}

/** Project sealed → unsealed (drops chain metadata; for replay reconstruction). */
export function unsealLedger(sealed: SealedGovernanceLedger): GovernanceLedger {
  let out = emptyLedger();
  for (const s of sealed.sealed) out = appendEpoch(out, s.epoch);
  return out;
}

// ---------------------------------------------------------------------------
// TARGET 4 — Tamper validators
// ---------------------------------------------------------------------------

export type TamperFinding =
  | {
      readonly tag: "broken-genesis";
      readonly sequenceIndex: number;
      readonly expectedPrevious: string;
      readonly actualPrevious: string;
    }
  | {
      readonly tag: "broken-chain";
      readonly sequenceIndex: number;
      readonly expectedPrevious: string;
      readonly actualPrevious: string;
    }
  | {
      readonly tag: "epoch-hash-mismatch";
      readonly sequenceIndex: number;
      readonly recordedHash: string;
      readonly recomputedHash: string;
    }
  | {
      readonly tag: "out-of-order-timestamps";
      readonly sequenceIndex: number;
      readonly previousObservedAt: string;
      readonly observedAt: string;
    }
  | {
      readonly tag: "duplicate-sequence-index";
      readonly sequenceIndex: number;
    }
  | {
      readonly tag: "missing-sequence-index";
      readonly expected: number;
      readonly actual: number;
    }
  | {
      readonly tag: "snapshot-divergence";
      readonly field: string;
      readonly expected: string;
      readonly actual: string;
    };

/**
 * Verify an entire sealed ledger:
 *   - first epoch's previousEpochHash must equal GENESIS_HASH
 *   - each subsequent epoch's previousEpochHash must equal the prior epochHash
 *   - each epoch's epochHash must equal computeEpochHash(epoch, previousEpochHash)
 *   - timestamps must be monotonically non-decreasing
 *   - sequenceIndex must be 0..N-1, no duplicates, no gaps
 *
 * Returns array of findings; empty = clean.
 */
export function verifySealedChain(
  ledger: SealedGovernanceLedger,
): readonly TamperFinding[] {
  const findings: TamperFinding[] = [];
  const seenIndices = new Set<number>();

  for (let i = 0; i < ledger.sealed.length; i++) {
    const cur = ledger.sealed[i]!;
    // Sequence index integrity
    if (cur.sequenceIndex !== i) {
      findings.push({
        tag: "missing-sequence-index",
        expected: i,
        actual: cur.sequenceIndex,
      });
    }
    if (seenIndices.has(cur.sequenceIndex)) {
      findings.push({ tag: "duplicate-sequence-index", sequenceIndex: cur.sequenceIndex });
    }
    seenIndices.add(cur.sequenceIndex);

    // Chain link
    const expectedPrev = i === 0 ? GENESIS_HASH : ledger.sealed[i - 1]!.epochHash;
    if (cur.previousEpochHash !== expectedPrev) {
      findings.push({
        tag: i === 0 ? "broken-genesis" : "broken-chain",
        sequenceIndex: i,
        expectedPrevious: expectedPrev,
        actualPrevious: cur.previousEpochHash,
      });
    }

    // Hash recomputation
    const recomputed = computeEpochHash(cur.epoch, cur.previousEpochHash);
    if (recomputed !== cur.epochHash) {
      findings.push({
        tag: "epoch-hash-mismatch",
        sequenceIndex: i,
        recordedHash: cur.epochHash,
        recomputedHash: recomputed,
      });
    }

    // Timestamp monotonicity
    if (i > 0) {
      const prev = ledger.sealed[i - 1]!;
      if (Date.parse(cur.epoch.observedAt) < Date.parse(prev.epoch.observedAt)) {
        findings.push({
          tag: "out-of-order-timestamps",
          sequenceIndex: i,
          previousObservedAt: prev.epoch.observedAt,
          observedAt: cur.epoch.observedAt,
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// TARGET 2 — Signed snapshots
// ---------------------------------------------------------------------------

/**
 * Full governance state capture at a point in time. Deterministic given
 * a (sealed ledger, nowIso, optional drift options).
 */
export interface GovernanceSnapshot {
  readonly snapshotVersion: 1;
  readonly capturedAt: string;
  readonly ledgerLength: number;
  readonly ledgerHeadHash: string; // last epochHash, or GENESIS_HASH if empty
  readonly ledgerCanonicalHash: string; // hash over the entire sealed sequence
  readonly driftReport: InstitutionalDriftReport;
  readonly snapshotHash: string; // hash over all preceding fields
}

/**
 * Compute a deterministic snapshot.
 *
 * `nowIso` is the evaluation instant for the drift report; it is also
 * captured in `capturedAt` so the snapshot is reproducible from the same
 * inputs.
 */
export function captureGovernanceSnapshot(
  ledger: SealedGovernanceLedger,
  nowIso: string,
): GovernanceSnapshot {
  // Validate the chain first; tampering invalidates the snapshot.
  // Caller may still capture and inspect; downstream verifySnapshot will
  // catch it via ledgerCanonicalHash mismatch on rebuild.

  const ledgerHeadHash =
    ledger.sealed.length === 0
      ? GENESIS_HASH
      : ledger.sealed[ledger.sealed.length - 1]!.epochHash;

  const ledgerCanonicalHash = sha256Hex(
    canonicalize(ledger.sealed.map((s) => ({
      sequenceIndex: s.sequenceIndex,
      previousEpochHash: s.previousEpochHash,
      epochHash: s.epochHash,
      epoch: s.epoch,
    }))),
  );

  const driftReport = buildInstitutionalDriftReport(unsealLedger(ledger), nowIso);

  const preHashShape = {
    snapshotVersion: 1 as const,
    capturedAt: nowIso,
    ledgerLength: ledger.sealed.length,
    ledgerHeadHash,
    ledgerCanonicalHash,
    driftReport,
  };
  const snapshotHash = sha256Hex(canonicalize(preHashShape));

  return Object.freeze({
    ...preHashShape,
    snapshotHash,
  });
}

/**
 * Verify a snapshot against the sealed ledger it claims to describe.
 *
 * Returns findings (empty = clean). Detects:
 *   - ledgerHeadHash mismatch
 *   - ledgerCanonicalHash mismatch (mutation anywhere in the chain)
 *   - ledgerLength mismatch
 *   - snapshotHash mismatch (snapshot itself was edited)
 *   - drift report divergence (drift was rewritten without updating snapshot)
 */
export function verifySnapshot(
  snapshot: GovernanceSnapshot,
  ledger: SealedGovernanceLedger,
): readonly TamperFinding[] {
  const findings: TamperFinding[] = [];

  // Recompute snapshotHash to detect direct snapshot mutation
  const recomputedSnapshotHash = sha256Hex(
    canonicalize({
      snapshotVersion: snapshot.snapshotVersion,
      capturedAt: snapshot.capturedAt,
      ledgerLength: snapshot.ledgerLength,
      ledgerHeadHash: snapshot.ledgerHeadHash,
      ledgerCanonicalHash: snapshot.ledgerCanonicalHash,
      driftReport: snapshot.driftReport,
    }),
  );
  if (recomputedSnapshotHash !== snapshot.snapshotHash) {
    findings.push({
      tag: "snapshot-divergence",
      field: "snapshotHash",
      expected: recomputedSnapshotHash,
      actual: snapshot.snapshotHash,
    });
  }

  if (snapshot.ledgerLength !== ledger.sealed.length) {
    findings.push({
      tag: "snapshot-divergence",
      field: "ledgerLength",
      expected: String(ledger.sealed.length),
      actual: String(snapshot.ledgerLength),
    });
  }

  const expectedHead =
    ledger.sealed.length === 0
      ? GENESIS_HASH
      : ledger.sealed[ledger.sealed.length - 1]!.epochHash;
  if (snapshot.ledgerHeadHash !== expectedHead) {
    findings.push({
      tag: "snapshot-divergence",
      field: "ledgerHeadHash",
      expected: expectedHead,
      actual: snapshot.ledgerHeadHash,
    });
  }

  const expectedCanonical = sha256Hex(
    canonicalize(ledger.sealed.map((s) => ({
      sequenceIndex: s.sequenceIndex,
      previousEpochHash: s.previousEpochHash,
      epochHash: s.epochHash,
      epoch: s.epoch,
    }))),
  );
  if (snapshot.ledgerCanonicalHash !== expectedCanonical) {
    findings.push({
      tag: "snapshot-divergence",
      field: "ledgerCanonicalHash",
      expected: expectedCanonical,
      actual: snapshot.ledgerCanonicalHash,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// TARGET 3 — Ledger replay verification
// ---------------------------------------------------------------------------

export interface ReplayVerificationResult {
  readonly verifiedAt: string;
  readonly ledgerLength: number;
  readonly chainFindings: readonly TamperFinding[];
  readonly snapshotFindings: readonly TamperFinding[];
  /**
   * True iff:
   *   - chain verification produced 0 findings
   *   - snapshot verification produced 0 findings
   *   - replay-derived drift report matches the snapshot's report exactly
   */
  readonly replayDeterministic: boolean;
  /** True iff any tamper-evidence failure is present. */
  readonly hasTamperEvidence: boolean;
}

/**
 * Replay-verify a sealed ledger against a previously captured snapshot.
 *
 * Reconstructs the drift report from the (sealed → unsealed) ledger using
 * the snapshot's `capturedAt` as `nowIso`. If the resulting report's
 * canonical hash does not match the snapshot's embedded report's canonical
 * hash, replay is non-deterministic ⇒ tampering detected.
 */
export function replayVerifyLedger(
  ledger: SealedGovernanceLedger,
  snapshot: GovernanceSnapshot,
): ReplayVerificationResult {
  const chainFindings = verifySealedChain(ledger);
  const snapshotFindings = verifySnapshot(snapshot, ledger);

  const reconstructed = buildInstitutionalDriftReport(
    unsealLedger(ledger),
    snapshot.capturedAt,
  );
  const reconstructedHash = sha256Hex(canonicalize(reconstructed));
  const expectedHash = sha256Hex(canonicalize(snapshot.driftReport));

  const replayDeterministic =
    chainFindings.length === 0 &&
    snapshotFindings.length === 0 &&
    reconstructedHash === expectedHash;

  const allFindings: TamperFinding[] = [...snapshotFindings];
  if (reconstructedHash !== expectedHash) {
    allFindings.push({
      tag: "snapshot-divergence",
      field: "driftReport",
      expected: expectedHash,
      actual: reconstructedHash,
    });
  }

  return Object.freeze({
    verifiedAt: snapshot.capturedAt,
    ledgerLength: ledger.sealed.length,
    chainFindings,
    snapshotFindings: Object.freeze(allFindings),
    replayDeterministic,
    hasTamperEvidence: chainFindings.length > 0 || allFindings.length > 0,
  });
}

// ---------------------------------------------------------------------------
// TARGET 7 — CI gate report
// ---------------------------------------------------------------------------

export interface PersistenceIntegrityReport {
  readonly executedAt: string;
  readonly ledgerLength: number;
  readonly hasSnapshot: boolean;
  readonly chainFindings: readonly TamperFinding[];
  readonly replayResult: ReplayVerificationResult | null;
  /**
   * True iff any chain finding OR replay non-determinism OR missing snapshot
   * when a non-empty ledger is present (rule #7).
   */
  readonly hasCiGatingCondition: boolean;
}

export function buildPersistenceIntegrityReport(
  ledger: SealedGovernanceLedger,
  snapshot: GovernanceSnapshot | null,
  nowIso: string,
): PersistenceIntegrityReport {
  const chainFindings = verifySealedChain(ledger);
  let replayResult: ReplayVerificationResult | null = null;
  if (snapshot) {
    replayResult = replayVerifyLedger(ledger, snapshot);
  }
  const missingSnapshotForNonEmpty = !snapshot && ledger.sealed.length > 0;

  const gating =
    chainFindings.length > 0 ||
    (replayResult !== null && replayResult.hasTamperEvidence) ||
    missingSnapshotForNonEmpty;

  return Object.freeze({
    executedAt: nowIso,
    ledgerLength: ledger.sealed.length,
    hasSnapshot: snapshot !== null,
    chainFindings,
    replayResult,
    hasCiGatingCondition: gating,
  });
}

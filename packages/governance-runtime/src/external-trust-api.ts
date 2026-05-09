/**
 * External trust API contracts (W2-PR37A).
 *
 * Defines the deterministic, audit-traceable, ambiguity-preserving export
 * shapes that external verifiers consume. These are PURE schemas + builder
 * functions — no HTTP layer here. The web/api packages are responsible
 * for routing; this module guarantees the response shapes are correct.
 *
 * Lexicon-aligned wording: hash-checked exports; tamper-evident given DB
 * integrity; replay observability + best-effort idempotency check via
 * correlationId.
 *
 * Non-negotiable rules (W2-PR37A):
 *   - replay-safe APIs (idempotent given a request id)
 *   - deterministic exports (canonicalized, content-addressed by hash)
 *   - ambiguity-preserving responses (R-AMBIGUOUS surfaces as a state)
 *   - fail-closed verification semantics
 *   - audit-verifiable lineage
 *   - replay continuity externally reconstructable
 */

import { createHash } from "node:crypto";

import type { GovernanceEpoch, GovernanceLedger } from "./longitudinal-memory.js";
import type { ReplayState } from "./replay-state.js";
import { canonicalize, type SealedGovernanceLedger, type GovernanceSnapshot, GENESIS_HASH } from "./tamper-evident-persistence.js";
import { buildReplaySurvivabilityReport, type ReplaySurvivabilityReport } from "./replay-survivability.js";

// ---------------------------------------------------------------------------
// API contract version + envelope
// ---------------------------------------------------------------------------

/** External-trust API version. Increment on breaking schema changes. */
export const EXTERNAL_TRUST_API_VERSION = "v1" as const;
export type ExternalTrustApiVersion = typeof EXTERNAL_TRUST_API_VERSION;

/**
 * Common envelope for every external response.
 *
 * `requestId` is echoed back from the caller; if the caller passes the
 * same id twice, the receipt's `responseHash` is identical (deterministic
 * + replay-safe).
 */
export interface ExternalResponseEnvelope<T> {
  readonly apiVersion: ExternalTrustApiVersion;
  readonly requestId: string;
  readonly emittedAt: string;
  readonly bodyCanonicalHash: string;
  readonly body: T;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Wrap a body into an envelope; body is canonicalized + hashed. */
export function wrapResponse<T>(
  body: T,
  requestId: string,
  emittedAt: string,
): ExternalResponseEnvelope<T> {
  const bodyCanonicalHash = sha256Hex(canonicalize(body));
  return Object.freeze({
    apiVersion: EXTERNAL_TRUST_API_VERSION,
    requestId,
    emittedAt,
    bodyCanonicalHash,
    body,
  });
}

// ---------------------------------------------------------------------------
// TARGET 1 — Governance API contracts
// ---------------------------------------------------------------------------

export interface GovernanceStateExport {
  readonly snapshotHash: string;
  readonly ledgerHeadHash: string;
  readonly ledgerLength: number;
  readonly capturedAt: string;
  readonly aggregateConfidence:
    | "VERIFIED"
    | "PARTIALLY-VERIFIED"
    | "ASSUMED"
    | "UNVERIFIED"
    | "UNKNOWN";
  /** Lexicon-aligned trustworthiness label. */
  readonly trustLabel: string;
}

export function exportGovernanceState(
  snapshot: GovernanceSnapshot,
): GovernanceStateExport {
  const conf = snapshot.driftReport.fatigue.severity === "CRITICAL"
    ? "UNVERIFIED"
    : "PARTIALLY-VERIFIED";
  return Object.freeze({
    snapshotHash: snapshot.snapshotHash,
    ledgerHeadHash: snapshot.ledgerHeadHash,
    ledgerLength: snapshot.ledgerLength,
    capturedAt: snapshot.capturedAt,
    aggregateConfidence: conf,
    trustLabel:
      conf === "UNVERIFIED"
        ? "audit-traceable; UNVERIFIED — chronic instability detected"
        : "audit-traceable; tamper-evident given DB integrity",
  });
}

// ---------------------------------------------------------------------------
// TARGET 2 — Replay verification endpoints
// ---------------------------------------------------------------------------

export interface ReplayVerificationExport {
  readonly windowEpochs: number;
  readonly evidenceBearingEpochs: number;
  readonly survivabilityScore: number;
  readonly confidence:
    | "FULL"
    | "HIGH"
    | "PARTIAL"
    | "LOW"
    | "UNRECONSTRUCTABLE";
  readonly impossibleJumps: number;
  readonly ambiguityPreserved: boolean;
  readonly contributingEpochIndices: readonly number[];
  readonly gapEpochIndices: readonly number[];
  readonly assertedStates: readonly { readonly atIndex: number; readonly state: ReplayState }[];
}

export function exportReplayVerification(
  ledger: GovernanceLedger,
  nowIso: string,
): ReplayVerificationExport {
  const r: ReplaySurvivabilityReport = buildReplaySurvivabilityReport(ledger, nowIso);
  return Object.freeze({
    windowEpochs: r.score.windowEpochs,
    evidenceBearingEpochs: r.score.evidenceBearingEpochs,
    survivabilityScore: r.score.survivabilityScore,
    confidence: r.score.confidence,
    impossibleJumps: r.score.impossibleJumps,
    ambiguityPreserved: r.score.ambiguityPreserved,
    contributingEpochIndices: r.lineage.contributingEpochIndices,
    gapEpochIndices: r.lineage.gapEpochIndices,
    assertedStates: r.lineage.assertedStates,
  });
}

// ---------------------------------------------------------------------------
// TARGET 3 — Audit receipt API
// ---------------------------------------------------------------------------

export interface AuditReceiptInput {
  readonly subjectId: string; // e.g., issuer mutation id
  readonly subjectKind: string; // e.g., "issuer.receipt-candidate"
  readonly observedAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface AuditReceipt {
  readonly receiptId: string; // deterministic hash of canonical input
  readonly subjectId: string;
  readonly subjectKind: string;
  readonly observedAt: string;
  readonly metadataCanonicalHash: string;
  readonly trustLabel: string;
}

/** Produce a deterministic receipt — repeated calls with identical input yield identical receiptId. */
export function buildAuditReceipt(input: AuditReceiptInput): AuditReceipt {
  const canonical = canonicalize({
    subjectId: input.subjectId,
    subjectKind: input.subjectKind,
    observedAt: input.observedAt,
    metadata: input.metadata,
  });
  const receiptId = sha256Hex(canonical);
  const metadataCanonicalHash = sha256Hex(canonicalize(input.metadata));
  return Object.freeze({
    receiptId,
    subjectId: input.subjectId,
    subjectKind: input.subjectKind,
    observedAt: input.observedAt,
    metadataCanonicalHash,
    trustLabel: "audit-traceable; tamper-evident given DB integrity",
  });
}

// ---------------------------------------------------------------------------
// TARGET 4 — External lineage manifests
// ---------------------------------------------------------------------------

export interface ExternalLineageManifest {
  readonly apiVersion: ExternalTrustApiVersion;
  readonly capturedAt: string;
  readonly snapshotHash: string;
  readonly ledgerHeadHash: string;
  readonly ledgerLength: number;
  readonly epochHashes: readonly { readonly sequenceIndex: number; readonly epochHash: string; readonly observedAt: string }[];
  readonly manifestHash: string;
}

export function buildExternalLineageManifest(
  sealed: SealedGovernanceLedger,
  snapshot: GovernanceSnapshot,
): ExternalLineageManifest {
  const epochHashes = sealed.sealed.map((s) =>
    Object.freeze({
      sequenceIndex: s.sequenceIndex,
      epochHash: s.epochHash,
      observedAt: s.epoch.observedAt,
    }),
  );
  const preHash = {
    apiVersion: EXTERNAL_TRUST_API_VERSION,
    capturedAt: snapshot.capturedAt,
    snapshotHash: snapshot.snapshotHash,
    ledgerHeadHash: snapshot.ledgerHeadHash,
    ledgerLength: sealed.sealed.length,
    epochHashes,
  };
  const manifestHash = sha256Hex(canonicalize(preHash));
  return Object.freeze({ ...preHash, manifestHash });
}

/**
 * Verify a previously-issued manifest against a current sealed ledger.
 *
 * Returns array of mismatch reasons; empty = clean. Used by external
 * verifiers to detect that the issuer's history rolled back.
 */
export function verifyExternalLineageManifest(
  manifest: ExternalLineageManifest,
  sealed: SealedGovernanceLedger,
): readonly string[] {
  const mismatches: string[] = [];
  if (manifest.apiVersion !== EXTERNAL_TRUST_API_VERSION) {
    mismatches.push(`apiVersion mismatch: ${manifest.apiVersion} != ${EXTERNAL_TRUST_API_VERSION}`);
  }
  if (manifest.ledgerLength > sealed.sealed.length) {
    mismatches.push(`ledger truncation: manifest claims ${manifest.ledgerLength} epochs, ledger has ${sealed.sealed.length}`);
  }
  for (const m of manifest.epochHashes) {
    const cur = sealed.sealed[m.sequenceIndex];
    if (!cur) {
      mismatches.push(`missing epoch at seqIdx ${m.sequenceIndex}`);
      continue;
    }
    if (cur.epochHash !== m.epochHash) {
      mismatches.push(`hash divergence at seqIdx ${m.sequenceIndex}`);
    }
    if (cur.epoch.observedAt !== m.observedAt) {
      mismatches.push(`observedAt divergence at seqIdx ${m.sequenceIndex}`);
    }
  }
  // Recompute manifestHash to detect direct manifest mutation
  const recomputed = sha256Hex(
    canonicalize({
      apiVersion: manifest.apiVersion,
      capturedAt: manifest.capturedAt,
      snapshotHash: manifest.snapshotHash,
      ledgerHeadHash: manifest.ledgerHeadHash,
      ledgerLength: manifest.ledgerLength,
      epochHashes: manifest.epochHashes,
    }),
  );
  if (recomputed !== manifest.manifestHash) {
    mismatches.push(`manifestHash recomputed mismatch`);
  }
  return mismatches;
}

// ---------------------------------------------------------------------------
// TARGET 5 — Verifier-facing trust schema (validator)
// ---------------------------------------------------------------------------

export type ApiContractError =
  | { readonly tag: "missing-field"; readonly field: string }
  | { readonly tag: "wrong-api-version"; readonly value: string }
  | { readonly tag: "envelope-hash-mismatch"; readonly recorded: string; readonly recomputed: string };

/**
 * Validate that a received envelope is well-formed and self-consistent.
 *
 * External verifiers MUST run this before consuming the body. Fail-closed:
 * any error tag means the response cannot be trusted.
 */
export function validateExternalEnvelope<T>(
  env: Partial<ExternalResponseEnvelope<T>>,
): readonly ApiContractError[] {
  const errors: ApiContractError[] = [];
  for (const f of ["apiVersion", "requestId", "emittedAt", "bodyCanonicalHash", "body"] as const) {
    if (env[f] === undefined) errors.push({ tag: "missing-field", field: f });
  }
  if (env.apiVersion && env.apiVersion !== EXTERNAL_TRUST_API_VERSION) {
    errors.push({ tag: "wrong-api-version", value: String(env.apiVersion) });
  }
  if (env.body !== undefined && env.bodyCanonicalHash) {
    const recomputed = sha256Hex(canonicalize(env.body));
    if (recomputed !== env.bodyCanonicalHash) {
      errors.push({
        tag: "envelope-hash-mismatch",
        recorded: env.bodyCanonicalHash,
        recomputed,
      });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// TARGET 7 — CI gate: verify that the whole API surface returns deterministic
// envelopes and that lineage manifests round-trip.
// ---------------------------------------------------------------------------

export interface ExternalApiAuditReport {
  readonly executedAt: string;
  readonly determinismCheckPassed: boolean;
  readonly manifestRoundTripPassed: boolean;
  readonly receiptDeterminismPassed: boolean;
  readonly findings: readonly string[];
  readonly hasCiGatingCondition: boolean;
}

/**
 * Self-audit: build artifacts twice from identical inputs and compare hashes.
 * Catches non-determinism (e.g., accidental Date.now() in a builder).
 */
export function runExternalApiSelfAudit(
  sealed: SealedGovernanceLedger,
  snapshot: GovernanceSnapshot,
  ledger: GovernanceLedger,
  nowIso: string,
): ExternalApiAuditReport {
  const findings: string[] = [];

  // Determinism: governance state export
  const g1 = exportGovernanceState(snapshot);
  const g2 = exportGovernanceState(snapshot);
  const detPass =
    sha256Hex(canonicalize(g1)) === sha256Hex(canonicalize(g2));
  if (!detPass) findings.push("exportGovernanceState non-deterministic");

  // Manifest round-trip: build → verify → 0 mismatches
  const manifest = buildExternalLineageManifest(sealed, snapshot);
  const verifyOut = verifyExternalLineageManifest(manifest, sealed);
  const mfPass = verifyOut.length === 0;
  if (!mfPass) findings.push(`manifest round-trip failed: ${verifyOut.join(", ")}`);

  // Receipt determinism: same input → same receiptId
  const rcptInput = {
    subjectId: "demo-subject",
    subjectKind: "test",
    observedAt: snapshot.capturedAt,
    metadata: {},
  } as const;
  const r1 = buildAuditReceipt(rcptInput);
  const r2 = buildAuditReceipt(rcptInput);
  const rcptPass = r1.receiptId === r2.receiptId;
  if (!rcptPass) findings.push("buildAuditReceipt non-deterministic");

  // Sanity: replay verification export non-empty for non-empty ledger
  const rv = exportReplayVerification(ledger, nowIso);
  if (ledger.epochs.length > 0 && rv.windowEpochs !== ledger.epochs.length) {
    findings.push("exportReplayVerification windowEpochs mismatch");
  }

  // Snapshot/sealed alignment
  const head = sealed.sealed.length === 0
    ? GENESIS_HASH
    : sealed.sealed[sealed.sealed.length - 1]!.epochHash;
  if (snapshot.ledgerHeadHash !== head) {
    findings.push("snapshot.ledgerHeadHash != sealed head");
  }

  return Object.freeze({
    executedAt: nowIso,
    determinismCheckPassed: detPass,
    manifestRoundTripPassed: mfPass,
    receiptDeterminismPassed: rcptPass,
    findings: Object.freeze(findings),
    hasCiGatingCondition: !detPass || !mfPass || !rcptPass || findings.length > 0,
  });
}

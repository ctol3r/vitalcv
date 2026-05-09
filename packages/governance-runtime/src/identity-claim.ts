/**
 * Clinician identity claim + passport activation (W2-PR43A).
 *
 * Pure data model + validators + lineage. No NPI lookups; the registry
 * NPI value is supplied by the caller (lookup happens at the API edge).
 *
 * Lifecycle:
 *   UNCLAIMED → CLAIM_INITIATED → CLAIM_VERIFIED → ACTIVATED
 *                                              ↓
 *                                        REVOKED  ←  RECLAIM_PENDING
 *
 * Replay-safety: claimReceiptId is a deterministic hash of the canonical
 * claim input; identical claims produce identical receipts (idempotent).
 *
 * Ambiguity-preserving: when verification evidence is contradictory,
 * the claim resolves to a CONTESTED state rather than picking a winner.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";

// ---------------------------------------------------------------------------
// Identity model
// ---------------------------------------------------------------------------

export const IDENTITY_LIFECYCLE = [
  "UNCLAIMED",
  "CLAIM_INITIATED",
  "CLAIM_VERIFIED",
  "ACTIVATED",
  "REVOKED",
  "RECLAIM_PENDING",
  "CONTESTED",
] as const;
export type IdentityLifecycle = (typeof IDENTITY_LIFECYCLE)[number];

interface AllowedIdentityTransition {
  readonly from: IdentityLifecycle;
  readonly to: IdentityLifecycle;
  readonly evidenceRequired: string;
}

export const IDENTITY_TRANSITIONS: readonly AllowedIdentityTransition[] = Object.freeze([
  { from: "UNCLAIMED", to: "CLAIM_INITIATED", evidenceRequired: "claimant identity assertion" },
  { from: "CLAIM_INITIATED", to: "CLAIM_VERIFIED", evidenceRequired: "verifier-signed verification artifact" },
  { from: "CLAIM_VERIFIED", to: "ACTIVATED", evidenceRequired: "passport activation event" },
  { from: "ACTIVATED", to: "REVOKED", evidenceRequired: "operator-recorded revocation reason" },
  { from: "REVOKED", to: "RECLAIM_PENDING", evidenceRequired: "reclaim assertion + dispute reason" },
  { from: "RECLAIM_PENDING", to: "CLAIM_VERIFIED", evidenceRequired: "operator-resolved reclaim with evidence" },
  // Contradictory evidence collapses to CONTESTED
  { from: "CLAIM_INITIATED", to: "CONTESTED", evidenceRequired: "contradictory verification evidence; preserves ambiguity" },
  { from: "CLAIM_VERIFIED", to: "CONTESTED", evidenceRequired: "contradictory verification evidence post-verify" },
  { from: "CONTESTED", to: "CLAIM_VERIFIED", evidenceRequired: "operator-resolved contradiction with evidence" },
]);

export function isAllowedIdentityTransition(
  from: IdentityLifecycle,
  to: IdentityLifecycle,
): AllowedIdentityTransition | null {
  if (from === to) return { from, to, evidenceRequired: "no-op" };
  for (const t of IDENTITY_TRANSITIONS) {
    if (t.from === from && t.to === to) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Claim record
// ---------------------------------------------------------------------------

export interface IdentityClaim {
  readonly claimId: string;
  readonly subjectNpi: string; // 10-digit NPI string
  readonly subjectKind: "INDIVIDUAL" | "ORGANIZATION";
  readonly claimantActor: string;
  readonly observedAt: string;
  readonly state: IdentityLifecycle;
  readonly claimReceiptId: string;
  /** Lineage: previous claim ids that this claim is linked to (reclaim chain). */
  readonly lineage: readonly string[];
  /** Verifier-supplied evidence references. */
  readonly verificationEvidenceRefs: readonly string[];
  /** Required when state ∈ {REVOKED, RECLAIM_PENDING, CONTESTED}. */
  readonly stateReason?: string | null;
}

const NPI_REGEX = /^\d{10}$/;

export type IdentityValidationError =
  | { readonly tag: "missing-field"; readonly field: keyof IdentityClaim }
  | { readonly tag: "invalid-npi"; readonly value: string }
  | { readonly tag: "unknown-state"; readonly value: string }
  | { readonly tag: "state-requires-reason"; readonly state: IdentityLifecycle }
  | { readonly tag: "verified-without-evidence" }
  | { readonly tag: "receipt-id-mismatch"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "lineage-self-reference"; readonly id: string };

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Compute the deterministic claim receipt id from the canonical claim
 * input. Identical input ⇒ identical receipt id (replay-safe).
 */
export function computeClaimReceiptId(input: {
  readonly subjectNpi: string;
  readonly subjectKind: IdentityClaim["subjectKind"];
  readonly claimantActor: string;
  readonly observedAt: string;
}): string {
  return sha256Hex(canonicalize(input));
}

export function validateIdentityClaim(
  claim: Partial<IdentityClaim>,
): readonly IdentityValidationError[] {
  const errors: IdentityValidationError[] = [];
  const required: readonly (keyof IdentityClaim)[] = [
    "claimId",
    "subjectNpi",
    "subjectKind",
    "claimantActor",
    "observedAt",
    "state",
    "claimReceiptId",
    "lineage",
    "verificationEvidenceRefs",
  ];
  for (const f of required) {
    const v = claim[f];
    if (v === undefined || v === null || v === "") {
      errors.push({ tag: "missing-field", field: f });
    }
  }
  if (typeof claim.subjectNpi === "string" && !NPI_REGEX.test(claim.subjectNpi)) {
    errors.push({ tag: "invalid-npi", value: claim.subjectNpi });
  }
  if (claim.state && !(IDENTITY_LIFECYCLE as readonly string[]).includes(claim.state)) {
    errors.push({ tag: "unknown-state", value: String(claim.state) });
  }
  if (
    claim.state === "REVOKED" ||
    claim.state === "RECLAIM_PENDING" ||
    claim.state === "CONTESTED"
  ) {
    if (!claim.stateReason) {
      errors.push({ tag: "state-requires-reason", state: claim.state });
    }
  }
  if (
    (claim.state === "CLAIM_VERIFIED" || claim.state === "ACTIVATED") &&
    Array.isArray(claim.verificationEvidenceRefs) &&
    claim.verificationEvidenceRefs.length === 0
  ) {
    errors.push({ tag: "verified-without-evidence" });
  }
  if (
    typeof claim.subjectNpi === "string" &&
    typeof claim.subjectKind === "string" &&
    typeof claim.claimantActor === "string" &&
    typeof claim.observedAt === "string" &&
    typeof claim.claimReceiptId === "string"
  ) {
    const recomputed = computeClaimReceiptId({
      subjectNpi: claim.subjectNpi,
      subjectKind: claim.subjectKind as IdentityClaim["subjectKind"],
      claimantActor: claim.claimantActor,
      observedAt: claim.observedAt,
    });
    if (recomputed !== claim.claimReceiptId) {
      errors.push({
        tag: "receipt-id-mismatch",
        recorded: claim.claimReceiptId,
        recomputed,
      });
    }
  }
  if (
    typeof claim.claimId === "string" &&
    Array.isArray(claim.lineage) &&
    claim.lineage.includes(claim.claimId)
  ) {
    errors.push({ tag: "lineage-self-reference", id: claim.claimId });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Lineage chain detection
// ---------------------------------------------------------------------------

export function hasReclaimCycle(claims: readonly IdentityClaim[]): boolean {
  const parentOf = new Map<string, readonly string[]>();
  for (const c of claims) parentOf.set(c.claimId, c.lineage);
  for (const start of parentOf.keys()) {
    const seen = new Set<string>();
    const stack: string[] = [start];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (seen.has(cur)) return true;
      seen.add(cur);
      for (const p of parentOf.get(cur) ?? []) stack.push(p);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export interface IdentityClaimReport {
  readonly executedAt: string;
  readonly claimsEvaluated: number;
  readonly findings: readonly (
    | { readonly tag: "validation-error"; readonly claimId: string; readonly error: IdentityValidationError }
    | { readonly tag: "reclaim-cycle"; readonly claimIds: readonly string[] }
  )[];
  readonly hasCiGatingCondition: boolean;
}

export function buildIdentityClaimReport(
  claims: readonly IdentityClaim[],
  nowIso: string,
): IdentityClaimReport {
  const findings: IdentityClaimReport["findings"][number][] = [];
  let gating = false;
  for (const c of claims) {
    for (const e of validateIdentityClaim(c)) {
      findings.push({ tag: "validation-error", claimId: c.claimId, error: e });
      gating = true;
    }
  }
  if (hasReclaimCycle(claims)) {
    findings.push({ tag: "reclaim-cycle", claimIds: claims.map((c) => c.claimId) });
    gating = true;
  }
  return Object.freeze({
    executedAt: nowIso,
    claimsEvaluated: claims.length,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}

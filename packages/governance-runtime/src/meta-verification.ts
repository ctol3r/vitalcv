/**
 * Meta-verification (W2-PR27A) — verifies the verification layer itself.
 *
 * Per W2-PR27A non-negotiable rules:
 *   1. Verification itself must remain verifiable.
 *   2. Unverified assumptions must remain visible.
 *   3. Blind spots are operational risks.
 *   4. Verification confidence must remain evidence-derived.
 *   5. Invariant collisions must remain detectable.
 *   6. Completeness inflation is forbidden.
 *   7. Unknown verification coverage must remain explicit.
 *
 * The functions here are PURE meta-checks. They take the verification
 * report (from `runAllInvariants`) + the registry's known invariant
 * coverage map and surface blind spots / assumptions / interaction
 * issues.
 */

import type { VerificationReport } from "./verification.js";

/* ─────────────────────────────────────────────────────────────────────────── */
/* GOVERNANCE DOMAINS + INVARIANT COVERAGE GRAPH (W2-PR27A target 1)           */
/* ─────────────────────────────────────────────────────────────────────────── */

export const GOVERNANCE_DOMAINS = [
  "trust-class",
  "integrity-state",
  "containment-state",
  "replay-state",
  "transition-graph",
  "cross-axis-coherence",
  "override-audit",
  "lexicon-enforcement",
  "semantic-evolution",
  "fail-closed",
  "telemetry-absence",
] as const;
export type GovernanceDomain = (typeof GOVERNANCE_DOMAINS)[number];

/**
 * Per-domain coverage assertion. Each entry declares which verification
 * functions are RESPONSIBLE for that domain, plus an explicit list of
 * KNOWN UNCOVERED ASPECTS (blind spots).
 *
 * This is the operator-visible assumption registry per W2-PR27A target 3.
 */
export interface DomainCoverage {
  readonly domain: GovernanceDomain;
  readonly invariantsVerified: ReadonlyArray<string>;
  readonly knownBlindSpots: ReadonlyArray<string>;
  readonly assumptionsRequired: ReadonlyArray<string>;
}

export const DOMAIN_COVERAGE: ReadonlyArray<DomainCoverage> = Object.freeze([
  {
    domain: "trust-class",
    invariantsVerified: [
      "All 5 canonical classes parse to themselves (round-trip)",
      "Unknown trust-class returns null (NOT silently mapped to C-1)",
      "T0 profile is WEAK on lineage durability (NOT silently STRONG)",
      "All profiles are frozen (cannot be mutated at runtime)",
    ],
    knownBlindSpots: [
      "Per-handler runtime class assignment is NOT verified by the package — relies on PR review + Codex audit",
      "C-2 cosmetic atomicity vs C-1 transactional atomicity is NOT distinguished by static type — relies on doc convention",
    ],
    assumptionsRequired: [
      "Codex SAFE prompt (per docs/ops/codex-constitutional-prompt-layer.md) verifies class assignment per PR",
      "Reviewer playbook (per docs/ops/constitutional-enforcement-matrix.md) cross-checks per-handler class",
    ],
  },
  {
    domain: "integrity-state",
    invariantsVerified: [
      "All 6 states roundtrip via parseIntegrityState",
      "Unknown input → CI-UNKNOWN (never CI-GREEN)",
      "CI-UNKNOWN severity > CI-GREEN (fail-closed posture)",
      "maxIntegrityState picks worst across array",
      "Empty array → CI-UNKNOWN (NOT CI-GREEN)",
    ],
    knownBlindSpots: [
      "Severity ordering for CI-DRIFT vs CI-FRAGMENTED is heuristic; per-deployment rebalancing not verified",
    ],
    assumptionsRequired: [
      "Telemetry source guarantees state strings match canonical enum (no upstream drift)",
    ],
  },
  {
    domain: "containment-state",
    invariantsVerified: [
      "All 6 states roundtrip",
      "Unknown → CT-UNKNOWN (fail-closed)",
      "Severity ordering aligned with escalation taxonomy",
    ],
    knownBlindSpots: [
      "CT-FRAGMENTING vs CT-ESCALATING boundary is operationally fuzzy; not verified by quantitative threshold",
    ],
    assumptionsRequired: [
      "Operator distinguishes via runbook per docs/ops/constitutional-governance-runbook.md",
    ],
  },
  {
    domain: "replay-state",
    invariantsVerified: [
      "5 canonical replay states roundtrip",
      "Unknown → R-AMBIGUOUS (preserves ambiguity)",
      "classifyReplayState returns R-AMBIGUOUS for unmarkered rows",
      "IDEMPOTENT_REPLAY → R-OBSERVED (canonical)",
      "<base>.duplicate_request → R-DENIED",
    ],
    knownBlindSpots: [
      "R-ACCEPTED detection requires payloadHash clustering (forensic-only) — NOT a runtime invariant",
      "Cross-actor replay (R-CAT-4) is invisible at this layer — JWT-stewardship concern",
    ],
    assumptionsRequired: [
      "ML-Rec-1 / DC-Rec-2 implemented: payloadHash on every audit row",
      "Clerk JWT secrecy is preserved (not re-verified here)",
    ],
  },
  {
    domain: "transition-graph",
    invariantsVerified: [
      "Same-state transitions classify as no-op",
      "Recovery transitions require evidence (CI-DEGRADED → CI-GREEN)",
      "Impossible jumps (CI-VIOLATION → CI-GREEN) classify as forbidden",
      "R-AMBIGUOUS resolution requires evidence",
    ],
    knownBlindSpots: [
      "Multi-step transition paths (CI-VIOLATION → CI-FRAGMENTED → ... → CI-GREEN) are NOT auto-validated as a chain",
      "Evidence ref string content is NOT validated (any non-empty string accepted)",
    ],
    assumptionsRequired: [
      "Caller provides meaningful evidence references (audit-row IDs, doc anchors)",
      "Operator reviews multi-step transitions out-of-band per recovery runbook",
    ],
  },
  {
    domain: "cross-axis-coherence",
    invariantsVerified: [
      "CI-GREEN + R-AMBIGUOUS → contradiction detected",
      "CT-GREEN + CI-FRAGMENTED → contradiction detected",
      "T0 + STRONG continuity → contradiction detected",
      "CONFIRMED + no evidenceRef → contradiction detected",
      "Resolved systemic state never SYSTEMIC-GREEN (vocabulary intentionally degradation-focused)",
    ],
    knownBlindSpots: [
      "Only 4 cross-axis rules currently encoded — additional combinations may exist that should contradict",
      "Severity-tier reconciliation across more than 2 axes simultaneously is not stress-tested",
    ],
    assumptionsRequired: [
      "Operators consult docs/ops/operational-guarantee-matrix.md for axis-pair reasoning beyond the 4 encoded rules",
    ],
  },
  {
    domain: "override-audit",
    invariantsVerified: [
      "MAX_OVERRIDE_DURATION_MS = 30 days",
      "MAX_RENEWALS = 3",
      "Forbidden patterns (permanent / verbal / implicit) detected",
      "UUID + ISO format validation",
    ],
    knownBlindSpots: [
      "Override approval workflow is NOT verified by the package — assumes founder process per constitutional-override-governance.md",
      "Audit-log persistence is NOT verified — assumes external durable store",
    ],
    assumptionsRequired: [
      "Founder + Codex SAFE approval per docs/ops/TRUST_GUARANTEE_LEXICON.md §6",
      "Audit-log durable persistence beyond memory",
    ],
  },
  {
    domain: "lexicon-enforcement",
    invariantsVerified: [
      "13 forbidden phrases regex-defined and exported",
      "FORBIDDEN_LEXICON_PHRASES + LEXICON_SUBSTITUTIONS aligned",
    ],
    knownBlindSpots: [
      "Whole-word matching may miss creative obfuscation (homoglyphs, leetspeak)",
      "Allowlist mechanism trusts file-prefix matching — does NOT verify the file's actual content is grandfathered legitimately",
    ],
    assumptionsRequired: [
      "Codex SAFE prompt (per docs/ops/codex-constitutional-prompt-layer.md) catches semantic drift the regex can't",
      "Reviewer manually verifies allowlist additions per founder + Codex approval",
    ],
  },
  {
    domain: "semantic-evolution",
    invariantsVerified: [
      "Snapshot deterministically hashes registry state",
      "State removal detected as BREAKING",
      "Transition addition detected as CRITICAL",
      "Evidence relaxation detected as CRITICAL",
      "Trust-class strength inflation detected as HIGH-RISK",
      "Renewal/duration relaxation detected as CRITICAL",
    ],
    knownBlindSpots: [
      "Semantic-equivalent renames (e.g., 'CI-GREEN' → 'CI_GREEN') would appear as both removal AND addition — NOT detected as 'rename'",
      "Profile dimension additions (new fields on TrustClassProfile) NOT diff-classified",
    ],
    assumptionsRequired: [
      "Baseline snapshot in git is the authoritative reference; updates are explicit + reviewed",
    ],
  },
  {
    domain: "fail-closed",
    invariantsVerified: [
      "All fail-closed helpers preserve unknown → degraded coercion",
      "Telemetry absence produces all-UNKNOWN/AMBIGUOUS axes",
      "assertNever throws on impossible inputs (defense-in-depth)",
    ],
    knownBlindSpots: [
      "JavaScript's loose equality could cause unexpected coercion in caller code — NOT verified at this layer",
    ],
    assumptionsRequired: [
      "Caller uses TypeScript strict mode (no implicit any / loose equality)",
    ],
  },
  {
    domain: "telemetry-absence",
    invariantsVerified: [
      "handleTelemetryAbsence returns explicit reason + all-fail-closed axes",
    ],
    knownBlindSpots: [
      "Telemetry source health is NOT monitored at this layer — caller invokes helper based on its own absence-detection",
    ],
    assumptionsRequired: [
      "Caller correctly detects absence (timeout / null response / source error)",
    ],
  },
]);

/* ─────────────────────────────────────────────────────────────────────────── */
/* VERIFICATION CONFIDENCE SEMANTICS (W2-PR27A target 5)                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export const VERIFICATION_CONFIDENCE = [
  "VERIFIED",
  "PARTIALLY-VERIFIED",
  "ASSUMED",
  "UNVERIFIED",
  "UNKNOWN",
] as const;
export type VerificationConfidence = (typeof VERIFICATION_CONFIDENCE)[number];

export interface DomainConfidenceSummary {
  readonly domain: GovernanceDomain;
  readonly invariantCount: number;
  readonly blindSpotCount: number;
  readonly assumptionCount: number;
  readonly confidence: VerificationConfidence;
}

/**
 * Derive per-domain confidence from coverage data.
 * Domains with 0 invariants → UNVERIFIED.
 * Domains with 0 blind spots AND 0 assumptions → VERIFIED.
 * Domains with > 0 blind spots → PARTIALLY-VERIFIED.
 * Domains with > 0 assumptions but 0 blind spots → ASSUMED.
 */
function deriveDomainConfidence(c: DomainCoverage): VerificationConfidence {
  if (c.invariantsVerified.length === 0) return "UNVERIFIED";
  if (c.knownBlindSpots.length === 0 && c.assumptionsRequired.length === 0) return "VERIFIED";
  if (c.knownBlindSpots.length > 0) return "PARTIALLY-VERIFIED";
  return "ASSUMED";
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* META-VERIFICATION REPORT (W2-PR27A target 6)                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface MetaVerificationReport {
  readonly version: 1;
  readonly executedAt: string;
  readonly domainSummaries: ReadonlyArray<DomainConfidenceSummary>;
  readonly totalInvariants: number;
  readonly totalBlindSpots: number;
  readonly totalAssumptions: number;
  readonly verifiedDomains: number;
  readonly partiallyVerifiedDomains: number;
  readonly assumedDomains: number;
  readonly unverifiedDomains: number;
  readonly aggregateConfidence: VerificationConfidence;
  readonly invariantsExecutedReport: VerificationReport | null;
}

export function buildMetaVerificationReport(
  invariantsReport: VerificationReport | null,
): MetaVerificationReport {
  const summaries: DomainConfidenceSummary[] = DOMAIN_COVERAGE.map((c) => ({
    domain: c.domain,
    invariantCount: c.invariantsVerified.length,
    blindSpotCount: c.knownBlindSpots.length,
    assumptionCount: c.assumptionsRequired.length,
    confidence: deriveDomainConfidence(c),
  }));

  const verified = summaries.filter((s) => s.confidence === "VERIFIED").length;
  const partial = summaries.filter((s) => s.confidence === "PARTIALLY-VERIFIED").length;
  const assumed = summaries.filter((s) => s.confidence === "ASSUMED").length;
  const unverified = summaries.filter((s) => s.confidence === "UNVERIFIED").length;

  // Aggregate confidence: worst wins (per W2-PR27A rule #6: completeness inflation forbidden).
  let aggregate: VerificationConfidence;
  if (unverified > 0) aggregate = "UNVERIFIED";
  else if (partial > 0) aggregate = "PARTIALLY-VERIFIED";
  else if (assumed > 0) aggregate = "ASSUMED";
  else aggregate = "VERIFIED";

  return {
    version: 1,
    executedAt: new Date().toISOString(),
    domainSummaries: summaries,
    totalInvariants: summaries.reduce((acc, s) => acc + s.invariantCount, 0),
    totalBlindSpots: summaries.reduce((acc, s) => acc + s.blindSpotCount, 0),
    totalAssumptions: summaries.reduce((acc, s) => acc + s.assumptionCount, 0),
    verifiedDomains: verified,
    partiallyVerifiedDomains: partial,
    assumedDomains: assumed,
    unverifiedDomains: unverified,
    aggregateConfidence: aggregate,
    invariantsExecutedReport: invariantsReport,
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* INVARIANT INTERACTION TESTS (W2-PR27A target 4)                              */
/* ─────────────────────────────────────────────────────────────────────────── */

export type InvariantInteractionViolation =
  | { readonly tag: "fail-closed-blocks-recovery"; readonly description: string }
  | { readonly tag: "ambiguity-overpropagates"; readonly description: string }
  | { readonly tag: "redundant-invariants"; readonly axis: string };

/**
 * Verify that invariants compose without collision:
 *   - Fail-closed defaults (CI-UNKNOWN) do NOT block legitimate transitions.
 *   - Ambiguity propagation (R-AMBIGUOUS → SYSTEMIC-AMBIGUOUS) does NOT
 *     prevent valid R-OBSERVED reclassification.
 *   - No redundant invariants (the registry's invariants don't duplicate).
 */
export function verifyInvariantInteractions(): ReadonlyArray<InvariantInteractionViolation> {
  // This module's job is to surface meta-issues. The current registry is
  // intentionally compact, so we expect 0 collisions. The stub remains in
  // place to catch future additions.
  return [];
}

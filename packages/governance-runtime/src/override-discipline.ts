/**
 * Override discipline — human-override integrity primitives.
 *
 * Wave: W2-PR29A — Human Override Integrity + Emergency Governance Discipline.
 *
 * Builds on override-audit.ts (W2-PR19A's generic OV-1..4 audit shape) with a
 * canonical 7-class human-override taxonomy, lineage + blast-radius tracking,
 * decay semantics, and integrity validators.
 *
 * Non-negotiable rules (from W2-PR29A directive):
 *   1. Human overrides are integrity events.
 *   2. Emergency access must remain historically visible.
 *   3. Replay ambiguity cannot be manually erased.
 *   4. Overrides must decay, not persist indefinitely.
 *   5. Override blast radius must remain explicit.
 *   6. Manual trust escalation must remain auditable.
 *   7. Governance must remain resilient under stress.
 *
 * Pure transforms. No fetches. No DB writes. No audit-event writes.
 * Caller integrates with the audit substrate.
 */

import { GOVERNANCE_DOMAINS, type GovernanceDomain } from "./meta-verification.js";

// ---------------------------------------------------------------------------
// TARGET 1 — Canonical Override Taxonomy
// ---------------------------------------------------------------------------

/**
 * Canonical 7-class human-override taxonomy.
 *
 * EVERY human override MUST classify into exactly one of these. The four
 * generic OV-1..4 audit classes in override-audit.ts remain the audit-row
 * shape; this taxonomy is the *intent classification* layered on top.
 */
export const HUMAN_OVERRIDE_KINDS = [
  "EMERGENCY",
  "INCIDENT_RESPONSE",
  "TEMPORARY_SUPPRESSION",
  "MANUAL_REVIEW",
  "EXECUTIVE_EXCEPTION",
  "RECOVERY_OVERRIDE",
  "TEST_OVERRIDE",
] as const;
export type HumanOverrideKind = (typeof HUMAN_OVERRIDE_KINDS)[number];

/**
 * Risk classification per kind. Drives blast-radius scoring + decay rate.
 *
 * Severity ordering (numeric): higher = more risk.
 *   CRITICAL  = 90 — irreversible-if-unchecked, audit-bypass adjacent
 *   HIGH      = 70 — replay implications, multi-domain reach
 *   MEDIUM    = 50 — single-domain, reversible
 *   LOW       = 20 — test/observation-only
 */
export const OVERRIDE_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type OverrideRiskLevel = (typeof OVERRIDE_RISK_LEVELS)[number];

const RISK_SEVERITY_NUMERIC: Readonly<Record<OverrideRiskLevel, number>> = Object.freeze({
  LOW: 20,
  MEDIUM: 50,
  HIGH: 70,
  CRITICAL: 90,
});

export function overrideRiskSeverity(r: OverrideRiskLevel): number {
  return RISK_SEVERITY_NUMERIC[r];
}

/**
 * Per-kind defaults: risk classification, default duration ceiling (ms),
 * default half-life (ms), and whether this kind may legally touch the
 * replay axis. Caller may shorten duration; never lengthen.
 */
export interface OverrideKindProfile {
  readonly kind: HumanOverrideKind;
  readonly defaultRisk: OverrideRiskLevel;
  /** Hard ceiling on (expiration - approval) for this kind, in ms. */
  readonly maxDurationMs: number;
  /** Half-life used by computeOverrideDecay; shorter = decays faster. */
  readonly halfLifeMs: number;
  /** Whether overrides of this kind are permitted to touch replay markers at all. */
  readonly mayTouchReplay: boolean;
  /** Whether this kind requires founder-tier approver (vs operator-tier). */
  readonly requiresFounderApproval: boolean;
  /** Human-readable description for UI / audit row. */
  readonly description: string;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PROFILES: Readonly<Record<HumanOverrideKind, OverrideKindProfile>> = Object.freeze({
  EMERGENCY: Object.freeze({
    kind: "EMERGENCY",
    defaultRisk: "CRITICAL",
    maxDurationMs: 4 * HOUR,
    halfLifeMs: 1 * HOUR,
    mayTouchReplay: false,
    requiresFounderApproval: true,
    description:
      "Founder-approved emergency access during active incident. Short window, fast decay, never erases replay markers.",
  }),
  INCIDENT_RESPONSE: Object.freeze({
    kind: "INCIDENT_RESPONSE",
    defaultRisk: "HIGH",
    maxDurationMs: 24 * HOUR,
    halfLifeMs: 6 * HOUR,
    mayTouchReplay: false,
    requiresFounderApproval: true,
    description:
      "Coordinated incident-response window. Higher ceiling than EMERGENCY but still bounded; replay axis remains read-only.",
  }),
  TEMPORARY_SUPPRESSION: Object.freeze({
    kind: "TEMPORARY_SUPPRESSION",
    defaultRisk: "MEDIUM",
    maxDurationMs: 7 * DAY,
    halfLifeMs: 1 * DAY,
    mayTouchReplay: false,
    requiresFounderApproval: false,
    description:
      "Time-boxed suppression of a known noisy invariant. Scope must be narrow; renewal counts against trust score.",
  }),
  MANUAL_REVIEW: Object.freeze({
    kind: "MANUAL_REVIEW",
    defaultRisk: "MEDIUM",
    maxDurationMs: 14 * DAY,
    halfLifeMs: 3 * DAY,
    mayTouchReplay: false,
    requiresFounderApproval: false,
    description:
      "Operator-led manual review window for a flagged surface. Audit-coupled; cannot escalate trust class.",
  }),
  EXECUTIVE_EXCEPTION: Object.freeze({
    kind: "EXECUTIVE_EXCEPTION",
    defaultRisk: "CRITICAL",
    maxDurationMs: 30 * DAY,
    halfLifeMs: 5 * DAY,
    mayTouchReplay: false,
    requiresFounderApproval: true,
    description:
      "Founder-tier policy exception. Always CRITICAL; visible on every governance surface for the duration.",
  }),
  RECOVERY_OVERRIDE: Object.freeze({
    kind: "RECOVERY_OVERRIDE",
    defaultRisk: "HIGH",
    maxDurationMs: 24 * HOUR,
    halfLifeMs: 4 * HOUR,
    mayTouchReplay: false,
    requiresFounderApproval: true,
    description:
      "Used to authorize a recovery-evidence transition (e.g., CT-VIOLATION → CT-FRAGMENTING). Cannot bypass the transition graph; only authorizes evidence.",
  }),
  TEST_OVERRIDE: Object.freeze({
    kind: "TEST_OVERRIDE",
    defaultRisk: "LOW",
    maxDurationMs: 1 * HOUR,
    halfLifeMs: 15 * 60 * 1000,
    mayTouchReplay: false,
    requiresFounderApproval: false,
    description:
      "Synthetic override for chaos-testing or fixture seeding. NEVER allowed in production environments.",
  }),
});

export function getOverrideKindProfile(kind: HumanOverrideKind): OverrideKindProfile {
  return PROFILES[kind];
}

export function parseHumanOverrideKind(s: unknown): HumanOverrideKind | null {
  if (typeof s !== "string") return null;
  return (HUMAN_OVERRIDE_KINDS as readonly string[]).includes(s)
    ? (s as HumanOverrideKind)
    : null;
}

// ---------------------------------------------------------------------------
// Override record (caller-supplied; pure validation target)
// ---------------------------------------------------------------------------

/**
 * Human override record — the discipline-layer view of a single override.
 *
 * Distinct from `OverrideAuditEntry` in override-audit.ts: that is the
 * raw audit-row substrate (OV-1..4 generic class), this is the human-intent
 * classification + blast-radius + lineage layer.
 *
 * Caller correlates the two via `auditEntryId`.
 */
export interface HumanOverrideRecord {
  readonly id: string;
  readonly kind: HumanOverrideKind;
  readonly risk: OverrideRiskLevel;
  /** Initiating actor (operator/founder identity, audit-row reference). */
  readonly initiatingActor: string;
  /** ISO-8601 UTC. */
  readonly approvalTimestamp: string;
  /** ISO-8601 UTC. */
  readonly expirationTimestamp: string;
  /** Affected governance domains (must be non-empty). */
  readonly affectedDomains: readonly GovernanceDomain[];
  /** Specific invariant ids/tags this override suppresses or relaxes. */
  readonly impactedInvariants: readonly string[];
  /** Scope description; must be narrow/specific (no "everything", "all"). */
  readonly scope: string;
  /** Number of prior renewals against this override id (monotonic). */
  readonly renewalCount: number;
  /**
   * Whether this override claims to affect the replay axis. MUST be `false`
   * for every kind in the current taxonomy; reserved for explicit future
   * gating via `mayTouchReplay`.
   */
  readonly touchesReplay: boolean;
  /**
   * Whether this override claims to elevate the trust class of any surface.
   * MUST be `false`; manual trust elevation is forbidden.
   */
  readonly elevatesTrust: boolean;
  /** Optional parent override id (recursion detection). */
  readonly parentOverrideId?: string | null;
  /** Optional cross-reference to OverrideAuditEntry.overrideId. */
  readonly auditEntryId?: string | null;
  /** Optional environment tag — TEST_OVERRIDE rejected when "production". */
  readonly environment?: "production" | "staging" | "preview" | "test" | null;
}

// ---------------------------------------------------------------------------
// TARGET 2 — Override Integrity Validators
// ---------------------------------------------------------------------------

export type OverrideIntegrityError =
  | { readonly tag: "missing-field"; readonly field: keyof HumanOverrideRecord }
  | { readonly tag: "unknown-kind"; readonly value: string }
  | { readonly tag: "unknown-risk"; readonly value: string }
  | { readonly tag: "duration-exceeds-kind-ceiling"; readonly kind: HumanOverrideKind; readonly maxMs: number; readonly actualMs: number }
  | { readonly tag: "expiration-before-approval" }
  | { readonly tag: "indefinite-override-forbidden" }
  | { readonly tag: "scope-too-broad"; readonly offendingTerm: string }
  | { readonly tag: "replay-suppression-forbidden"; readonly kind: HumanOverrideKind }
  | { readonly tag: "manual-trust-elevation-forbidden" }
  | { readonly tag: "recursive-override-detected"; readonly parentId: string }
  | { readonly tag: "test-override-in-production" }
  | { readonly tag: "founder-approval-required"; readonly kind: HumanOverrideKind }
  | { readonly tag: "affected-domains-empty" }
  | { readonly tag: "unknown-affected-domain"; readonly value: string }
  | { readonly tag: "renewal-penalty-exhausted"; readonly maxRenewals: number; readonly actual: number }
  | { readonly tag: "risk-below-kind-floor"; readonly kind: HumanOverrideKind; readonly declared: OverrideRiskLevel; readonly minimum: OverrideRiskLevel };

const SCOPE_FORBIDDEN_TERMS = [
  "everything",
  "all surfaces",
  "all domains",
  "global bypass",
  "indefinite",
  "permanent",
  "until further notice",
  "all axes",
] as const;

const KNOWN_DOMAINS = new Set<string>(GOVERNANCE_DOMAINS);

/**
 * Maximum permitted renewals for a single override id.
 *
 * Aligns with `MAX_RENEWALS` in override-audit.ts (3) but expressed
 * separately so the discipline layer can tighten without churn on the
 * audit-row substrate.
 */
export const MAX_HUMAN_OVERRIDE_RENEWALS = 3 as const;

/**
 * Validate a human-override record against the integrity rules.
 *
 * Returns array of errors; empty = valid.
 *
 * Pure. Does not throw. Does not mutate.
 */
export function validateHumanOverride(
  rec: Partial<HumanOverrideRecord>,
): readonly OverrideIntegrityError[] {
  const errors: OverrideIntegrityError[] = [];

  const required: readonly (keyof HumanOverrideRecord)[] = [
    "id",
    "kind",
    "risk",
    "initiatingActor",
    "approvalTimestamp",
    "expirationTimestamp",
    "affectedDomains",
    "impactedInvariants",
    "scope",
    "renewalCount",
    "touchesReplay",
    "elevatesTrust",
  ];
  for (const field of required) {
    const v = rec[field];
    if (v === undefined || v === null || v === "") {
      errors.push({ tag: "missing-field", field });
    }
  }

  const kind = parseHumanOverrideKind(rec.kind);
  if (rec.kind !== undefined && kind === null) {
    errors.push({ tag: "unknown-kind", value: String(rec.kind) });
  }
  if (rec.risk !== undefined && !(OVERRIDE_RISK_LEVELS as readonly string[]).includes(rec.risk as string)) {
    errors.push({ tag: "unknown-risk", value: String(rec.risk) });
  }

  // Affected domains
  if (Array.isArray(rec.affectedDomains)) {
    if (rec.affectedDomains.length === 0) {
      errors.push({ tag: "affected-domains-empty" });
    }
    for (const d of rec.affectedDomains) {
      if (!KNOWN_DOMAINS.has(d as string)) {
        errors.push({ tag: "unknown-affected-domain", value: String(d) });
      }
    }
  }

  // Scope breadth
  if (typeof rec.scope === "string") {
    const lc = rec.scope.toLowerCase();
    for (const term of SCOPE_FORBIDDEN_TERMS) {
      if (lc.includes(term)) {
        errors.push({ tag: "scope-too-broad", offendingTerm: term });
      }
    }
  }

  // Indefinite override (sentinel timestamps)
  if (
    rec.expirationTimestamp === "9999-12-31T23:59:59Z" ||
    rec.expirationTimestamp === "infinity" ||
    rec.expirationTimestamp === "never"
  ) {
    errors.push({ tag: "indefinite-override-forbidden" });
  }

  // Duration vs kind ceiling
  if (
    kind &&
    typeof rec.approvalTimestamp === "string" &&
    typeof rec.expirationTimestamp === "string"
  ) {
    const a = Date.parse(rec.approvalTimestamp);
    const e = Date.parse(rec.expirationTimestamp);
    if (Number.isFinite(a) && Number.isFinite(e)) {
      if (e < a) errors.push({ tag: "expiration-before-approval" });
      const dur = e - a;
      const profile = getOverrideKindProfile(kind);
      if (dur > profile.maxDurationMs) {
        errors.push({
          tag: "duration-exceeds-kind-ceiling",
          kind,
          maxMs: profile.maxDurationMs,
          actualMs: dur,
        });
      }
    }
  }

  // Replay suppression — forbidden for every current kind
  if (rec.touchesReplay === true && kind) {
    if (!getOverrideKindProfile(kind).mayTouchReplay) {
      errors.push({ tag: "replay-suppression-forbidden", kind });
    }
  }

  // Manual trust elevation — universally forbidden
  if (rec.elevatesTrust === true) {
    errors.push({ tag: "manual-trust-elevation-forbidden" });
  }

  // Recursive override detection
  if (typeof rec.parentOverrideId === "string" && rec.parentOverrideId.length > 0) {
    if (rec.parentOverrideId === rec.id) {
      errors.push({ tag: "recursive-override-detected", parentId: rec.parentOverrideId });
    }
  }

  // Renewal cap
  if (typeof rec.renewalCount === "number" && rec.renewalCount > MAX_HUMAN_OVERRIDE_RENEWALS) {
    errors.push({
      tag: "renewal-penalty-exhausted",
      maxRenewals: MAX_HUMAN_OVERRIDE_RENEWALS,
      actual: rec.renewalCount,
    });
  }

  // Risk floor per kind (declared risk cannot be below kind's default)
  if (kind && rec.risk && (OVERRIDE_RISK_LEVELS as readonly string[]).includes(rec.risk as string)) {
    const declared = rec.risk as OverrideRiskLevel;
    const minimum = getOverrideKindProfile(kind).defaultRisk;
    if (overrideRiskSeverity(declared) < overrideRiskSeverity(minimum)) {
      errors.push({ tag: "risk-below-kind-floor", kind, declared, minimum });
    }
  }

  // Test-override environment gate
  if (kind === "TEST_OVERRIDE" && rec.environment === "production") {
    errors.push({ tag: "test-override-in-production" });
  }

  // Founder-approval requirement (caller flags via initiatingActor convention "founder:*")
  if (kind && getOverrideKindProfile(kind).requiresFounderApproval) {
    if (typeof rec.initiatingActor === "string" && !rec.initiatingActor.startsWith("founder:")) {
      errors.push({ tag: "founder-approval-required", kind });
    }
  }

  return errors;
}

/**
 * Detect recursive override chains across a set of records (id → parentId graph).
 * Returns ids that participate in a cycle.
 */
export function detectRecursiveOverrideChains(
  records: readonly HumanOverrideRecord[],
): readonly string[] {
  const parentOf = new Map<string, string | null>();
  for (const r of records) parentOf.set(r.id, r.parentOverrideId ?? null);

  const cycleIds = new Set<string>();
  for (const start of parentOf.keys()) {
    const seen = new Set<string>();
    let cursor: string | null | undefined = start;
    while (cursor) {
      if (seen.has(cursor)) {
        // cycle detected — mark all visited ids on this walk
        for (const v of seen) cycleIds.add(v);
        cycleIds.add(cursor);
        break;
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor) ?? null;
    }
  }
  return [...cycleIds];
}

// ---------------------------------------------------------------------------
// TARGET 3 — Override Lineage + Blast Radius
// ---------------------------------------------------------------------------

export interface OverrideBlastRadius {
  readonly overrideId: string;
  readonly initiatingActor: string;
  readonly affectedDomains: readonly GovernanceDomain[];
  readonly impactedInvariants: readonly string[];
  /** True if this override asserts replay implications (touchesReplay). */
  readonly hasReplayImplications: boolean;
  /** True if this override asserts ambiguity-erasure implications (heuristic). */
  readonly hasAmbiguityImplications: boolean;
  /** Downstream-risk score 0..100; combines kind risk, domain count, replay/ambig flags. */
  readonly downstreamRiskScore: number;
  /** Human-readable severity tier derived from score. */
  readonly severityTier: OverrideRiskLevel;
  /**
   * Cross-domain reach — distinct domains touched. A reach > 1 is normalization-
   * resistant: the rendering surface MUST refuse to collapse it to a single chip.
   */
  readonly crossDomainReach: number;
}

/**
 * Compute blast radius for a single override.
 *
 * Score model (additive, capped at 100):
 *   base                       = overrideRiskSeverity(record.risk)         // 20..90
 *   + 5 per affected domain   (cap +30)
 *   + 5 per impacted invariant (cap +20)
 *   + 25 if touchesReplay
 *   + 15 if scope contains ambiguity-adjacent term
 *   + 10 if renewalCount > 0
 */
export function computeOverrideBlastRadius(
  rec: HumanOverrideRecord,
): OverrideBlastRadius {
  let score = overrideRiskSeverity(rec.risk);

  const domainBoost = Math.min(rec.affectedDomains.length * 5, 30);
  score += domainBoost;

  const invariantBoost = Math.min(rec.impactedInvariants.length * 5, 20);
  score += invariantBoost;

  if (rec.touchesReplay) score += 25;

  const ambigTerms = ["ambiguity", "ambiguous", "r-ambiguous", "unmarkered", "uncertain"];
  const lc = rec.scope.toLowerCase();
  const hasAmbig = ambigTerms.some((t) => lc.includes(t));
  if (hasAmbig) score += 15;

  if (rec.renewalCount > 0) score += 10;

  if (score > 100) score = 100;

  let tier: OverrideRiskLevel = "LOW";
  if (score >= 85) tier = "CRITICAL";
  else if (score >= 65) tier = "HIGH";
  else if (score >= 40) tier = "MEDIUM";

  return Object.freeze({
    overrideId: rec.id,
    initiatingActor: rec.initiatingActor,
    affectedDomains: rec.affectedDomains,
    impactedInvariants: rec.impactedInvariants,
    hasReplayImplications: rec.touchesReplay,
    hasAmbiguityImplications: hasAmbig,
    downstreamRiskScore: score,
    severityTier: tier,
    crossDomainReach: new Set(rec.affectedDomains).size,
  });
}

// ---------------------------------------------------------------------------
// TARGET 4 — Override Decay Semantics
// ---------------------------------------------------------------------------

export const OVERRIDE_DECAY_STATES = [
  "FRESH",
  "DECAYING",
  "STALE",
  "EXPIRED",
  "OVER-RENEWED",
] as const;
export type OverrideDecayState = (typeof OVERRIDE_DECAY_STATES)[number];

export interface OverrideDecayResult {
  readonly overrideId: string;
  readonly state: OverrideDecayState;
  /** 0..1 — fraction of original strength remaining (1 = fresh, 0 = expired). */
  readonly strength: number;
  /** Multiplier ≥ 1 — severity inflation due to staleness + renewals. */
  readonly severityMultiplier: number;
  /** ms since approval. */
  readonly ageMs: number;
  /** ms until expiration (negative = past expiration). */
  readonly remainingMs: number;
  /** True if a forced reassessment is required (recovery review trigger). */
  readonly requiresReassessment: boolean;
}

/**
 * Compute decay state for an override at a given evaluation instant.
 *
 * Strength decays exponentially via the kind's half-life:
 *   strength = 0.5 ^ (ageMs / halfLifeMs)
 *
 * Renewals reduce trust: each renewal multiplies the final strength by 0.7
 * (so renewal count of 3 leaves ~34% of pre-renewal strength).
 *
 * State derivation:
 *   OVER-RENEWED     if renewalCount > MAX_HUMAN_OVERRIDE_RENEWALS
 *   EXPIRED          if remainingMs <= 0
 *   STALE            if strength < 0.25
 *   DECAYING         if strength < 0.6
 *   FRESH            otherwise
 *
 * Reassessment required when STALE / EXPIRED / OVER-RENEWED.
 */
export function computeOverrideDecay(
  rec: HumanOverrideRecord,
  nowIso: string,
): OverrideDecayResult {
  const profile = getOverrideKindProfile(rec.kind);
  const approval = Date.parse(rec.approvalTimestamp);
  const expiration = Date.parse(rec.expirationTimestamp);
  const now = Date.parse(nowIso);

  const ageMs = Number.isFinite(approval) && Number.isFinite(now) ? Math.max(0, now - approval) : 0;
  const remainingMs =
    Number.isFinite(expiration) && Number.isFinite(now) ? expiration - now : 0;

  const exponentialStrength = Math.pow(0.5, ageMs / profile.halfLifeMs);
  const renewalPenalty = Math.pow(0.7, Math.max(0, rec.renewalCount));
  let strength = exponentialStrength * renewalPenalty;
  if (strength < 0) strength = 0;
  if (strength > 1) strength = 1;

  let state: OverrideDecayState;
  if (rec.renewalCount > MAX_HUMAN_OVERRIDE_RENEWALS) {
    state = "OVER-RENEWED";
  } else if (remainingMs <= 0) {
    state = "EXPIRED";
  } else if (strength < 0.25) {
    state = "STALE";
  } else if (strength < 0.6) {
    state = "DECAYING";
  } else {
    state = "FRESH";
  }

  // Severity multiplier: 1 + (1 - strength) + 0.25 * renewalCount
  const severityMultiplier = 1 + (1 - strength) + 0.25 * Math.max(0, rec.renewalCount);

  const requiresReassessment =
    state === "STALE" || state === "EXPIRED" || state === "OVER-RENEWED";

  return Object.freeze({
    overrideId: rec.id,
    state,
    strength,
    severityMultiplier,
    ageMs,
    remainingMs,
    requiresReassessment,
  });
}

// ---------------------------------------------------------------------------
// TARGET 7 — CI gate detector (data shape; CLI consumes it)
// ---------------------------------------------------------------------------

export type OverrideDisciplineFinding =
  | { readonly tag: "validation-error"; readonly overrideId: string; readonly error: OverrideIntegrityError }
  | { readonly tag: "decay-state"; readonly overrideId: string; readonly state: OverrideDecayState }
  | { readonly tag: "blast-radius"; readonly overrideId: string; readonly tier: OverrideRiskLevel; readonly score: number }
  | { readonly tag: "recursive-chain"; readonly overrideIds: readonly string[] };

export interface OverrideDisciplineReport {
  readonly executedAt: string;
  readonly recordsEvaluated: number;
  readonly findings: readonly OverrideDisciplineFinding[];
  /** True iff any CI-gating condition is present. */
  readonly hasCiGatingCondition: boolean;
}

/**
 * Build a discipline report for a set of records at a given evaluation instant.
 *
 * CI-gating conditions (any of):
 *   - any validation error
 *   - any decay state in {STALE, EXPIRED, OVER-RENEWED}
 *   - any blast-radius tier == CRITICAL
 *   - any recursive override chain detected
 */
export function buildOverrideDisciplineReport(
  records: readonly HumanOverrideRecord[],
  nowIso: string,
): OverrideDisciplineReport {
  const findings: OverrideDisciplineFinding[] = [];
  let gating = false;

  for (const rec of records) {
    for (const error of validateHumanOverride(rec)) {
      findings.push({ tag: "validation-error", overrideId: rec.id, error });
      gating = true;
    }
    const decay = computeOverrideDecay(rec, nowIso);
    findings.push({ tag: "decay-state", overrideId: rec.id, state: decay.state });
    if (decay.state !== "FRESH" && decay.state !== "DECAYING") gating = true;

    const blast = computeOverrideBlastRadius(rec);
    findings.push({
      tag: "blast-radius",
      overrideId: rec.id,
      tier: blast.severityTier,
      score: blast.downstreamRiskScore,
    });
    if (blast.severityTier === "CRITICAL") gating = true;
  }

  const cycleIds = detectRecursiveOverrideChains(records);
  if (cycleIds.length > 0) {
    findings.push({ tag: "recursive-chain", overrideIds: cycleIds });
    gating = true;
  }

  return Object.freeze({
    executedAt: nowIso,
    recordsEvaluated: records.length,
    findings,
    hasCiGatingCondition: gating,
  });
}

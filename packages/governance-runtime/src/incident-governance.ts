/**
 * Incident governance + SEV semantics (W2-PR35A).
 *
 * Operationalizes governance/replay/ambiguity/override incidents with a
 * canonical SEV taxonomy, lifecycle states, and blast-radius derivation.
 * Builds on:
 *   - HumanOverrideRecord (W2-PR29A)
 *   - GovernanceLedger     (W2-PR30A)
 *   - REPLAY_TRANSITIONS    (W2-PR20A)
 *
 * Lexicon-aligned: incidents are "audit-traceable governance events"; we
 * do not claim cryptographic non-repudiation or replay-protection.
 *
 * Non-negotiable rules (W2-PR35A):
 *   - fail-closed escalation
 *   - ambiguity escalation visible
 *   - replay incidents historically preserved
 *   - incident blast radius explicit
 *   - operator discipline enforced
 */

import type { GovernanceDomain } from "./meta-verification.js";
import type { ReplayState } from "./replay-state.js";

// ---------------------------------------------------------------------------
// TARGET 1 — Governance SEV taxonomy
// ---------------------------------------------------------------------------

/**
 * Canonical SEV severity. Higher = more severe; ordering is fixed.
 *
 *   SEV-1 — outage / fail-closed engaged / replay collapse witnessed
 *   SEV-2 — degraded confidence / contradiction firing / chronic override
 *   SEV-3 — ambiguity persistent / drift trajectory rising
 *   SEV-4 — observability gap / single-domain caution
 *   SEV-5 — informational; record-only
 */
export const SEV_LEVELS = ["SEV-1", "SEV-2", "SEV-3", "SEV-4", "SEV-5"] as const;
export type SevLevel = (typeof SEV_LEVELS)[number];

const SEV_NUMERIC: Readonly<Record<SevLevel, number>> = Object.freeze({
  "SEV-1": 1,
  "SEV-2": 2,
  "SEV-3": 3,
  "SEV-4": 4,
  "SEV-5": 5,
});

export function sevSeverity(s: SevLevel): number {
  return SEV_NUMERIC[s];
}

export function maxSev(a: SevLevel, b: SevLevel): SevLevel {
  return sevSeverity(a) <= sevSeverity(b) ? a : b;
}

/** Distinct incident kinds. Each kind has a per-kind SEV floor. */
export const INCIDENT_KINDS = [
  "GOVERNANCE",
  "REPLAY",
  "AMBIGUITY",
  "OVERRIDE",
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

const KIND_SEV_FLOOR: Readonly<Record<IncidentKind, SevLevel>> = Object.freeze({
  GOVERNANCE: "SEV-3",
  REPLAY: "SEV-2", // replay incidents are escalated; ambiguity must remain visible
  AMBIGUITY: "SEV-3",
  OVERRIDE: "SEV-2",
});

export function kindSevFloor(k: IncidentKind): SevLevel {
  return KIND_SEV_FLOOR[k];
}

// ---------------------------------------------------------------------------
// Incident lifecycle
// ---------------------------------------------------------------------------

export const INCIDENT_LIFECYCLE_STATES = [
  "DETECTED",
  "TRIAGED",
  "MITIGATED",
  "RESOLVED",
  "POSTMORTEM-OPEN",
  "POSTMORTEM-CLOSED",
] as const;
export type IncidentLifecycleState = (typeof INCIDENT_LIFECYCLE_STATES)[number];

interface AllowedIncidentTransition {
  readonly from: IncidentLifecycleState;
  readonly to: IncidentLifecycleState;
  readonly evidenceRequired: string;
}

export const INCIDENT_TRANSITIONS: readonly AllowedIncidentTransition[] = Object.freeze([
  { from: "DETECTED", to: "TRIAGED", evidenceRequired: "operator acknowledgement + classification" },
  { from: "TRIAGED", to: "MITIGATED", evidenceRequired: "remediation evidence (audit row, override entry)" },
  { from: "MITIGATED", to: "RESOLVED", evidenceRequired: "stable-window observation + sign-off" },
  { from: "RESOLVED", to: "POSTMORTEM-OPEN", evidenceRequired: "postmortem doc reference" },
  { from: "POSTMORTEM-OPEN", to: "POSTMORTEM-CLOSED", evidenceRequired: "founder + operator sign-off + action items recorded" },
  // Reopen path — explicit, not silent
  { from: "RESOLVED", to: "DETECTED", evidenceRequired: "new symptom witnessed; reopens prior incident with reason" },
  { from: "MITIGATED", to: "DETECTED", evidenceRequired: "mitigation insufficient; reopens with reason" },
]);

export function isAllowedIncidentTransition(
  from: IncidentLifecycleState,
  to: IncidentLifecycleState,
): AllowedIncidentTransition | null {
  if (from === to) return { from, to, evidenceRequired: "no-op" };
  for (const t of INCIDENT_TRANSITIONS) {
    if (t.from === from && t.to === to) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Incident record
// ---------------------------------------------------------------------------

export interface GovernanceIncident {
  readonly id: string;
  readonly kind: IncidentKind;
  readonly sev: SevLevel;
  readonly state: IncidentLifecycleState;
  readonly detectedAt: string;
  readonly resolvedAt?: string | null;
  readonly affectedDomains: readonly GovernanceDomain[];
  /** For REPLAY incidents: the involved replay state(s). */
  readonly involvedReplayStates?: readonly ReplayState[];
  /** Whether the incident touches the replay axis (drives blast-radius). */
  readonly touchesReplay: boolean;
  /** Whether the incident touches ambiguity-bearing surfaces. */
  readonly touchesAmbiguity: boolean;
  /** Override id if this incident is override-driven (W2-PR29A cross-link). */
  readonly relatedOverrideId?: string | null;
  /** Free-form description of the symptom. */
  readonly symptom: string;
  /** Required for non-DETECTED state — link to remediation evidence. */
  readonly remediationRef?: string | null;
  /** Required for POSTMORTEM-CLOSED — link to closed postmortem. */
  readonly postmortemRef?: string | null;
}

// ---------------------------------------------------------------------------
// TARGET 2/3/5 — Validators (replay degradation + ambiguity escalation +
//                            override discipline)
// ---------------------------------------------------------------------------

export type IncidentValidationError =
  | { readonly tag: "missing-field"; readonly field: keyof GovernanceIncident }
  | { readonly tag: "unknown-kind"; readonly value: string }
  | { readonly tag: "unknown-sev"; readonly value: string }
  | { readonly tag: "unknown-state"; readonly value: string }
  | { readonly tag: "sev-below-kind-floor"; readonly kind: IncidentKind; readonly declared: SevLevel; readonly minimum: SevLevel }
  | { readonly tag: "replay-incident-without-replay-touch" }
  | { readonly tag: "replay-state-on-non-replay-incident" }
  | { readonly tag: "ambiguity-incident-must-touch-ambiguity" }
  | { readonly tag: "override-incident-missing-related-override" }
  | { readonly tag: "non-detected-without-remediation-ref" }
  | { readonly tag: "postmortem-closed-without-ref" }
  | { readonly tag: "resolved-before-detected" }
  | { readonly tag: "affected-domains-empty" };

export function validateIncident(
  inc: Partial<GovernanceIncident>,
): readonly IncidentValidationError[] {
  const errors: IncidentValidationError[] = [];
  const required: readonly (keyof GovernanceIncident)[] = [
    "id",
    "kind",
    "sev",
    "state",
    "detectedAt",
    "affectedDomains",
    "touchesReplay",
    "touchesAmbiguity",
    "symptom",
  ];
  for (const f of required) {
    const v = inc[f];
    if (v === undefined || v === null || v === "") {
      errors.push({ tag: "missing-field", field: f });
    }
  }

  if (inc.kind && !(INCIDENT_KINDS as readonly string[]).includes(inc.kind)) {
    errors.push({ tag: "unknown-kind", value: String(inc.kind) });
  }
  if (inc.sev && !(SEV_LEVELS as readonly string[]).includes(inc.sev)) {
    errors.push({ tag: "unknown-sev", value: String(inc.sev) });
  }
  if (inc.state && !(INCIDENT_LIFECYCLE_STATES as readonly string[]).includes(inc.state)) {
    errors.push({ tag: "unknown-state", value: String(inc.state) });
  }

  if (inc.kind && inc.sev && (SEV_LEVELS as readonly string[]).includes(inc.sev)) {
    const floor = kindSevFloor(inc.kind);
    if (sevSeverity(inc.sev as SevLevel) > sevSeverity(floor)) {
      errors.push({
        tag: "sev-below-kind-floor",
        kind: inc.kind,
        declared: inc.sev as SevLevel,
        minimum: floor,
      });
    }
  }

  if (Array.isArray(inc.affectedDomains) && inc.affectedDomains.length === 0) {
    errors.push({ tag: "affected-domains-empty" });
  }

  if (inc.kind === "REPLAY" && inc.touchesReplay !== true) {
    errors.push({ tag: "replay-incident-without-replay-touch" });
  }
  if (
    inc.kind !== "REPLAY" &&
    Array.isArray(inc.involvedReplayStates) &&
    inc.involvedReplayStates.length > 0
  ) {
    errors.push({ tag: "replay-state-on-non-replay-incident" });
  }
  if (inc.kind === "AMBIGUITY" && inc.touchesAmbiguity !== true) {
    errors.push({ tag: "ambiguity-incident-must-touch-ambiguity" });
  }
  if (inc.kind === "OVERRIDE" && (!inc.relatedOverrideId || inc.relatedOverrideId === "")) {
    errors.push({ tag: "override-incident-missing-related-override" });
  }

  if (inc.state && inc.state !== "DETECTED") {
    if (!inc.remediationRef) {
      errors.push({ tag: "non-detected-without-remediation-ref" });
    }
  }
  if (inc.state === "POSTMORTEM-CLOSED" && !inc.postmortemRef) {
    errors.push({ tag: "postmortem-closed-without-ref" });
  }

  if (
    typeof inc.detectedAt === "string" &&
    typeof inc.resolvedAt === "string"
  ) {
    if (Date.parse(inc.resolvedAt) < Date.parse(inc.detectedAt)) {
      errors.push({ tag: "resolved-before-detected" });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Blast radius (TARGET — incident blast radius explicit)
// ---------------------------------------------------------------------------

export interface IncidentBlastRadius {
  readonly incidentId: string;
  readonly affectedDomainCount: number;
  readonly hasReplayImplications: boolean;
  readonly hasAmbiguityImplications: boolean;
  readonly relatedOverrideId: string | null;
  /** 0..100 composite. */
  readonly score: number;
  readonly tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export function computeIncidentBlastRadius(inc: GovernanceIncident): IncidentBlastRadius {
  let score = (6 - sevSeverity(inc.sev)) * 15; // SEV-1 → 75, SEV-5 → 15
  score += Math.min(inc.affectedDomains.length * 5, 25);
  if (inc.touchesReplay) score += 15;
  if (inc.touchesAmbiguity) score += 10;
  if (inc.relatedOverrideId) score += 10;
  if (score > 100) score = 100;

  let tier: IncidentBlastRadius["tier"] = "LOW";
  if (score >= 85) tier = "CRITICAL";
  else if (score >= 65) tier = "HIGH";
  else if (score >= 40) tier = "MEDIUM";

  return Object.freeze({
    incidentId: inc.id,
    affectedDomainCount: new Set(inc.affectedDomains).size,
    hasReplayImplications: inc.touchesReplay,
    hasAmbiguityImplications: inc.touchesAmbiguity,
    relatedOverrideId: inc.relatedOverrideId ?? null,
    score,
    tier,
  });
}

// ---------------------------------------------------------------------------
// TARGET 7 — CI gate report
// ---------------------------------------------------------------------------

export type IncidentFinding =
  | { readonly tag: "validation-error"; readonly incidentId: string; readonly error: IncidentValidationError }
  | { readonly tag: "open-sev1"; readonly incidentId: string }
  | { readonly tag: "ambiguity-erasure-attempted"; readonly incidentId: string }
  | { readonly tag: "replay-incident-resolved-without-postmortem"; readonly incidentId: string }
  | { readonly tag: "blast-tier"; readonly incidentId: string; readonly tier: IncidentBlastRadius["tier"]; readonly score: number };

export interface IncidentGovernanceReport {
  readonly executedAt: string;
  readonly incidentsEvaluated: number;
  readonly findings: readonly IncidentFinding[];
  /** True iff any CI-gating finding present. */
  readonly hasCiGatingCondition: boolean;
}

/**
 * Build a discipline report for a set of incidents. Gating triggers:
 *   - any validation error
 *   - any open SEV-1 (state != RESOLVED, POSTMORTEM-OPEN, POSTMORTEM-CLOSED)
 *   - REPLAY incident reaching RESOLVED without POSTMORTEM trail
 *   - any blast tier == CRITICAL
 *   - any "ambiguity-erasure-attempted" tag (caller flags this)
 */
export function buildIncidentGovernanceReport(
  incidents: readonly GovernanceIncident[],
  nowIso: string,
): IncidentGovernanceReport {
  const findings: IncidentFinding[] = [];
  let gating = false;

  for (const inc of incidents) {
    for (const e of validateIncident(inc)) {
      findings.push({ tag: "validation-error", incidentId: inc.id, error: e });
      gating = true;
    }
    if (
      inc.sev === "SEV-1" &&
      inc.state !== "RESOLVED" &&
      inc.state !== "POSTMORTEM-OPEN" &&
      inc.state !== "POSTMORTEM-CLOSED"
    ) {
      findings.push({ tag: "open-sev1", incidentId: inc.id });
      gating = true;
    }
    if (
      inc.kind === "REPLAY" &&
      inc.state === "RESOLVED" &&
      !inc.postmortemRef
    ) {
      findings.push({
        tag: "replay-incident-resolved-without-postmortem",
        incidentId: inc.id,
      });
      gating = true;
    }
    const blast = computeIncidentBlastRadius(inc);
    findings.push({ tag: "blast-tier", incidentId: inc.id, tier: blast.tier, score: blast.score });
    if (blast.tier === "CRITICAL") gating = true;
  }

  return Object.freeze({
    executedAt: nowIso,
    incidentsEvaluated: incidents.length,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}

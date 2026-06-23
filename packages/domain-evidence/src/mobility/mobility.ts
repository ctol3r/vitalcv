/**
 * Mobility engine (Wave 270 — implements the W230 design).
 *
 * Pure, deterministic. Evaluates a clinician's EvidenceCollection + TrustProjection
 * against an OpportunityObject to produce gaps and a readiness verdict. NO matching
 * ML, NO ranking (that is W260). Honesty carries through from the trust layer:
 * a mandatory requirement is satisfied ONLY by decision-grade ('checked') evidence;
 * `ready` is unreachable otherwise; absent evidence is honest `unknown`, not failure.
 *
 * See docs/wave230/C2..C5.
 */

import type { EvidenceClass, EvidenceCollection, EvidenceObject, EvidenceStatus } from '../types';
import { isDecisionGradeStatus } from '../collection';
import type { TrustDimension, TrustProjection } from '../trust/propagate';

// ── Opportunity model (W230-C2) ──────────────────────────────────────────────

export type RequirementNecessity = 'mandatory' | 'preferred';

interface RequirementBase {
  requirementId: string;
  label: string;
  necessity: RequirementNecessity;
}

export interface EvidenceRequirement extends RequirementBase {
  kind: 'evidence';
  evidenceClass: EvidenceClass;
  /** Minimum status that satisfies it. Defaults to decision-grade ('checked'). */
  minStatus: EvidenceStatus;
  /** Optional jurisdiction constraint (the mobility axis), e.g. 'CA'. */
  jurisdiction?: string;
}

export interface TrustRequirement extends RequirementBase {
  kind: 'trust';
  dimension: TrustDimension;
  minScore: number;
}

export interface ExperienceRequirement extends RequirementBase {
  kind: 'experience';
  dimension: TrustDimension;
  minDecisionGradeCount: number;
}

export type OpportunityRequirement = EvidenceRequirement | TrustRequirement | ExperienceRequirement;

export interface OpportunityObject {
  opportunityId: string;
  title: string;
  organizationKey: string | null;
  specialty: string | null;
  states: string[];
  requirements: OpportunityRequirement[];
  schema: 'vitalcv.opportunity.v1';
}

// ── Gap model (W230-C3) ──────────────────────────────────────────────────────

export type GapKind = 'satisfied' | 'missing' | 'insufficient' | 'stale';

export interface GapRemediation {
  type: 'request_refresh' | 'apply_endorsement' | 'submit_evidence' | 'await_review';
  detail: string;
  /** Wired from the readiness engine at the app layer; null in the pure layer. */
  estimatedDays: number | null;
}

export interface Gap {
  requirementId: string;
  label: string;
  necessity: RequirementNecessity;
  kind: GapKind;
  reason: string;
  blockingEvidenceIds: string[];
  remediation: GapRemediation | null;
}

export interface GapReport {
  opportunityId: string;
  subjectKey: string;
  gaps: Gap[];
  mandatoryUnmet: number;
  preferredUnmet: number;
}

// ── Readiness model (W230-C5) ────────────────────────────────────────────────

export type MobilityReadiness = 'ready' | 'near_ready' | 'blocked' | 'unknown';

export interface ReadinessProjection {
  subjectKey: string;
  opportunityId: string;
  readiness: MobilityReadiness;
  rationale: string;
  blockers: string[];
  fixableGaps: string[];
  estimatedStartDays: number | null;
}

export interface MobilityOverview {
  subjectKey: string;
  mobilityTrust: number | null;
  /** Decision-grade licensure/registration jurisdictions. */
  licensedStates: string[];
  reusableEvidenceCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jurisdictionOf(obj: EvidenceObject): string | null {
  if (obj.value && typeof obj.value === 'object' && !Array.isArray(obj.value)) {
    const j = (obj.value as Record<string, unknown>).jurisdiction;
    if (typeof j === 'string' && j.trim().length > 0) return j.trim();
  }
  return null;
}

/** A requirement's minStatus is satisfied only by an equal-or-decision-grade status. */
function statusSatisfies(actual: EvidenceStatus, min: EvidenceStatus): boolean {
  if (min === 'checked') return actual === 'checked';
  return actual === 'checked' || actual === min;
}

function dimensionOf(trust: TrustProjection, dimension: TrustDimension) {
  return trust.dimensions.find((d) => d.dimension === dimension) ?? null;
}

// ── detectGaps (W230-C3) ─────────────────────────────────────────────────────

function evaluateEvidenceRequirement(req: EvidenceRequirement, collection: EvidenceCollection): Gap {
  const candidates = (collection.byClass[req.evidenceClass] ?? []).filter((o) =>
    req.jurisdiction ? jurisdictionOf(o) === req.jurisdiction : true,
  );

  // A MANDATORY requirement is satisfied only by decision-grade ('checked')
  // evidence regardless of its declared minStatus — a gated/stale mandatory lane
  // can never make a clinician 'ready' (fail-closed readiness honesty).
  const effectiveMinStatus: EvidenceStatus = req.necessity === 'mandatory' ? 'checked' : req.minStatus;
  const satisfied = candidates.find((o) => statusSatisfies(o.status, effectiveMinStatus));
  if (satisfied) {
    return { requirementId: req.requirementId, label: req.label, necessity: req.necessity, kind: 'satisfied', reason: `${req.label} satisfied by ${satisfied.evidenceId}.`, blockingEvidenceIds: [], remediation: null };
  }

  if (candidates.length > 0) {
    const present = candidates[0];
    const stale = present.status === 'stale';
    return {
      requirementId: req.requirementId,
      label: req.label,
      necessity: req.necessity,
      kind: stale ? 'stale' : 'insufficient',
      reason: `${req.label} present but ${present.status}, not decision-grade.`,
      blockingEvidenceIds: candidates.map((c) => c.evidenceId),
      remediation: { type: stale ? 'request_refresh' : 'await_review', detail: `Resolve ${present.status} ${req.label}.`, estimatedDays: null },
    };
  }

  // No evidence at all. A jurisdiction-scoped license gap has an endorsement path.
  return {
    requirementId: req.requirementId,
    label: req.label,
    necessity: req.necessity,
    kind: 'missing',
    reason: req.jurisdiction ? `No decision-grade ${req.label} for ${req.jurisdiction}.` : `No decision-grade ${req.label} on file.`,
    blockingEvidenceIds: [],
    remediation: req.jurisdiction
      ? { type: 'apply_endorsement', detail: `Apply for ${req.jurisdiction} licensure (endorsement/compact path).`, estimatedDays: null }
      : { type: 'submit_evidence', detail: `Submit ${req.label} for source verification.`, estimatedDays: null },
  };
}

function evaluateTrustRequirement(req: TrustRequirement, trust: TrustProjection): Gap {
  const dim = dimensionOf(trust, req.dimension);
  const base = { requirementId: req.requirementId, label: req.label, necessity: req.necessity, blockingEvidenceIds: dim?.weakening ?? [] };
  if (!dim || dim.score === null) {
    return { ...base, kind: 'missing', reason: `No ${req.dimension} evidence to meet ${req.minScore}.`, remediation: { type: 'submit_evidence', detail: `Add source-backed ${req.dimension} evidence.`, estimatedDays: null } };
  }
  if (dim.score < req.minScore) {
    return { ...base, kind: 'insufficient', reason: `${req.dimension} trust ${dim.score} < required ${req.minScore}.`, remediation: { type: 'await_review', detail: `Strengthen ${req.dimension} evidence.`, estimatedDays: null } };
  }
  return { ...base, kind: 'satisfied', reason: `${req.dimension} trust ${dim.score} ≥ ${req.minScore}.`, blockingEvidenceIds: [], remediation: null };
}

function evaluateExperienceRequirement(req: ExperienceRequirement, trust: TrustProjection): Gap {
  const dim = dimensionOf(trust, req.dimension);
  const count = dim?.decisionGradeCount ?? 0;
  const base = { requirementId: req.requirementId, label: req.label, necessity: req.necessity, blockingEvidenceIds: [] as string[] };
  if (count >= req.minDecisionGradeCount) {
    return { ...base, kind: 'satisfied', reason: `${count} decision-grade ${req.dimension} items ≥ ${req.minDecisionGradeCount}.`, remediation: null };
  }
  return {
    ...base,
    kind: count === 0 ? 'missing' : 'insufficient',
    reason: `${count} decision-grade ${req.dimension} items < required ${req.minDecisionGradeCount}.`,
    remediation: { type: 'submit_evidence', detail: `Add ${req.minDecisionGradeCount - count} more decision-grade ${req.dimension} item(s).`, estimatedDays: null },
  };
}

export function detectGaps(
  opportunity: OpportunityObject,
  collection: EvidenceCollection,
  trust: TrustProjection,
): GapReport {
  const gaps = opportunity.requirements.map((req) => {
    if (req.kind === 'evidence') return evaluateEvidenceRequirement(req, collection);
    if (req.kind === 'trust') return evaluateTrustRequirement(req, trust);
    return evaluateExperienceRequirement(req, trust);
  });

  // Deterministic order: mandatory first, then requirementId.
  gaps.sort((a, b) => {
    if (a.necessity !== b.necessity) return a.necessity === 'mandatory' ? -1 : 1;
    return a.requirementId.localeCompare(b.requirementId);
  });

  const unmet = (g: Gap) => g.kind !== 'satisfied';
  return {
    opportunityId: opportunity.opportunityId,
    subjectKey: collection.subjectKey,
    gaps,
    mandatoryUnmet: gaps.filter((g) => g.necessity === 'mandatory' && unmet(g)).length,
    preferredUnmet: gaps.filter((g) => g.necessity === 'preferred' && unmet(g)).length,
  };
}

// ── projectReadiness (W230-C5) ───────────────────────────────────────────────

export function projectReadiness(
  opportunity: OpportunityObject,
  gaps: GapReport,
  trust: TrustProjection,
): ReadinessProjection {
  const mandatory = gaps.gaps.filter((g) => g.necessity === 'mandatory');
  const mandatoryUnmet = mandatory.filter((g) => g.kind !== 'satisfied');
  const unremediable = mandatoryUnmet.filter((g) => g.kind === 'missing' && g.remediation === null);
  const fixable = mandatoryUnmet.filter((g) => g.remediation !== null);

  let readiness: MobilityReadiness;
  let rationale: string;

  if (unremediable.length > 0) {
    readiness = 'blocked';
    rationale = `Blocked: ${unremediable.length} mandatory requirement(s) missing with no remediation path.`;
  } else if (trust.overall.decisionGradeEvidence === 0) {
    readiness = 'unknown';
    rationale = 'Unknown: no decision-grade evidence checked yet.';
  } else if (mandatoryUnmet.length === 0) {
    readiness = 'ready';
    rationale = 'Ready: all mandatory requirements satisfied by decision-grade evidence.';
  } else if (fixable.length === mandatoryUnmet.length) {
    readiness = 'near_ready';
    rationale = `Near ready: ${fixable.length} mandatory gap(s) have a remediation path.`;
  } else {
    readiness = 'unknown';
    rationale = 'Unknown: coverage incomplete; manual review recommended.';
  }

  return {
    subjectKey: gaps.subjectKey,
    opportunityId: opportunity.opportunityId,
    readiness,
    rationale,
    blockers: unremediable.map((g) => g.reason),
    fixableGaps: fixable.map((g) => g.requirementId),
    estimatedStartDays: null,
  };
}

// ── Overview (W230-C4 §1) ────────────────────────────────────────────────────

export function deriveMobilityOverview(collection: EvidenceCollection, trust: TrustProjection): MobilityOverview {
  const states = new Set<string>();
  for (const obj of collection.objects) {
    if ((obj.evidenceClass === 'licensure' || obj.evidenceClass === 'registration') && isDecisionGradeStatus(obj.status)) {
      const j = jurisdictionOf(obj);
      if (j) states.add(j);
    }
  }
  return {
    subjectKey: collection.subjectKey,
    mobilityTrust: dimensionOf(trust, 'mobility')?.score ?? null,
    licensedStates: [...states].sort(),
    reusableEvidenceCount: collection.objects.filter((o) => o.decisionGrade).length,
  };
}

// ── Default readiness template (a standard template, NOT a specific employer post) ──

export function defaultReadinessTemplate(state?: string, specialty?: string): OpportunityObject {
  const stateLabel = state ? ` (${state})` : '';
  return {
    opportunityId: state ? `standard-readiness:${state}` : 'standard-readiness',
    title: `Standard readiness template${stateLabel}`,
    organizationKey: null,
    specialty: specialty ?? null,
    states: state ? [state] : [],
    schema: 'vitalcv.opportunity.v1',
    requirements: [
      { kind: 'evidence', requirementId: 'identity', label: 'Identity verification', necessity: 'mandatory', minStatus: 'checked', evidenceClass: 'identity' },
      { kind: 'evidence', requirementId: 'exclusion', label: 'Exclusion screening', necessity: 'mandatory', minStatus: 'checked', evidenceClass: 'exclusion' },
      { kind: 'evidence', requirementId: 'licensure', label: 'State license', necessity: 'mandatory', minStatus: 'checked', evidenceClass: 'licensure', ...(state ? { jurisdiction: state } : {}) },
      { kind: 'evidence', requirementId: 'enrollment', label: 'Medicare enrollment', necessity: 'preferred', minStatus: 'checked', evidenceClass: 'enrollment' },
    ],
  };
}

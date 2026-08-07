/**
 * Truth-boundary enforcement for Start Agent plans.
 *
 * Two layers, both fail-closed:
 *
 *  1. `validateStartPlanStructure` — referential and shape integrity: every
 *     blocker answers its six questions, ids resolve both ways, ranked
 *     actions are actually rankable, permission/owner combinations are
 *     coherent.
 *  2. `auditTruthBoundaries` — the plan (all agent-authored text plus
 *     structural state) may not assert anything the canonical context does
 *     not support. Uses the shared forbidden-claim vocabulary.
 *
 * The policy engine runs both before returning a plan and THROWS on any
 * violation — a plan that collapses a truth boundary is unrepresentable as
 * policy output, not merely discouraged. START-Bench runs the same functions
 * over every scenario output.
 */
import type {
  AgentAction,
  StartAgentContext,
  StartBlocker,
  StartPlan,
} from './types';
import { scanTextForForbiddenClaims } from './forbidden-claims';

export interface TruthViolation {
  code: string;
  /** Where in the plan the violation sits, e.g. `action:act_x.title`. */
  subjectPath: string;
  detail: string;
}

export class TruthContractViolationError extends Error {
  readonly violations: TruthViolation[];
  constructor(violations: TruthViolation[]) {
    super(
      `Start Agent truth contract violated (${violations.length}): ` +
        violations.map((v) => `${v.code}@${v.subjectPath}`).join(', '),
    );
    this.name = 'TruthContractViolationError';
    this.violations = violations;
  }
}

/** Action statuses that may appear in `rankedActionIds`. */
const RANKABLE_STATUSES = new Set<AgentAction['status']>([
  'ready',
  'awaiting_consent',
  'awaiting_external',
]);

// ---------------------------------------------------------------------------
// Layer 1 — structure
// ---------------------------------------------------------------------------

export function validateStartPlanStructure(plan: StartPlan): TruthViolation[] {
  const violations: TruthViolation[] = [];
  const actionIds = new Set(plan.actions.map((a) => a.id));
  const blockerIds = new Set(plan.blockers.map((b) => b.id));

  for (const blocker of plan.blockers) {
    const path = `blocker:${blocker.id}`;
    if (!blocker.what.trim()) {
      violations.push({ code: 'blocker_missing_what', subjectPath: path, detail: 'Q1 unanswered.' });
    }
    if (!blocker.whyItMatters.trim()) {
      violations.push({ code: 'blocker_missing_why', subjectPath: path, detail: 'Q2 unanswered.' });
    }
    if (blocker.evidenceRefs.length === 0) {
      violations.push({
        code: 'blocker_without_evidence',
        subjectPath: path,
        detail: 'Q4 unanswered: every blocker must cite at least one evidence ref.',
      });
    }
    if (blocker.resolvableByActionIds.length === 0) {
      violations.push({
        code: 'blocker_without_action',
        subjectPath: path,
        detail:
          'Q5 unanswered: every blocker must link at least one action (an await/informational action when nothing else is honest).',
      });
    }
    for (const actionRef of blocker.resolvableByActionIds) {
      if (!actionIds.has(actionRef)) {
        violations.push({
          code: 'dangling_action_ref',
          subjectPath: path,
          detail: `resolvableByActionIds references missing action ${actionRef}.`,
        });
      }
    }
    for (const dep of blocker.dependsOnBlockerIds) {
      if (!blockerIds.has(dep)) {
        violations.push({
          code: 'dangling_blocker_dep',
          subjectPath: path,
          detail: `dependsOnBlockerIds references missing blocker ${dep}.`,
        });
      }
    }
  }

  for (const action of plan.actions) {
    const path = `action:${action.id}`;
    if (action.permission === 'human_only' && action.owner === 'vitalcv') {
      violations.push({
        code: 'human_only_owned_by_vitalcv',
        subjectPath: path,
        detail: 'human_only means VitalCV cannot do it; VitalCV cannot own it.',
      });
    }
    if (action.permission === 'execute_with_consent' && !action.consentScope) {
      violations.push({
        code: 'consent_action_without_scope',
        subjectPath: path,
        detail: 'execute_with_consent actions must name the consent scope they wait on.',
      });
    }
    for (const dep of action.dependencies) {
      if (!actionIds.has(dep)) {
        violations.push({
          code: 'dangling_action_dep',
          subjectPath: path,
          detail: `dependencies references missing action ${dep}.`,
        });
      }
    }
    for (const blockerRef of action.resolvesBlockerIds) {
      if (!blockerIds.has(blockerRef)) {
        violations.push({
          code: 'dangling_blocker_ref',
          subjectPath: path,
          detail: `resolvesBlockerIds references missing blocker ${blockerRef}.`,
        });
      }
    }
  }

  const ranked = new Set<string>();
  for (const id of plan.rankedActionIds) {
    if (ranked.has(id)) {
      violations.push({
        code: 'duplicate_ranked_action',
        subjectPath: `plan:rankedActionIds`,
        detail: `${id} appears more than once.`,
      });
    }
    ranked.add(id);
    const action = plan.actions.find((a) => a.id === id);
    if (!action) {
      violations.push({
        code: 'ranked_unknown_action',
        subjectPath: `plan:rankedActionIds`,
        detail: `${id} is not in the plan's action set.`,
      });
      continue;
    }
    if (!RANKABLE_STATUSES.has(action.status)) {
      violations.push({
        code: 'ranked_unrankable_status',
        subjectPath: `action:${id}`,
        detail: `status ${action.status} may not appear in the ranked list.`,
      });
    }
  }

  if (!plan.policyVersion.trim() || !plan.toolsetVersion.trim()) {
    violations.push({
      code: 'missing_version_stamp',
      subjectPath: 'plan',
      detail: 'policyVersion and toolsetVersion are mandatory provenance.',
    });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Layer 2 — truth boundaries against the consumed context
// ---------------------------------------------------------------------------

function textFieldsOf(plan: StartPlan): Array<{ path: string; text: string }> {
  const fields: Array<{ path: string; text: string }> = [];
  for (const blocker of plan.blockers) {
    fields.push({ path: `blocker:${blocker.id}.what`, text: blocker.what });
    fields.push({ path: `blocker:${blocker.id}.whyItMatters`, text: blocker.whyItMatters });
  }
  for (const action of plan.actions) {
    fields.push({ path: `action:${action.id}.title`, text: action.title });
    fields.push({ path: `action:${action.id}.reason`, text: action.reason });
    fields.push({ path: `action:${action.id}.expectedOutcome`, text: action.expectedOutcome });
  }
  return fields;
}

export function auditTruthBoundaries(
  plan: StartPlan,
  context: StartAgentContext,
): TruthViolation[] {
  const violations: TruthViolation[] = [];

  // Text layer: every agent-authored sentence, against the shared vocabulary.
  for (const { path, text } of textFieldsOf(plan)) {
    for (const hit of scanTextForForbiddenClaims(text, context)) {
      violations.push({ code: hit.code, subjectPath: path, detail: hit.detail });
    }
  }

  // Structural layer.
  const grantedScopes = new Set(context.consents.filter((c) => c.granted).map((c) => c.scope));
  for (const action of plan.actions) {
    const path = `action:${action.id}`;

    // Consent may never be assumed: without a granted scope, an
    // execute_with_consent action must still be waiting.
    if (
      action.permission === 'execute_with_consent' &&
      action.consentScope &&
      !grantedScopes.has(action.consentScope) &&
      (action.status === 'ready' || action.status === 'completed')
    ) {
      violations.push({
        code: 'consent_assumed',
        subjectPath: path,
        detail: `status ${action.status} without granted consent scope ${action.consentScope}.`,
      });
    }
  }

  // Evidence provenance may not outrank the canonical state that backs it.
  const allRefs = [
    ...plan.blockers.flatMap((b: StartBlocker) => b.evidenceRefs.map((r) => ({ r, path: `blocker:${b.id}` }))),
    ...plan.actions.flatMap((a: AgentAction) => a.evidenceRefs.map((r) => ({ r, path: `action:${a.id}` }))),
  ];
  for (const { r, path } of allRefs) {
    if (r.provenance === 'ownership_verified' && context.ownership.status !== 'verified') {
      violations.push({
        code: 'ownership_provenance_without_verified_state',
        subjectPath: path,
        detail: `evidence ref ${r.ref} claims ownership_verified provenance while ownership is ${context.ownership.status}.`,
      });
    }
    if (r.provenance === 'employer_reviewed' && context.employerReview?.status !== 'reviewed') {
      violations.push({
        code: 'review_provenance_without_reviewed_state',
        subjectPath: path,
        detail: `evidence ref ${r.ref} claims employer_reviewed provenance while review state is ${context.employerReview?.status ?? 'absent'}.`,
      });
    }
  }

  return violations;
}

/** Run both layers; throw when anything fails. The policy's final gate. */
export function assertPlanHonorsTruthContract(
  plan: StartPlan,
  context: StartAgentContext,
): void {
  const violations = [
    ...validateStartPlanStructure(plan),
    ...auditTruthBoundaries(plan, context),
  ];
  if (violations.length > 0) {
    throw new TruthContractViolationError(violations);
  }
}

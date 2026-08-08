/**
 * A2.2 — the decision projection.
 *
 * ## Why this exists
 *
 * `contextFingerprint` and `planId` cannot be used for change detection.
 * Both hash the whole context including `collectedAt`, so they change on
 * every run even when nothing meaningful moved — verified empirically:
 * advancing only the clock changes both while the derived blockers and
 * ranked actions stay byte-identical. Any implementation that reaches for
 * "did the fingerprint change?" reports a change every tick, would wake the
 * clinician every tick, and is wrong every tick.
 *
 * So a plan gets a second, narrower fingerprint over its *decision-relevant*
 * content only: which blockers exist, what each action is and whether it can
 * run, and what is at the top. Never timestamps, never evidence `observedAt`,
 * never the context fingerprint.
 *
 * ## The one deliberate exception
 *
 * The projection also carries each lane's `observedAt`, because detecting
 * "we re-read the source and nothing had changed" inherently requires
 * knowing the reading is new. That field is **excluded from
 * `decisionFingerprint`** — it exists to classify a non-material delta, not
 * to decide whether anything happened.
 */
import { createHash } from 'node:crypto';
import { stableStringify } from '../ids';
import type {
  ActionOwner,
  AgentActionStatus,
  AgentActionType,
  BlockerType,
  ContextCompleteness,
  PermissionClass,
  StartAgentContext,
  StartPlan,
} from '../types';

export interface ProjectedBlocker {
  id: string;
  type: BlockerType;
  controlledBy: ActionOwner;
  vitalcvCanActNow: boolean;
}

export interface ProjectedAction {
  id: string;
  type: AgentActionType;
  owner: ActionOwner;
  permission: PermissionClass;
  status: AgentActionStatus;
  /** Whether this action could run right now, as the plan stands. */
  executable: boolean;
}

export interface ProjectedObservation {
  laneId: string;
  status: string;
  /** NOT part of the decision fingerprint — see the module header. */
  observedAt?: string;
}

/** The small set of context facts a plan diff needs beyond the plan itself. */
export interface ProjectedExternalState {
  employerReview?: string;
  applicationState?: string;
  ownership: string;
}

export interface DecisionProjection {
  /** Version so a projection shape change is detectable, not silently mis-diffed. */
  version: 1;
  completeness: ContextCompleteness;
  actor: string;
  policyVersion: string;
  blockers: ProjectedBlocker[];
  actions: ProjectedAction[];
  rankedActionIds: string[];
  topAction: { id: string; type: AgentActionType; owner: ActionOwner } | null;
  observations: ProjectedObservation[];
  external: ProjectedExternalState;
}

/**
 * An action is executable when the plan says it is ready to run now.
 * `awaiting_consent` is deliberately NOT executable: "approve and I'll do it"
 * is presentable, but nothing runs until the ledger says yes.
 */
export function isExecutable(status: AgentActionStatus): boolean {
  return status === 'ready';
}

export function buildDecisionProjection(
  plan: StartPlan,
  context: StartAgentContext,
): DecisionProjection {
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const topId = plan.rankedActionIds[0];
  const top = topId ? plan.actions.find((a) => a.id === topId) : undefined;

  return {
    version: 1,
    completeness: plan.completeness,
    actor: plan.actor,
    policyVersion: plan.policyVersion,
    blockers: plan.blockers
      .map((b) => ({
        id: b.id,
        type: b.type,
        controlledBy: b.controlledBy,
        vitalcvCanActNow: b.vitalcvCanActNow,
      }))
      .sort(byId),
    actions: plan.actions
      .map((a) => ({
        id: a.id,
        type: a.type,
        owner: a.owner,
        permission: a.permission,
        status: a.status,
        executable: isExecutable(a.status),
      }))
      .sort(byId),
    rankedActionIds: [...plan.rankedActionIds],
    topAction: top ? { id: top.id, type: top.type, owner: top.owner } : null,
    observations: context.observations
      .map((o) => ({
        laneId: o.laneId,
        status: o.status,
        ...(o.observedAt ? { observedAt: o.observedAt } : {}),
      }))
      .sort((a, b) => (a.laneId < b.laneId ? -1 : a.laneId > b.laneId ? 1 : 0)),
    external: {
      ...(context.employerReview ? { employerReview: context.employerReview.status } : {}),
      ...(context.role ? { applicationState: context.role.applicationState } : {}),
      ownership: context.ownership.status,
    },
  };
}

/**
 * Hash of the decision content only. Two runs with the same fingerprint had
 * nothing worth telling anyone about, no matter how much time passed or how
 * many sources were re-read.
 */
export function decisionFingerprint(projection: DecisionProjection): string {
  const { observations, ...decision } = projection;
  // Lane STATUS is decision content; lane `observedAt` is not. Keeping the
  // statuses in and the timestamps out is the whole point of this function.
  const laneStatuses = observations.map((o) => ({ laneId: o.laneId, status: o.status }));
  return createHash('sha256')
    .update(stableStringify({ ...decision, laneStatuses }))
    .digest('hex')
    .slice(0, 32);
}

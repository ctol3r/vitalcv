/**
 * L3 — the outcome join.
 *
 * `AgentEvent.relatedKind`/`relatedRef` were reserved in A0 for exactly this
 * and never written: no plan has ever been joinable to whether it worked.
 * This module is the only writer of `agent_outcome_observed` events, called
 * from the hiring join points (apply, workflow, review, accept, start).
 *
 * Truth posture — three rules, enforced here:
 *
 * 1. OBSERVED, NEVER ATTRIBUTED. The event says "this outcome happened for a
 *    subject who has an agent plan in flight." It never claims the plan
 *    caused the outcome; causality is analysis over the joined data.
 *
 * 2. NO RUN, NO EVENT. If the subject has no agent run, nothing is recorded —
 *    an outcome cannot join a plan that never existed, and inventing a
 *    synthetic run to hold it would be fabrication. `recorded: false,
 *    reason: 'no_agent_run'` is the honest result, and it is the expected
 *    result for every subject outside the enrolled cohort today.
 *
 * 3. NEVER FAIL THE ROUTE. Same posture as the telemetry writer: a hiring
 *    action must succeed or fail on its own merits. Outcome recording
 *    degrades to `recorded: false` on any error.
 *
 * Subject resolution: clinician-session routes pass `subjectRef` (the Clerk
 * user id — the same person-key the A0 route writes). Employer-actor routes
 * only know the clinician's NPI, so resolution falls back to the most recent
 * AgentRun carrying that NPI. `metadata.resolvedBy` records which path was
 * used so analysis can weight the join accordingly.
 *
 * Known limitation, on purpose: workflow/review actions taken by an employer
 * session resolve against the EMPLOYER's user id, find no runs, and drop.
 * Clinician-side actions join. Resolving the application to its clinician
 * would require a backend read inside a proxy route — deferred until the
 * marketplace proxy exposes it, rather than guessed at.
 */
import { prisma } from '@/lib/db';
import { recordAgentEvent } from '../telemetry/agent-run-store';
import type { AgentRelatedKind } from '../telemetry/events';

export interface RecordHiringOutcomeInput {
  kind: AgentRelatedKind;
  /** Downstream identifier: application id, artifact id, opportunity id. */
  ref: string;
  /** Clinician-session routes: the Clerk user id. */
  subjectRef?: string;
  /** Employer-actor routes: the clinician's NPI. */
  npi?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordHiringOutcomeResult {
  recorded: boolean;
  reason?: 'no_subject_key' | 'no_agent_run' | 'write_failed' | 'error';
}

export async function recordHiringOutcome(
  input: RecordHiringOutcomeInput,
): Promise<RecordHiringOutcomeResult> {
  try {
    if (!input.ref) return { recorded: false, reason: 'no_subject_key' };

    let where: { subjectRef: string } | { npi: string };
    let resolvedBy: 'subject_ref' | 'npi';
    if (input.subjectRef) {
      where = { subjectRef: input.subjectRef };
      resolvedBy = 'subject_ref';
    } else if (input.npi) {
      where = { npi: input.npi };
      resolvedBy = 'npi';
    } else {
      return { recorded: false, reason: 'no_subject_key' };
    }

    const run = await prisma.agentRun.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, planId: true, subjectRef: true },
    });
    if (!run) return { recorded: false, reason: 'no_agent_run' };

    const { persisted } = await recordAgentEvent({
      eventType: 'agent_outcome_observed',
      planId: run.planId,
      runId: run.id,
      subjectRef: run.subjectRef,
      related: { kind: input.kind, ref: input.ref },
      metadata: { ...(input.metadata ?? {}), resolvedBy },
    });
    return persisted ? { recorded: true } : { recorded: false, reason: 'write_failed' };
  } catch {
    return { recorded: false, reason: 'error' };
  }
}

/**
 * Best-effort classification of a marketplace workflow/review action string
 * into an outcome kind. The raw action is ALWAYS carried in metadata, so a
 * conservative fallback to 'application' loses nothing — classification is a
 * convenience for aggregate reads, never the record of truth.
 */
export function classifyWorkflowKind(action: string): AgentRelatedKind {
  const normalized = action.toLowerCase();
  if (normalized.includes('interview')) return 'interview';
  if (normalized.includes('offer')) return 'offer';
  return 'application';
}

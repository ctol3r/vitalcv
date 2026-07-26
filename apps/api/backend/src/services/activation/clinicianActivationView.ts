/**
 * ACT-7.1 (read) — the PURE derivation of a clinician's "path to start" for one
 * application: the ACT-1.3 requirement ledger + the ACT-1.4 start-state, shaped
 * into an honest view. No DB, no auth, no side effects — so the honesty gate is
 * unit-testable directly. The authorized DB read lives in
 * `clinicianActivationService.ts`.
 *
 * Honesty gate: an application with no requirements yet is `not_started`, NEVER
 * start-ready. `deriveActivationReadiness([])` is vacuously `startReady: true`
 * (no required requirement is open) — surfacing that as "ready" would tell a
 * clinician they can start when the employer has not even instantiated the
 * ledger. The phase distinguishes the empty pre-acceptance case explicitly, and
 * `requirements_met` is a necessary condition awaiting the employer's recorded
 * decision — never a completed start.
 */

import {
  deriveActivationReadiness,
  isRequirementResolved,
  type ActivationRequirementCategory,
  type ActivationRequirementNecessity,
  type ActivationRequirementOwner,
  type ActivationRequirementStatus,
  type RequirementView,
} from './requirementLifecycle';
import type { StartState } from './startState';

/** The clinician's activation phase for one application. */
export type ClinicianActivationPhase =
  /** No requirements instantiated yet — appears after an employer accepts the packet. */
  | 'not_started'
  /** Requirements exist and at least one required item is still open. */
  | 'in_progress'
  /** Every required requirement is resolved — awaiting the employer's recorded start-ready decision. */
  | 'requirements_met';

/** One ledger row, honestly enriched — origin, ownership, freshness, resolver. */
export interface ClinicianRequirementView {
  readonly id: string;
  readonly label: string;
  readonly category: ActivationRequirementCategory;
  readonly necessity: ActivationRequirementNecessity;
  readonly status: ActivationRequirementStatus;
  readonly owner: ActivationRequirementOwner;
  /** In a resolved state (met/waived/not_applicable). */
  readonly isResolved: boolean;
  /** A required requirement that is not yet resolved — a real blocker to start. */
  readonly isBlocking: boolean;
  readonly dueAt: string | null;
  readonly resolvedAt: string | null;
}

export interface ClinicianActivationView {
  readonly applicationId: string;
  readonly phase: ClinicianActivationPhase;
  /** The recorded start lifecycle state (ACT-1.4), independent of readiness. */
  readonly startState: StartState;
  readonly requirements: readonly ClinicianRequirementView[];
  readonly summary: {
    readonly total: number;
    readonly requiredOpen: number;
    readonly hasHardBlocker: boolean;
    /** True only when requirements exist AND every required one is resolved. */
    readonly requiredMet: boolean;
  };
}

/** The subset of an ActivationRequirement row the view derivation reads. */
export interface ActivationRequirementRow {
  id: string;
  label: string;
  category: string;
  necessity: string;
  status: string;
  owner: string;
  dueAt: Date | null;
  resolvedAt: Date | null;
}

/**
 * Pure derivation of the clinician activation view from raw rows + start state.
 * Extracted (no DB, no auth) so the honesty gate is unit-testable directly:
 * an empty ledger must be `not_started`, never a vacuous `requirements_met`.
 */
export function deriveClinicianActivationView(
  applicationId: string,
  rows: readonly ActivationRequirementRow[],
  startState: StartState,
): ClinicianActivationView {
  const requirements: ClinicianRequirementView[] = rows.map((r) => {
    const necessity = r.necessity as ActivationRequirementNecessity;
    const status = r.status as ActivationRequirementStatus;
    const resolved = isRequirementResolved(status);
    return {
      id: r.id,
      label: r.label,
      category: r.category as ActivationRequirementCategory,
      necessity,
      status,
      owner: r.owner as ActivationRequirementOwner,
      isResolved: resolved,
      isBlocking: necessity === 'required' && !resolved,
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    };
  });

  const views: RequirementView[] = requirements.map((r) => ({
    id: r.id,
    necessity: r.necessity,
    status: r.status,
  }));
  const readiness = deriveActivationReadiness(views);

  // The honesty gate: an empty ledger is NOT start-ready, it is not-started.
  const phase: ClinicianActivationPhase =
    requirements.length === 0 ? 'not_started' : readiness.startReady ? 'requirements_met' : 'in_progress';

  return {
    applicationId,
    phase,
    startState,
    requirements,
    summary: {
      total: requirements.length,
      requiredOpen: readiness.blocking.length,
      hasHardBlocker: readiness.hasHardBlocker,
      // requiredMet is true only when there is at least one requirement.
      requiredMet: requirements.length > 0 && readiness.startReady,
    },
  };
}

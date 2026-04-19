/**
 * Pilot intake contract.
 *
 * A `PilotRequestRecord` is the canonical structured artifact produced
 * when a buyer submits the paid-pilot request form. It answers the
 * mission's five required dimensions — who, what, baseline, success,
 * next step — before any operator picks it up.
 *
 * Doctrine:
 *   - No ownerless pilot records. `owner` is assigned at creation time
 *     via a round-robin / default rule; a record without an owner is
 *     never persisted or returned.
 *   - No fake success criteria. The caller either supplies explicit
 *     criteria or the contract uses the canonical default that names
 *     comparable before/after deltas, not absolute targets.
 *   - Baseline metrics degrade honestly when partial. The baseline
 *     section carries per-metric null-safe values and an explicit
 *     "source" attribution per metric.
 *   - Next step must be explicit. Every status has a canonical next
 *     step string from `resolveNextStepForStatus`. A record with a
 *     blank next step is rejected at construction time.
 *
 * This module is a WRITER contract — it produces structured records
 * from request input. Reading / rendering those records for the
 * operator surface lives in a separate module (kept tight per the
 * mission's "do not build a full CRM" rule).
 */

import { createHash, randomUUID } from 'node:crypto';

export type PilotStatus =
  | 'requested'
  | 'qualified'
  | 'scoping'
  | 'baseline_captured'
  | 'ready_to_launch'
  | 'active'
  | 'completed'
  | 'archived';

/** Which operator role owns a pilot record at each status. Names
 *  roles, not individuals — routing to a specific person happens in
 *  the ops layer, not in the contract. */
export type PilotOwnerRole =
  | 'pilot_ops'
  | 'customer_success'
  | 'solutions_engineer'
  | 'founder';

export interface PilotBaselineMetric {
  /** Canonical metric key — mirrors proof-pack median names when the
   *  metric corresponds to a proof-pack measurement. */
  key:
    | 'current_time_to_start_days'
    | 'current_time_to_first_review_days'
    | 'applications_per_month'
    | 'reviews_per_month'
    | 'custom';
  /** Human-readable label rendered on the operator surface. */
  label: string;
  /**
   * Baseline value supplied by the buyer at request time. Null when
   * the buyer does not know their current baseline — never imputed.
   */
  value: number | null;
  /**
   * Attribution of the baseline value. "buyer_reported" when the
   * buyer filled it in; "unknown" when not supplied. Distinguishes
   * absent-by-choice from absent-by-omission.
   */
  source: 'buyer_reported' | 'unknown';
  /** Optional free-text note from the buyer (e.g. "45-90 days range, no variance data"). */
  note?: string;
}

export interface PilotSuccessCriterion {
  /** Short summary rendered as the criterion's headline. */
  summary: string;
  /**
   * Kind of criterion. `comparable_delta` is the doctrine-preferred
   * shape (buyer signs off on before/after); `absolute_target` and
   * `qualitative_signal` are allowed but test-flagged if they drift
   * into fabricated specificity ("reduce time-to-start by 40%" with
   * no baseline).
   */
  kind: 'comparable_delta' | 'absolute_target' | 'qualitative_signal';
  /**
   * Whether this criterion depends on a baseline metric being
   * captured first. If true, the pilot cannot transition out of
   * `scoping` until `baselineMetrics` includes a non-null value for
   * the dependency.
   */
  requiresBaseline: boolean;
}

export interface PilotRequestRecord {
  pilotId: string;
  orgId: string | null;
  orgName: string;
  contactName: string;
  contactEmail: string;
  /** What workflow the buyer wants the pilot to target — credentialing
   *  review, locum placement, privileging, etc. */
  roleOrWorkflowTarget: string;
  /** Where the request originated (/pilot page, /employers, share link, etc.). */
  sourceContext: string;
  requestedAt: string;
  /** Best-effort attribution of who submitted the request. Falls back
   *  to the contact email when the request is not authenticated. */
  requestedBy: string;
  baselineMetrics: PilotBaselineMetric[];
  successCriteria: PilotSuccessCriterion[];
  owner: PilotOwnerRole;
  status: PilotStatus;
  nextStep: string;
  /** Append-only audit log. Every status transition writes one entry. */
  auditLog: Array<{
    at: string;
    actor: 'buyer' | 'operator' | 'vitalcv';
    action: 'requested' | 'status_change' | 'owner_change' | 'baseline_updated';
    from?: PilotStatus;
    to?: PilotStatus;
    note?: string;
  }>;
  /**
   * Deterministic hash of the submission inputs. Used by operator
   * surfaces to detect duplicate requests from the same org + email
   * inside a short window.
   */
  submissionHash: string;
}

const ALLOWED_STATUS_TRANSITIONS: Record<PilotStatus, PilotStatus[]> = {
  requested: ['qualified', 'archived'],
  qualified: ['scoping', 'archived'],
  scoping: ['baseline_captured', 'archived'],
  baseline_captured: ['ready_to_launch', 'archived'],
  ready_to_launch: ['active', 'archived'],
  active: ['completed', 'archived'],
  completed: ['archived'],
  archived: [],
};

export function isPilotStatusTransitionAllowed(
  from: PilotStatus,
  to: PilotStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Canonical next-step copy per status. Every status has an explicit
 * next step — no record ever surfaces a blank nextStep.
 */
export function resolveNextStepForStatus(status: PilotStatus): string {
  switch (status) {
    case 'requested':
      return 'VitalCV operator reviews the request and qualifies scope. Buyer hears back within two business days.';
    case 'qualified':
      return 'Operator schedules a scoping call with the buyer to confirm NPIs, lanes, measurement window, and success criteria.';
    case 'scoping':
      return 'Operator captures current-state baseline metrics from the buyer before any measurement starts.';
    case 'baseline_captured':
      return 'Operator confirms the pilot scope document and kickoff date with the buyer.';
    case 'ready_to_launch':
      return 'Kickoff scheduled. Buyer provides final NPI list and operator access; pilot becomes active on the confirmed date.';
    case 'active':
      return 'Pilot is running. Operator monitors the proof-pack against baseline + success criteria and holds regular check-ins.';
    case 'completed':
      return 'Final proof-pack delivered to buyer. Operator captures before/after summary and retention decision.';
    case 'archived':
      return 'No further action. Record preserved for audit.';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Canonical owner-role assignment per status. A requested pilot
 * lands with pilot_ops; a qualified pilot moves to solutions_engineer
 * for scoping; an active pilot is customer_success; completed goes
 * back to pilot_ops for the post-mortem. Deterministic — no round-
 * robin randomness in the contract.
 */
export function resolveOwnerForStatus(status: PilotStatus): PilotOwnerRole {
  switch (status) {
    case 'requested':
    case 'qualified':
      return 'pilot_ops';
    case 'scoping':
    case 'baseline_captured':
      return 'solutions_engineer';
    case 'ready_to_launch':
    case 'active':
      return 'customer_success';
    case 'completed':
    case 'archived':
      return 'pilot_ops';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Default success-criteria set for a fresh pilot request. Uses
 * `comparable_delta` shape so the criteria are honest pre-baseline —
 * no absolute targets that imply data we don't yet have.
 */
export const DEFAULT_PILOT_SUCCESS_CRITERIA: readonly PilotSuccessCriterion[] = [
  {
    summary:
      'Measurable drop in time from application submission to first employer review action, measured against the buyer-supplied baseline.',
    kind: 'comparable_delta',
    requiresBaseline: true,
  },
  {
    summary:
      'Documented proof-pack export covering every application submitted during the measurement window.',
    kind: 'qualitative_signal',
    requiresBaseline: false,
  },
  {
    summary:
      'Honest limitation list naming every lane that remained partial during the pilot window. Buyer signs off that the limitations match their operational reality.',
    kind: 'qualitative_signal',
    requiresBaseline: false,
  },
];

/**
 * Default baseline-metric skeleton. Every key is rendered with
 * `value: null` and `source: 'unknown'` — the operator asks the
 * buyer to fill these in during the scoping call. The skeleton
 * itself never claims to know the baseline.
 */
export function buildDefaultBaselineSkeleton(): PilotBaselineMetric[] {
  return [
    {
      key: 'current_time_to_start_days',
      label: 'Current median days from hire to start',
      value: null,
      source: 'unknown',
    },
    {
      key: 'current_time_to_first_review_days',
      label: 'Current median days from application to first review',
      value: null,
      source: 'unknown',
    },
    {
      key: 'applications_per_month',
      label: 'Typical applications per month',
      value: null,
      source: 'unknown',
    },
    {
      key: 'reviews_per_month',
      label: 'Typical reviews per month',
      value: null,
      source: 'unknown',
    },
  ];
}

export interface PilotIntakeInput {
  orgName: string;
  contactName: string;
  contactEmail: string;
  orgId?: string | null;
  roleOrWorkflowTarget?: string;
  sourceContext?: string;
  requestedAt?: string;
  baselineMetrics?: PilotBaselineMetric[];
  successCriteria?: PilotSuccessCriterion[];
  /** Override the default pilot_ops owner — e.g. when a known AE is
   *  pre-assigned. Uncommon; most records route through the default. */
  owner?: PilotOwnerRole;
}

export interface PilotIntakeInputError {
  field: 'orgName' | 'contactName' | 'contactEmail';
  reason: string;
}

export function validatePilotIntakeInput(
  input: PilotIntakeInput,
): PilotIntakeInputError[] {
  const errors: PilotIntakeInputError[] = [];
  if (!input.orgName || input.orgName.trim().length === 0) {
    errors.push({ field: 'orgName', reason: 'Organization name is required.' });
  }
  if (!input.contactName || input.contactName.trim().length === 0) {
    errors.push({ field: 'contactName', reason: 'Contact name is required.' });
  }
  const email = (input.contactEmail ?? '').trim();
  if (email.length === 0) {
    errors.push({ field: 'contactEmail', reason: 'Contact email is required.' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({
      field: 'contactEmail',
      reason: 'Contact email must be a valid address.',
    });
  }
  return errors;
}

/**
 * Deterministic submission hash over the identifying inputs.
 * Two requests with the same org + email + workflow + source +
 * requestedAt-second produce the same hash — enables de-dupe of
 * rapid-repeat submissions without needing a cross-request store.
 */
export function computePilotSubmissionHash(input: {
  orgName: string;
  contactEmail: string;
  roleOrWorkflowTarget: string;
  sourceContext: string;
  requestedAt: string;
}): string {
  const payload = JSON.stringify({
    orgName: input.orgName.trim().toLowerCase(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    roleOrWorkflowTarget: input.roleOrWorkflowTarget.trim().toLowerCase(),
    sourceContext: input.sourceContext.trim().toLowerCase(),
    requestedAtSecond: input.requestedAt.slice(0, 19),
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function createPilotRequestRecord(
  input: PilotIntakeInput,
): PilotRequestRecord {
  const errors = validatePilotIntakeInput(input);
  if (errors.length > 0) {
    throw new Error(
      `Invalid pilot intake input: ${errors.map((e) => `${e.field}: ${e.reason}`).join('; ')}`,
    );
  }

  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const roleOrWorkflowTarget =
    input.roleOrWorkflowTarget?.trim().length
      ? input.roleOrWorkflowTarget.trim()
      : 'Credentialing review';
  const sourceContext = input.sourceContext ?? '/pilot';
  const owner = input.owner ?? resolveOwnerForStatus('requested');
  const status: PilotStatus = 'requested';
  const nextStep = resolveNextStepForStatus(status);

  const submissionHash = computePilotSubmissionHash({
    orgName: input.orgName,
    contactEmail: input.contactEmail,
    roleOrWorkflowTarget,
    sourceContext,
    requestedAt,
  });

  const record: PilotRequestRecord = {
    pilotId: `pilot_${randomUUID()}`,
    orgId: input.orgId ?? null,
    orgName: input.orgName.trim(),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim(),
    roleOrWorkflowTarget,
    sourceContext,
    requestedAt,
    requestedBy: input.contactEmail.trim(),
    baselineMetrics:
      input.baselineMetrics && input.baselineMetrics.length > 0
        ? input.baselineMetrics
        : buildDefaultBaselineSkeleton(),
    successCriteria:
      input.successCriteria && input.successCriteria.length > 0
        ? input.successCriteria
        : [...DEFAULT_PILOT_SUCCESS_CRITERIA],
    owner,
    status,
    nextStep,
    submissionHash,
    auditLog: [
      {
        at: requestedAt,
        actor: 'buyer',
        action: 'requested',
        to: status,
      },
    ],
  };

  // Final invariant check — a record without an owner or a blank
  // next step cannot leave this function.
  if (!record.owner) {
    throw new Error('Ownerless pilot record — refusing to return.');
  }
  if (!record.nextStep || record.nextStep.trim().length === 0) {
    throw new Error('Pilot record has no next step — refusing to return.');
  }
  return record;
}

/**
 * Transition a pilot record to a new status. Enforces the allowed-
 * transitions map, reassigns the canonical owner for the new status,
 * refreshes the next-step copy, and appends an audit entry.
 */
export function transitionPilotStatus(
  record: PilotRequestRecord,
  to: PilotStatus,
  input: {
    actor: 'operator' | 'vitalcv';
    at?: string;
    note?: string;
  },
): PilotRequestRecord {
  if (!isPilotStatusTransitionAllowed(record.status, to)) {
    throw new Error(
      `Disallowed pilot status transition: ${record.status} -> ${to} for ${record.pilotId}`,
    );
  }
  const at = input.at ?? new Date().toISOString();
  const owner = resolveOwnerForStatus(to);
  const nextStep = resolveNextStepForStatus(to);
  return {
    ...record,
    status: to,
    owner,
    nextStep,
    auditLog: [
      ...record.auditLog,
      {
        at,
        actor: input.actor,
        action: 'status_change',
        from: record.status,
        to,
        note: input.note,
      },
    ],
  };
}

/**
 * Update a pilot's baseline metrics once the scoping call captures
 * real numbers. Only allowed during `scoping` — a pilot cannot have
 * its baseline altered after `baseline_captured` without archiving
 * and starting a new record.
 */
export function updatePilotBaseline(
  record: PilotRequestRecord,
  metrics: PilotBaselineMetric[],
  input: { actor: 'operator' | 'vitalcv'; at?: string; note?: string },
): PilotRequestRecord {
  if (record.status !== 'scoping') {
    throw new Error(
      `Baseline can only be updated while status is "scoping" (current: ${record.status}).`,
    );
  }
  const at = input.at ?? new Date().toISOString();
  return {
    ...record,
    baselineMetrics: metrics,
    auditLog: [
      ...record.auditLog,
      {
        at,
        actor: input.actor,
        action: 'baseline_updated',
        note: input.note,
      },
    ],
  };
}

/**
 * Honest partial check — true when any baseline metric is still
 * null / unknown. Consumers use this to gate transitions out of
 * `scoping` and to surface partial-baseline warnings.
 */
export function isPilotBaselinePartial(record: PilotRequestRecord): boolean {
  return record.baselineMetrics.some(
    (m) => m.value === null || m.source === 'unknown',
  );
}

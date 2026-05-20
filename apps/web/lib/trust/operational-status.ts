/**
 * Canonical operational-status taxonomy for VitalCV claims.
 *
 * Every operational capability the product surfaces to users
 * (verification, integration, deletion, signing, audit, SLA) must be
 * categorised under exactly one of six closed statuses. The status
 * drives UI rendering, copy choice, and the truth-contract guardrails
 * that prevent semantic inflation.
 *
 * This taxonomy is the canonical reference for governance. New
 * statuses are not added without a corresponding doctrine update in
 * `docs/ops/operational-capability-boundaries.md`.
 */

export const OPERATIONAL_STATUSES = [
  'implemented',
  'operator_assisted',
  'institution_owned',
  'pilot_target',
  'planned',
  'unsupported',
] as const;

export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export interface OperationalStatusDescriptor {
  readonly status: OperationalStatus;
  /** Operational meaning — what this status asserts to a reader. */
  readonly meaning: string;
  /** UI rendering rule (visual semantics). */
  readonly uiSemantics: string;
  /** Copy guidance — what language is and isn't acceptable. */
  readonly truthContractGuidance: string;
  /** Escalation rule when a surface claims this without evidence. */
  readonly escalation: string;
}

export const OPERATIONAL_STATUS_DESCRIPTORS: Record<
  OperationalStatus,
  OperationalStatusDescriptor
> = {
  implemented: {
    status: 'implemented',
    meaning:
      'Capability is wired end-to-end in shipping code. Evidence references a code path or a public endpoint that exercises the capability.',
    uiSemantics:
      'Solid border · canonical institutional language · no qualifier prefix.',
    truthContractGuidance:
      'May render in the present tense. Source citation optional but recommended. Banned phrases (CLAUDE.md) still apply.',
    escalation:
      'If marked implemented without an evidence reference, demote to pilot_target until a reference is supplied.',
  },
  operator_assisted: {
    status: 'operator_assisted',
    meaning:
      'Capability requires a VitalCV operator step to complete. Not autonomous; not "automated".',
    uiSemantics:
      'Solid border · "operator-assisted" prefix · operator lane chrome when rendered as a workflow step.',
    truthContractGuidance:
      'Never describe as "automatic", "instant", or "seamless". The operator role must be named in the same sentence.',
    escalation:
      'If rendered as automated, replace copy with "operator-assisted" and add the operator-lane affordance.',
  },
  institution_owned: {
    status: 'institution_owned',
    meaning:
      'Capability is owned by the customer institution (CVO, MSO, HR, legal). VitalCV does not perform the work; it integrates with or hands off to the institution.',
    uiSemantics:
      'Dashed border · "institution-owned" prefix · explicit hand-off affordance when rendered as a workflow step.',
    truthContractGuidance:
      'Never describe as VitalCV-performed. The institution role must be named explicitly. Common pattern: "institution-owned workflow".',
    escalation:
      'If rendered as VitalCV-performed, rewrite with explicit institution naming.',
  },
  pilot_target: {
    status: 'pilot_target',
    meaning:
      'Capability is a target of the current pilot engagement. Not yet implemented end-to-end; planned to be exercised during the pilot window.',
    uiSemantics:
      'Dashed border · "pilot-target" prefix · explicit horizon language.',
    truthContractGuidance:
      'Never describe in the present tense as if already in place. Use future-tense or "target" language.',
    escalation:
      'If rendered as implemented, replace with "pilot target" copy. If the pilot has concluded successfully, propose promotion to implemented with an evidence reference.',
  },
  planned: {
    status: 'planned',
    meaning:
      'Capability is on the documented roadmap but is not yet a pilot target and not yet implemented.',
    uiSemantics:
      'Dashed border · "planned" prefix · roadmap-horizon disclosure.',
    truthContractGuidance:
      'Never describe as available today. Always pair with a documented planning horizon (e.g. "planned Q3-2026") or omit from user-facing surfaces.',
    escalation:
      'If rendered as available, replace with "planned" copy or remove from user-facing surface.',
  },
  unsupported: {
    status: 'unsupported',
    meaning:
      'Capability is explicitly NOT in scope. Listing it here documents the negative space so a reader knows what VitalCV does not do.',
    uiSemantics:
      'Quiet zinc-500 footnote tone · "out of scope" affordance when rendered as a workflow step.',
    truthContractGuidance:
      'Never imply availability under any qualifier. The status exists so surfaces can NAME the absence rather than imply presence.',
    escalation:
      'If rendered as available (even with a qualifier like "coming soon"), remove from user-facing copy and surface as "out of scope" in operator-facing surfaces only.',
  },
};

export function describeOperationalStatus(
  status: OperationalStatus,
): OperationalStatusDescriptor {
  return OPERATIONAL_STATUS_DESCRIPTORS[status];
}

export function listOperationalStatuses(): readonly OperationalStatus[] {
  return OPERATIONAL_STATUSES;
}

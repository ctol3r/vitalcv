type ActivationRequirementUnit =
  | 'acceptance_recorded'
  | 'audit_logged'
  | 'organization_bound'
  | 'accepted_timestamped'
  | 'trust_snapshot_captured'
  | 'start_ready'
  | 'readiness_score_at_least'
  | 'acceptance_scope_is';

type ActivationRequirementPriority = 'required' | 'preferred';

export interface ActivationAcceptanceOutputInput {
  timestamp?: string | null;
  auditEventId?: string | null;
  attribution?: {
    organizationId?: string | null;
  } | null;
  persistence?: {
    acceptanceId?: string | null;
  } | null;
  acceptance?: {
    acceptedByOrgId?: string | null;
    acceptedAt?: string | null;
    acceptanceScope?: string | null;
  } | null;
  trustSnapshot?: {
    readinessScore?: number | null;
    blockerCount?: number | null;
    topBlockers?: readonly string[] | null;
  } | null;
}

export interface ActivationRequirement {
  unit: ActivationRequirementUnit;
  label?: string;
  priority?: ActivationRequirementPriority;
  estimatedDays?: number | null;
  minimumScore?: number | null;
  expectedScope?: 'pilot' | 'full' | 'partial' | null;
}

export interface ActivationSatisfiedUnit {
  unit: ActivationRequirementUnit;
  label: string;
  detail: string;
}

export interface ActivationBlocker {
  unit: ActivationRequirementUnit;
  label: string;
  detail: string;
  estimatedDays: number | null;
}

export interface ActivationMatchingOutput {
  satisfiedUnits: ActivationSatisfiedUnit[];
  blockers: ActivationBlocker[];
  estimated_days_to_start: number | null;
}

type EvaluationResult = {
  satisfied: boolean;
  unit: ActivationRequirementUnit;
  label: string;
  detail: string;
  blocking: boolean;
  estimatedDays: number | null;
};

function asNonEmptyString(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parsePositiveNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function normalizePriority(value: ActivationRequirementPriority | null | undefined): ActivationRequirementPriority {
  return value === 'preferred' ? 'preferred' : 'required';
}

function defaultLabelFor(unit: ActivationRequirementUnit): string {
  switch (unit) {
    case 'acceptance_recorded':
      return 'Acceptance recorded';
    case 'audit_logged':
      return 'Audit logged';
    case 'organization_bound':
      return 'Organization bound';
    case 'accepted_timestamped':
      return 'Acceptance timestamped';
    case 'trust_snapshot_captured':
      return 'Trust snapshot captured';
    case 'start_ready':
      return 'Start ready';
    case 'readiness_score_at_least':
      return 'Readiness threshold met';
    case 'acceptance_scope_is':
      return 'Acceptance scope matched';
    default:
      return unit;
  }
}

function hasStartReady(input: ActivationAcceptanceOutputInput, minimumScore: number): boolean {
  const score = input.trustSnapshot?.readinessScore;
  const blockerCount = input.trustSnapshot?.blockerCount;
  return typeof score === 'number'
    && score >= minimumScore
    && typeof blockerCount === 'number'
    && blockerCount === 0;
}

function buildStartReadyDetail(input: ActivationAcceptanceOutputInput, minimumScore: number): string {
  const score = input.trustSnapshot?.readinessScore;
  const blockerCount = input.trustSnapshot?.blockerCount;
  const blockers = input.trustSnapshot?.topBlockers ?? [];

  if (typeof score !== 'number') {
    return 'Trust snapshot does not include a readiness score.';
  }
  if (score < minimumScore) {
    return `Readiness score ${score} is below the required threshold ${minimumScore}.`;
  }
  if (typeof blockerCount !== 'number') {
    return 'Trust snapshot does not include a blocker count.';
  }
  if (blockerCount > 0) {
    const leadBlocker = typeof blockers[0] === 'string' ? blockers[0] : null;
    return leadBlocker
      ? `Trust snapshot still has blockers (${blockerCount}). Lead blocker: ${leadBlocker}`
      : `Trust snapshot still has blockers (${blockerCount}).`;
  }
  return `Trust snapshot is start-ready at score ${score}.`;
}

function evaluateRequirement(
  acceptanceOutput: ActivationAcceptanceOutputInput,
  requirement: ActivationRequirement,
): EvaluationResult {
  const label = asNonEmptyString(requirement.label) ?? defaultLabelFor(requirement.unit);
  const blocking = normalizePriority(requirement.priority) !== 'preferred';
  const estimatedDays = parsePositiveNumber(requirement.estimatedDays);

  switch (requirement.unit) {
    case 'acceptance_recorded': {
      const acceptanceId = asNonEmptyString(acceptanceOutput.persistence?.acceptanceId);
      return {
        satisfied: Boolean(acceptanceId),
        unit: requirement.unit,
        label,
        detail: acceptanceId
          ? `Acceptance record exists (${acceptanceId}).`
          : 'Acceptance output does not include a persisted acceptance ID.',
        blocking,
        estimatedDays,
      };
    }
    case 'audit_logged': {
      const auditEventId = asNonEmptyString(acceptanceOutput.auditEventId);
      return {
        satisfied: Boolean(auditEventId),
        unit: requirement.unit,
        label,
        detail: auditEventId
          ? `Audit event exists (${auditEventId}).`
          : 'Acceptance output does not include an audit event ID.',
        blocking,
        estimatedDays,
      };
    }
    case 'organization_bound': {
      const organizationId = asNonEmptyString(
        acceptanceOutput.acceptance?.acceptedByOrgId ?? acceptanceOutput.attribution?.organizationId,
      );
      return {
        satisfied: Boolean(organizationId),
        unit: requirement.unit,
        label,
        detail: organizationId
          ? `Acceptance is bound to organization ${organizationId}.`
          : 'Acceptance output is not bound to an organization.',
        blocking,
        estimatedDays,
      };
    }
    case 'accepted_timestamped': {
      const acceptedAt = asNonEmptyString(
        acceptanceOutput.acceptance?.acceptedAt ?? acceptanceOutput.timestamp,
      );
      return {
        satisfied: Boolean(acceptedAt),
        unit: requirement.unit,
        label,
        detail: acceptedAt
          ? `Acceptance timestamp exists (${acceptedAt}).`
          : 'Acceptance output does not include an accepted timestamp.',
        blocking,
        estimatedDays,
      };
    }
    case 'trust_snapshot_captured': {
      const trustSnapshot = acceptanceOutput.trustSnapshot ?? null;
      return {
        satisfied: trustSnapshot !== null,
        unit: requirement.unit,
        label,
        detail: trustSnapshot
          ? 'Trust snapshot is attached to acceptance output.'
          : 'Acceptance output does not include a trust snapshot.',
        blocking,
        estimatedDays,
      };
    }
    case 'readiness_score_at_least': {
      const score = acceptanceOutput.trustSnapshot?.readinessScore;
      const minimumScore = parsePositiveNumber(requirement.minimumScore) ?? 80;
      return {
        satisfied: typeof score === 'number' && score >= minimumScore,
        unit: requirement.unit,
        label,
        detail: typeof score === 'number'
          ? `Readiness score ${score}${score >= minimumScore ? ' meets' : ' is below'} threshold ${minimumScore}.`
          : 'Trust snapshot does not include a readiness score.',
        blocking,
        estimatedDays,
      };
    }
    case 'acceptance_scope_is': {
      const expectedScope = asNonEmptyString(requirement.expectedScope ?? null);
      const actualScope = asNonEmptyString(acceptanceOutput.acceptance?.acceptanceScope);
      return {
        satisfied: Boolean(expectedScope && actualScope === expectedScope),
        unit: requirement.unit,
        label,
        detail: expectedScope
          ? actualScope
            ? `Acceptance scope is ${actualScope}; expected ${expectedScope}.`
            : `Acceptance output does not include scope; expected ${expectedScope}.`
          : 'Activation requirement does not define an expected scope.',
        blocking,
        estimatedDays,
      };
    }
    case 'start_ready':
    default: {
      const minimumScore = parsePositiveNumber(requirement.minimumScore) ?? 80;
      return {
        satisfied: hasStartReady(acceptanceOutput, minimumScore),
        unit: 'start_ready',
        label,
        detail: buildStartReadyDetail(acceptanceOutput, minimumScore),
        blocking,
        estimatedDays,
      };
    }
  }
}

function calculateEstimatedDaysToStart(blockers: readonly ActivationBlocker[]): number | null {
  if (blockers.length === 0) {
    return 0;
  }

  if (blockers.some((blocker) => blocker.estimatedDays === null)) {
    return null;
  }

  return blockers.reduce((sum, blocker) => sum + (blocker.estimatedDays ?? 0), 0);
}

export function matchActivationRequirements(input: {
  acceptanceOutput: ActivationAcceptanceOutputInput;
  activationRequirements: readonly ActivationRequirement[];
}): ActivationMatchingOutput {
  const evaluated = input.activationRequirements.map((requirement) => (
    evaluateRequirement(input.acceptanceOutput, requirement)
  ));

  const satisfiedUnits = evaluated
    .filter((result) => result.satisfied)
    .map<ActivationSatisfiedUnit>((result) => ({
      unit: result.unit,
      label: result.label,
      detail: result.detail,
    }));

  const blockers = evaluated
    .filter((result) => !result.satisfied && result.blocking)
    .map<ActivationBlocker>((result) => ({
      unit: result.unit,
      label: result.label,
      detail: result.detail,
      estimatedDays: result.estimatedDays,
    }));

  return {
    satisfiedUnits,
    blockers,
    estimated_days_to_start: calculateEstimatedDaysToStart(blockers),
  };
}

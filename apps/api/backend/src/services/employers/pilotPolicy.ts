import type { EmployerRequirementSpec } from './employerCatalog';
import type { ClinicianTrustState } from '../trust/trustStateEngine';

export interface OrganizationAcceptanceRules {
  acceptL3CredentialsAutomatically: boolean;
  requirePsvOnlyForGaps: boolean;
}

export interface TrustAcceptanceContracts {
  triggerDecisionCapsuleOnHire: boolean;
}

export interface PilotPolicyConfig {
  pilotMode: boolean;
  organizationAcceptanceRules: OrganizationAcceptanceRules;
  trustAcceptanceContracts: TrustAcceptanceContracts;
}

export interface OrganizationRequirementsEnvelope extends PilotPolicyConfig {
  requirements: EmployerRequirementSpec[];
}

export interface PilotReadinessEvaluation {
  ready: boolean;
  autoAccept: boolean;
  psvRequired: boolean;
  triggerDecisionCapsuleOnHire: boolean;
  trustBand: string;
  readinessScore: number;
  reason: string;
}

const DEFAULT_ORGANIZATION_ACCEPTANCE_RULES: OrganizationAcceptanceRules = {
  acceptL3CredentialsAutomatically: false,
  requirePsvOnlyForGaps: false,
};

const DEFAULT_TRUST_ACCEPTANCE_CONTRACTS: TrustAcceptanceContracts = {
  triggerDecisionCapsuleOnHire: false,
};

export const DEFAULT_PILOT_POLICY: PilotPolicyConfig = {
  pilotMode: false,
  organizationAcceptanceRules: DEFAULT_ORGANIZATION_ACCEPTANCE_RULES,
  trustAcceptanceContracts: DEFAULT_TRUST_ACCEPTANCE_CONTRACTS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseRequirementLevel(value: unknown): EmployerRequirementSpec['level'] {
  return value === 'L3' || value === 'L2' || value === 'L1' ? value : 'L1';
}

function normalizeRequirementArray(value: unknown): EmployerRequirementSpec[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: EmployerRequirementSpec[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const label = typeof item.label === 'string' ? item.label.trim() : '';
    if (!label) {
      continue;
    }

    const level = parseRequirementLevel(item.level);
    const note = typeof item.note === 'string' && item.note.trim().length > 0
      ? item.note.trim()
      : undefined;

    parsed.push(note ? { label, level, note } : { label, level });
  }

  return parsed;
}

function parseOrganizationAcceptanceRules(value: unknown): OrganizationAcceptanceRules {
  if (!isRecord(value)) {
    return { ...DEFAULT_ORGANIZATION_ACCEPTANCE_RULES };
  }

  return {
    acceptL3CredentialsAutomatically: value.acceptL3CredentialsAutomatically === true,
    requirePsvOnlyForGaps: value.requirePsvOnlyForGaps === true,
  };
}

function parseTrustAcceptanceContracts(value: unknown): TrustAcceptanceContracts {
  if (!isRecord(value)) {
    return { ...DEFAULT_TRUST_ACCEPTANCE_CONTRACTS };
  }

  return {
    triggerDecisionCapsuleOnHire: value.triggerDecisionCapsuleOnHire === true,
  };
}

export function parseOrganizationRequirementsEnvelope(
  value: unknown,
  fallbackRequirements: EmployerRequirementSpec[] = [],
): OrganizationRequirementsEnvelope {
  if (Array.isArray(value)) {
    return {
      requirements: normalizeRequirementArray(value).length > 0
        ? normalizeRequirementArray(value)
        : fallbackRequirements,
      pilotMode: DEFAULT_PILOT_POLICY.pilotMode,
      organizationAcceptanceRules: { ...DEFAULT_ORGANIZATION_ACCEPTANCE_RULES },
      trustAcceptanceContracts: { ...DEFAULT_TRUST_ACCEPTANCE_CONTRACTS },
    };
  }

  if (!isRecord(value)) {
    return {
      requirements: fallbackRequirements,
      pilotMode: DEFAULT_PILOT_POLICY.pilotMode,
      organizationAcceptanceRules: { ...DEFAULT_ORGANIZATION_ACCEPTANCE_RULES },
      trustAcceptanceContracts: { ...DEFAULT_TRUST_ACCEPTANCE_CONTRACTS },
    };
  }

  const envelopeRequirements = normalizeRequirementArray(value.requirements);

  return {
    requirements: envelopeRequirements.length > 0 ? envelopeRequirements : fallbackRequirements,
    pilotMode: value.pilotMode === true,
    organizationAcceptanceRules: parseOrganizationAcceptanceRules(value.organizationAcceptanceRules),
    trustAcceptanceContracts: parseTrustAcceptanceContracts(value.trustAcceptanceContracts),
  };
}

export function buildOrganizationRequirementsEnvelope(
  input: OrganizationRequirementsEnvelope,
): OrganizationRequirementsEnvelope {
  return {
    requirements: input.requirements,
    pilotMode: input.pilotMode,
    organizationAcceptanceRules: {
      acceptL3CredentialsAutomatically:
        input.organizationAcceptanceRules.acceptL3CredentialsAutomatically,
      requirePsvOnlyForGaps: input.organizationAcceptanceRules.requirePsvOnlyForGaps,
    },
    trustAcceptanceContracts: {
      triggerDecisionCapsuleOnHire:
        input.trustAcceptanceContracts.triggerDecisionCapsuleOnHire,
    },
  };
}

export function evaluatePilotReadiness(
  trustState: Pick<ClinicianTrustState, 'readiness_level' | 'readiness_score' | 'gap_summary'>,
  policy: PilotPolicyConfig,
): PilotReadinessEvaluation {
  const pilotEnabled = policy.pilotMode;
  const isL3 = trustState.readiness_level === 'L3';
  const gapCount = Array.isArray(trustState.gap_summary) ? trustState.gap_summary.length : 0;
  const psvRequired = pilotEnabled
    && policy.organizationAcceptanceRules.requirePsvOnlyForGaps
    && gapCount > 0;
  const autoAccept = pilotEnabled
    && policy.organizationAcceptanceRules.acceptL3CredentialsAutomatically
    && isL3;
  const ready = autoAccept || (pilotEnabled && policy.organizationAcceptanceRules.requirePsvOnlyForGaps && gapCount === 0);

  let reason = 'Pilot readiness disabled for this organization.';
  if (pilotEnabled && autoAccept) {
    reason = 'L3 credentials qualify for automatic acceptance under pilot policy.';
  } else if (pilotEnabled && psvRequired) {
    reason = 'Trust gaps require PSV only for the missing evidence.';
  } else if (pilotEnabled && ready) {
    reason = 'Trust evidence satisfies the pilot acceptance policy without additional PSV.';
  } else if (pilotEnabled) {
    reason = 'Manual review required under the current pilot acceptance policy.';
  }

  return {
    ready,
    autoAccept,
    psvRequired,
    triggerDecisionCapsuleOnHire:
      pilotEnabled && policy.trustAcceptanceContracts.triggerDecisionCapsuleOnHire,
    trustBand: trustState.readiness_level,
    readinessScore: trustState.readiness_score,
    reason,
  };
}

import type { EmployerRequirementSpec } from '../employers/employerCatalog';
import {
  createUnmappedRequirementKey,
  isUnmappedRequirementKey,
  mapRequirementLabelToCanonicalKey,
  normalizeTrustText,
} from './policyMatrix';
import type {
  FreshnessState,
  RequirementWeight,
  TrustReadinessLevel,
} from './types';

type RequirementPriority = 'required' | 'preferred';
type ActionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type RequirementMatchCode =
  | 'MATCHED'
  | 'UNMAPPED_REQUIREMENT'
  | 'NO_MATCHING_RECOGNITION_FACT'
  | 'CONSTRAINT_MISMATCH'
  | 'SELF_ASSERTED_ONLY'
  | 'INSUFFICIENT_RESOLUTION'
  | 'STALE_RESOLUTION'
  | 'EXPIRED_RESOLUTION'
  | 'REVOKED_RESOLUTION';

export interface RecognitionResolvedFactInput {
  canonicalArtifactKey?: string | null;
  key?: string | null;
  requirementLabel?: string | null;
  label?: string | null;
  status?: string | null;
  resolvedLevel?: TrustReadinessLevel | null;
  freshness?: FreshnessState | null;
  revoked?: boolean | null;
  evidenceId?: string | null;
  source?: string | null;
  reason?: string | null;
  state?: string | null;
  specialty?: string | null;
}

export interface RecognitionResolvedInput {
  resolved: readonly RecognitionResolvedFactInput[];
}

export interface RequirementMatchResult {
  canonicalArtifactKey: string;
  requirementLabel: string;
  requirementWeight: RequirementWeight;
  priority: RequirementPriority;
  mapped: boolean;
  met: boolean;
  matchCode: RequirementMatchCode;
  resolvedLevel: TrustReadinessLevel;
  freshness: FreshnessState;
  revoked: boolean;
  matchedEvidenceIds: string[];
  state: string | null;
  specialty: string | null;
  reasons: string[];
}

export interface RequirementBlocker {
  canonicalArtifactKey: string;
  requirementLabel: string;
  matchCode: Exclude<RequirementMatchCode, 'MATCHED'>;
  detail: string;
}

export interface RequirementMissingAction {
  id: string;
  canonicalArtifactKey: string;
  requirementLabel: string;
  blocking: boolean;
  priority: ActionPriority;
  title: string;
  detail: string;
}

export interface RequirementMatchingOutput {
  requirementResults: RequirementMatchResult[];
  blockers: RequirementBlocker[];
  missingActions: RequirementMissingAction[];
}

type NormalizedRequirement = {
  canonicalArtifactKey: string;
  requirementLabel: string;
  requirementWeight: RequirementWeight;
  priority: RequirementPriority;
  mapped: boolean;
  state: string | null;
  specialty: string | null;
};

type NormalizedResolvedFact = {
  canonicalArtifactKey: string | null;
  resolvedLevel: TrustReadinessLevel;
  freshness: FreshnessState;
  revoked: boolean;
  evidenceId: string | null;
  reason: string | null;
  status: string | null;
  source: string | null;
  state: string | null;
  specialty: string | null;
  label: string | null;
};

const REQUIREMENT_KEY_ALIASES: Readonly<Record<string, string>> = {
  npi: 'npi_verification',
  state_license: 'state_license',
  board_cert: 'board_certification',
  sanctions_clear: 'sanctions_clear',
  dea: 'dea_registration',
  malpractice: 'malpractice_insurance',
  hospital_privileges: 'privileging_file',
  acls: 'bls_acls',
  bls: 'bls_acls',
  telehealth: 'telehealth_agreement',
  background_check: 'background_check',
  npdb_clear: 'npdb_clear',
};

const POSITIVE_STATUSES = new Set([
  'ACTIVE',
  'APPROVED',
  'CLEAR',
  'COMPLETE',
  'COMPLIANT',
  'CURRENT',
  'NO_MATCH',
  'PASS',
  'VALID',
  'VERIFIED',
]);

const INSUFFICIENT_STATUSES = new Set([
  'IN_PROGRESS',
  'NEEDS_REVIEW',
  'PENDING',
  'REVIEW',
  'SUBMITTED',
  'UNKNOWN',
]);

const NEGATIVE_STATUSES = new Set([
  'BLOCKED',
  'DENIED',
  'EXCLUDED',
  'FAILED',
  'FLAGGED',
  'HIT',
  'INVALID',
  'MATCH',
  'MISSING',
  'NOT_CLEAR',
  'NOT_FOUND',
  'REVOKED',
  'SANCTIONED',
  'SUSPENDED',
]);

function uniqSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function uniqStable(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (value.length === 0 || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function normalizePriority(priority: EmployerRequirementSpec['priority']): RequirementPriority {
  return priority === 'preferred' ? 'preferred' : 'required';
}

function normalizeWeight(level: EmployerRequirementSpec['level']): RequirementWeight {
  if (level === 'L3') {
    return 3;
  }
  if (level === 'L2') {
    return 2;
  }
  return 1;
}

function normalizeConstraintValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeTrustText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequirementKeyValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized.length > 0 ? normalized : null;
}

function normalizeFreshness(value: FreshnessState | string | null | undefined): FreshnessState {
  if (value === 'current' || value === 'stale' || value === 'expired' || value === 'not_applicable') {
    return value;
  }
  return 'not_applicable';
}

function normalizeLevel(value: TrustReadinessLevel | null | undefined): TrustReadinessLevel | null {
  return value === 'L0' || value === 'L1' || value === 'L2' || value === 'L3'
    ? value
    : null;
}

function normalizeStatus(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return normalizeTrustText(value).replace(/\s+/g, '_').toUpperCase();
}

function inferCanonicalArtifactKey(input: {
  canonicalArtifactKey?: string | null;
  key?: string | null;
  label?: string | null;
}): string | null {
  const explicitCanonical = normalizeRequirementKeyValue(input.canonicalArtifactKey);
  if (explicitCanonical) {
    return REQUIREMENT_KEY_ALIASES[explicitCanonical] ?? explicitCanonical;
  }

  const explicitKey = normalizeRequirementKeyValue(input.key);
  if (explicitKey && REQUIREMENT_KEY_ALIASES[explicitKey]) {
    return REQUIREMENT_KEY_ALIASES[explicitKey];
  }

  const label = input.label?.trim();
  if (!label) {
    return null;
  }

  return mapRequirementLabelToCanonicalKey(label);
}

function inferResolvedLevel(input: {
  resolvedLevel?: TrustReadinessLevel | null;
  status?: string | null;
  revoked?: boolean | null;
  freshness?: FreshnessState | null;
}): TrustReadinessLevel {
  const explicitLevel = normalizeLevel(input.resolvedLevel);
  if (explicitLevel) {
    return explicitLevel;
  }

  if (input.revoked === true) {
    return 'L0';
  }

  const freshness = normalizeFreshness(input.freshness);
  const status = normalizeStatus(input.status);
  if (!status) {
    return 'L0';
  }

  if (NEGATIVE_STATUSES.has(status)) {
    return 'L0';
  }

  if (POSITIVE_STATUSES.has(status)) {
    return freshness === 'stale' || freshness === 'expired' ? 'L2' : 'L3';
  }

  if (INSUFFICIENT_STATUSES.has(status)) {
    return 'L2';
  }

  return 'L0';
}

function levelPriority(level: TrustReadinessLevel): number {
  if (level === 'L3') {
    return 3;
  }
  if (level === 'L2') {
    return 2;
  }
  if (level === 'L1') {
    return 1;
  }
  return 0;
}

function freshnessPriority(freshness: FreshnessState): number {
  if (freshness === 'current') {
    return 3;
  }
  if (freshness === 'not_applicable') {
    return 2;
  }
  if (freshness === 'stale') {
    return 1;
  }
  return 0;
}

function actionPriorityFor(weight: RequirementWeight): ActionPriority {
  if (weight === 3) {
    return 'HIGH';
  }
  if (weight === 2) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function buildRequirements(orgRequirements: readonly EmployerRequirementSpec[]): NormalizedRequirement[] {
  return orgRequirements.map((requirement) => {
    const mappedKey = inferCanonicalArtifactKey({
      key: requirement.key,
      label: requirement.label,
    });

    return {
      canonicalArtifactKey: mappedKey ?? createUnmappedRequirementKey(requirement.label),
      requirementLabel: requirement.label,
      requirementWeight: normalizeWeight(requirement.level),
      priority: normalizePriority(requirement.priority),
      mapped: mappedKey !== null,
      state: normalizeConstraintValue(requirement.state),
      specialty: normalizeConstraintValue(requirement.specialty),
    };
  });
}

function normalizeResolvedFacts(
  recognition: RecognitionResolvedInput,
): NormalizedResolvedFact[] {
  return recognition.resolved.map((fact) => ({
    canonicalArtifactKey: inferCanonicalArtifactKey({
      canonicalArtifactKey: fact.canonicalArtifactKey,
      key: fact.key,
      label: fact.requirementLabel ?? fact.label,
    }),
    resolvedLevel: inferResolvedLevel(fact),
    freshness: normalizeFreshness(fact.freshness),
    revoked: fact.revoked === true,
    evidenceId: typeof fact.evidenceId === 'string' && fact.evidenceId.trim().length > 0
      ? fact.evidenceId.trim()
      : null,
    reason: typeof fact.reason === 'string' && fact.reason.trim().length > 0
      ? fact.reason.trim()
      : null,
    status: normalizeStatus(fact.status),
    source: typeof fact.source === 'string' && fact.source.trim().length > 0
      ? fact.source.trim()
      : null,
    state: normalizeConstraintValue(fact.state),
    specialty: normalizeConstraintValue(fact.specialty),
    label: typeof (fact.requirementLabel ?? fact.label) === 'string'
      ? (fact.requirementLabel ?? fact.label)!.trim()
      : null,
  }));
}

function factMatchesRequirement(
  requirement: Pick<NormalizedRequirement, 'state' | 'specialty'>,
  fact: Pick<NormalizedResolvedFact, 'state' | 'specialty'>,
): boolean {
  if (requirement.state && fact.state !== requirement.state) {
    return false;
  }
  if (requirement.specialty && fact.specialty !== requirement.specialty) {
    return false;
  }
  return true;
}

function selectBestFact(facts: readonly NormalizedResolvedFact[]): NormalizedResolvedFact {
  return [...facts].sort((left, right) => {
    const byLevel = levelPriority(right.resolvedLevel) - levelPriority(left.resolvedLevel);
    if (byLevel !== 0) {
      return byLevel;
    }

    const byRevocation = Number(left.revoked) - Number(right.revoked);
    if (byRevocation !== 0) {
      return byRevocation;
    }

    const byFreshness = freshnessPriority(right.freshness) - freshnessPriority(left.freshness);
    if (byFreshness !== 0) {
      return byFreshness;
    }

    const leftEvidence = left.evidenceId ?? '';
    const rightEvidence = right.evidenceId ?? '';
    if (leftEvidence !== rightEvidence) {
      return leftEvidence.localeCompare(rightEvidence);
    }

    return (left.source ?? '').localeCompare(right.source ?? '');
  })[0];
}

function buildReasons(input: {
  requirement: NormalizedRequirement;
  matchCode: RequirementMatchCode;
  selectedFact?: NormalizedResolvedFact;
}): string[] {
  const reasons: string[] = [];
  const fact = input.selectedFact;

  switch (input.matchCode) {
    case 'MATCHED':
      reasons.push(`Recognition resolved "${input.requirement.requirementLabel}" at L3.`);
      break;
    case 'UNMAPPED_REQUIREMENT':
      reasons.push(`Organization requirement "${input.requirement.requirementLabel}" could not be mapped to a canonical artifact key.`);
      break;
    case 'NO_MATCHING_RECOGNITION_FACT':
      reasons.push(`Recognition does not include a resolved fact for "${input.requirement.requirementLabel}".`);
      break;
    case 'CONSTRAINT_MISMATCH':
      reasons.push(`Recognition includes evidence for "${input.requirement.requirementLabel}" but not for the required state or specialty.`);
      break;
    case 'SELF_ASSERTED_ONLY':
      reasons.push(`Recognition only resolved "${input.requirement.requirementLabel}" at L1.`);
      break;
    case 'INSUFFICIENT_RESOLUTION':
      reasons.push(`Recognition resolved "${input.requirement.requirementLabel}" below L3.`);
      break;
    case 'STALE_RESOLUTION':
      reasons.push(`Recognition evidence for "${input.requirement.requirementLabel}" is stale.`);
      break;
    case 'EXPIRED_RESOLUTION':
      reasons.push(`Recognition evidence for "${input.requirement.requirementLabel}" is expired.`);
      break;
    case 'REVOKED_RESOLUTION':
      reasons.push(`Recognition evidence for "${input.requirement.requirementLabel}" is revoked or suspended.`);
      break;
    default:
      break;
  }

  if (fact?.status) {
    reasons.push(`Resolved status: ${fact.status}.`);
  }
  if (fact?.reason) {
    reasons.push(fact.reason);
  }
  if (input.requirement.state) {
    reasons.push(`Required state: ${input.requirement.state.toUpperCase()}.`);
  }
  if (input.requirement.specialty) {
    reasons.push(`Required specialty: ${input.requirement.specialty}.`);
  }

  return uniqStable(reasons);
}

function determineMatchCode(input: {
  requirement: NormalizedRequirement;
  allFacts: readonly NormalizedResolvedFact[];
  matchedFacts: readonly NormalizedResolvedFact[];
}): {
  matchCode: RequirementMatchCode;
  selectedFact?: NormalizedResolvedFact;
} {
  if (!input.requirement.mapped || isUnmappedRequirementKey(input.requirement.canonicalArtifactKey)) {
    return { matchCode: 'UNMAPPED_REQUIREMENT' };
  }

  if (input.matchedFacts.length === 0) {
    return {
      matchCode: input.allFacts.length > 0 ? 'CONSTRAINT_MISMATCH' : 'NO_MATCHING_RECOGNITION_FACT',
    };
  }

  const revokedFact = input.matchedFacts.find((fact) => fact.revoked);
  if (revokedFact) {
    return {
      matchCode: 'REVOKED_RESOLUTION',
      selectedFact: revokedFact,
    };
  }

  const selectedFact = selectBestFact(input.matchedFacts);
  if (selectedFact.resolvedLevel === 'L0') {
    return { matchCode: 'INSUFFICIENT_RESOLUTION', selectedFact };
  }
  if (selectedFact.freshness === 'expired') {
    return { matchCode: 'EXPIRED_RESOLUTION', selectedFact };
  }
  if (selectedFact.freshness === 'stale') {
    return { matchCode: 'STALE_RESOLUTION', selectedFact };
  }
  if (selectedFact.resolvedLevel === 'L1') {
    return { matchCode: 'SELF_ASSERTED_ONLY', selectedFact };
  }
  if (selectedFact.resolvedLevel === 'L2') {
    return { matchCode: 'INSUFFICIENT_RESOLUTION', selectedFact };
  }

  return { matchCode: 'MATCHED', selectedFact };
}

function actionTitleFor(canonicalArtifactKey: string, requirementLabel: string): string {
  if (isUnmappedRequirementKey(canonicalArtifactKey)) {
    return 'Map requirement';
  }

  switch (canonicalArtifactKey) {
    case 'identity_binding':
      return 'Resolve identity binding';
    case 'npi_verification':
      return 'Resolve NPI verification';
    case 'state_license':
      return 'Resolve state license evidence';
    case 'board_certification':
      return 'Resolve board certification evidence';
    case 'sanctions_clear':
      return 'Resolve sanctions clearance';
    case 'dea_registration':
      return 'Resolve DEA registration';
    case 'malpractice_insurance':
      return 'Resolve malpractice insurance evidence';
    case 'malpractice_history':
      return 'Resolve malpractice history evidence';
    case 'npdb_clear':
      return 'Resolve restricted background evidence';
    case 'background_check':
      return 'Resolve background check evidence';
    case 'privileging_file':
      return 'Resolve privileging evidence';
    case 'telehealth_agreement':
      return 'Resolve telehealth agreement';
    case 'bls_acls':
      return 'Resolve BLS/ACLS evidence';
    default:
      return `Resolve ${requirementLabel}`;
  }
}

function actionDetailFor(result: RequirementMatchResult): string {
  switch (result.matchCode) {
    case 'UNMAPPED_REQUIREMENT':
      return `Map "${result.requirementLabel}" to a canonical artifact key before using it as a decision-grade requirement.`;
    case 'NO_MATCHING_RECOGNITION_FACT':
      return `Add a resolved recognition fact for "${result.requirementLabel}".`;
    case 'CONSTRAINT_MISMATCH':
      if (result.state) {
        return `Add resolved "${result.requirementLabel}" evidence scoped to ${result.state.toUpperCase()}.`;
      }
      if (result.specialty) {
        return `Add resolved "${result.requirementLabel}" evidence scoped to specialty "${result.specialty}".`;
      }
      return `Add resolved evidence that matches "${result.requirementLabel}".`;
    case 'SELF_ASSERTED_ONLY':
      return `Replace self-asserted evidence for "${result.requirementLabel}" with source-backed resolved evidence.`;
    case 'INSUFFICIENT_RESOLUTION':
      return `Advance "${result.requirementLabel}" to L3 before treating it as satisfied.`;
    case 'STALE_RESOLUTION':
    case 'EXPIRED_RESOLUTION':
      return `Refresh "${result.requirementLabel}" so recognition carries current evidence.`;
    case 'REVOKED_RESOLUTION':
      return `Replace revoked or suspended evidence for "${result.requirementLabel}" with a current resolved fact.`;
    default:
      return `No action required for "${result.requirementLabel}".`;
  }
}

function toBlocker(result: RequirementMatchResult): RequirementBlocker | null {
  if (result.met || result.priority === 'preferred') {
    return null;
  }

  return {
    canonicalArtifactKey: result.canonicalArtifactKey,
    requirementLabel: result.requirementLabel,
    matchCode: result.matchCode as Exclude<RequirementMatchCode, 'MATCHED'>,
    detail: result.reasons[0] ?? `Requirement "${result.requirementLabel}" is not satisfied.`,
  };
}

function toMissingAction(result: RequirementMatchResult): RequirementMissingAction | null {
  if (result.met) {
    return null;
  }

  return {
    id: `${result.canonicalArtifactKey}:${result.matchCode}`.toLowerCase(),
    canonicalArtifactKey: result.canonicalArtifactKey,
    requirementLabel: result.requirementLabel,
    blocking: result.priority !== 'preferred',
    priority: actionPriorityFor(result.requirementWeight),
    title: actionTitleFor(result.canonicalArtifactKey, result.requirementLabel),
    detail: actionDetailFor(result),
  };
}

export function matchRecognitionRequirements(input: {
  recognition: RecognitionResolvedInput;
  orgRequirements: readonly EmployerRequirementSpec[];
}): RequirementMatchingOutput {
  const requirements = buildRequirements(input.orgRequirements);
  const resolvedFacts = normalizeResolvedFacts(input.recognition);

  const requirementResults = requirements.map<RequirementMatchResult>((requirement) => {
    const allFacts = resolvedFacts.filter((fact) => (
      fact.canonicalArtifactKey === requirement.canonicalArtifactKey
    ));
    const matchedFacts = allFacts.filter((fact) => factMatchesRequirement(requirement, fact));
    const { matchCode, selectedFact } = determineMatchCode({
      requirement,
      allFacts,
      matchedFacts,
    });
    const matchedEvidenceIds = uniqSorted(
      matchedFacts
        .map((fact) => fact.evidenceId)
        .filter((value): value is string => value !== null),
    );

    return {
      canonicalArtifactKey: requirement.canonicalArtifactKey,
      requirementLabel: requirement.requirementLabel,
      requirementWeight: requirement.requirementWeight,
      priority: requirement.priority,
      mapped: requirement.mapped,
      met: matchCode === 'MATCHED',
      matchCode,
      resolvedLevel: selectedFact?.resolvedLevel ?? 'L0',
      freshness: selectedFact?.freshness ?? 'not_applicable',
      revoked: selectedFact?.revoked ?? false,
      matchedEvidenceIds,
      state: requirement.state,
      specialty: requirement.specialty,
      reasons: buildReasons({
        requirement,
        matchCode,
        selectedFact,
      }),
    };
  });

  const blockers = requirementResults
    .map((result) => toBlocker(result))
    .filter((result): result is RequirementBlocker => result !== null);
  const missingActions = requirementResults
    .map((result) => toMissingAction(result))
    .filter((result): result is RequirementMissingAction => result !== null);

  return {
    requirementResults,
    blockers,
    missingActions,
  };
}

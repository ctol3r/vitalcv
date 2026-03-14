import type { EmployerRequirementSpec } from '../employers/employerCatalog';
import type {
  CanonicalArtifactKey,
  RequirementWeight,
  TrustRequirement,
  WorkflowContext,
} from './types';

export const TRUST_STATE_METHOD_VERSION = 'wave253.v1';
export const TRUST_STATE_SNAPSHOT_SOURCE = 'TRUST_STATE_ENGINE_V2';
export const TRUST_STATE_UNBOUND_NPI_PREFIX = '__trust_state_unbound__:';

type WorkflowRequirementSeed = {
  canonicalArtifactKey: CanonicalArtifactKey;
  requirementLabel: string;
  requirementWeight: RequirementWeight;
};

type ArtifactPatternRule = {
  canonicalArtifactKey: CanonicalArtifactKey;
  patterns: readonly string[];
};

type SourceTrustRule = {
  issuerId: string;
  patterns: readonly string[];
};

const CANONICAL_ARTIFACT_RULES: readonly ArtifactPatternRule[] = [
  { canonicalArtifactKey: 'identity_binding', patterns: ['identity binding', 'did binding', 'identity anchor'] },
  { canonicalArtifactKey: 'npi_verification', patterns: ['npi', 'nppes', 'cms'] },
  { canonicalArtifactKey: 'state_license', patterns: ['state license', 'medical license', 'license', 'nursys', 'fsmb', 'breeze', 'medical board'] },
  { canonicalArtifactKey: 'board_certification', patterns: ['board certification', 'board cert', 'certification', 'certified', 'abim'] },
  { canonicalArtifactKey: 'sanctions_clear', patterns: ['sanctions', 'sanction', 'oig', 'leie', 'exclusion', 'excluded'] },
  { canonicalArtifactKey: 'dea_registration', patterns: ['dea registration', 'dea'] },
  { canonicalArtifactKey: 'malpractice_history', patterns: ['malpractice history', 'claims history'] },
  { canonicalArtifactKey: 'malpractice_insurance', patterns: ['malpractice insurance', 'insurance coverage', 'insurance'] },
  { canonicalArtifactKey: 'npdb_clear', patterns: ['npdb'] },
  { canonicalArtifactKey: 'background_check', patterns: ['background check', 'background screening'] },
  { canonicalArtifactKey: 'privileging_file', patterns: ['privileging', 'credentialing file', 'hospital credentialing'] },
  { canonicalArtifactKey: 'telehealth_agreement', patterns: ['telehealth agreement', 'telehealth platform agreement', 'telehealth'] },
  { canonicalArtifactKey: 'bls_acls', patterns: ['bls', 'acls'] },
];

const WORKFLOW_DEFAULT_REQUIREMENTS: Readonly<Record<WorkflowContext, readonly WorkflowRequirementSeed[]>> = {
  job_application: [
    { canonicalArtifactKey: 'identity_binding', requirementLabel: 'Identity Binding', requirementWeight: 3 },
    { canonicalArtifactKey: 'npi_verification', requirementLabel: 'NPI Verified', requirementWeight: 3 },
    { canonicalArtifactKey: 'state_license', requirementLabel: 'State License', requirementWeight: 3 },
    { canonicalArtifactKey: 'board_certification', requirementLabel: 'Board Certification', requirementWeight: 3 },
    { canonicalArtifactKey: 'sanctions_clear', requirementLabel: 'Sanctions Clear', requirementWeight: 3 },
  ],
  privileging: [
    { canonicalArtifactKey: 'identity_binding', requirementLabel: 'Identity Binding', requirementWeight: 3 },
    { canonicalArtifactKey: 'npi_verification', requirementLabel: 'NPI Verified', requirementWeight: 3 },
    { canonicalArtifactKey: 'state_license', requirementLabel: 'State License', requirementWeight: 3 },
    { canonicalArtifactKey: 'board_certification', requirementLabel: 'Board Certification', requirementWeight: 3 },
    { canonicalArtifactKey: 'sanctions_clear', requirementLabel: 'Sanctions Clear', requirementWeight: 3 },
    { canonicalArtifactKey: 'malpractice_insurance', requirementLabel: 'Malpractice Insurance', requirementWeight: 2 },
    { canonicalArtifactKey: 'npdb_clear', requirementLabel: 'NPDB Clear', requirementWeight: 2 },
    { canonicalArtifactKey: 'background_check', requirementLabel: 'Background Check', requirementWeight: 2 },
    { canonicalArtifactKey: 'privileging_file', requirementLabel: 'Privileging File', requirementWeight: 3 },
  ],
  locums: [
    { canonicalArtifactKey: 'identity_binding', requirementLabel: 'Identity Binding', requirementWeight: 3 },
    { canonicalArtifactKey: 'npi_verification', requirementLabel: 'NPI Verified', requirementWeight: 3 },
    { canonicalArtifactKey: 'state_license', requirementLabel: 'State License', requirementWeight: 3 },
    { canonicalArtifactKey: 'board_certification', requirementLabel: 'Board Certification', requirementWeight: 3 },
    { canonicalArtifactKey: 'sanctions_clear', requirementLabel: 'Sanctions Clear', requirementWeight: 3 },
    { canonicalArtifactKey: 'dea_registration', requirementLabel: 'DEA Registration', requirementWeight: 2 },
    { canonicalArtifactKey: 'malpractice_insurance', requirementLabel: 'Malpractice Insurance', requirementWeight: 2 },
    { canonicalArtifactKey: 'background_check', requirementLabel: 'Background Check', requirementWeight: 2 },
  ],
  share: [
    { canonicalArtifactKey: 'identity_binding', requirementLabel: 'Identity Binding', requirementWeight: 3 },
    { canonicalArtifactKey: 'npi_verification', requirementLabel: 'NPI Verified', requirementWeight: 3 },
    { canonicalArtifactKey: 'state_license', requirementLabel: 'Current State License', requirementWeight: 3 },
    { canonicalArtifactKey: 'sanctions_clear', requirementLabel: 'Sanctions Clear', requirementWeight: 3 },
  ],
};

const SOURCE_TRUST_RULES: readonly SourceTrustRule[] = [
  { issuerId: 'did:vitalcv:issuer:npi-registry', patterns: ['nppes', 'npi', 'cms'] },
  { issuerId: 'did:vitalcv:issuer:dea', patterns: ['dea'] },
  { issuerId: 'did:vitalcv:issuer:abim', patterns: ['abim', 'board', 'certification'] },
  {
    issuerId: 'did:vitalcv:issuer:vitalcv-psv',
    patterns: [
      'nursys',
      'fsmb',
      'breeze',
      'state',
      'license',
      'medical board',
      'oig',
      'leie',
      'npdb',
      'background',
      'privileg',
      'credentialing',
      'vitalcv',
      'psv',
      'malpractice',
      'insurance',
      'telehealth',
      'bls',
      'acls',
    ],
  },
];

const FRESHNESS_WINDOWS_DAYS: Readonly<Record<CanonicalArtifactKey, number | null>> = {
  identity_binding: null,
  npi_verification: null,
  state_license: 180,
  board_certification: 365,
  sanctions_clear: 30,
  dea_registration: 90,
  malpractice_insurance: 90,
  malpractice_history: 90,
  npdb_clear: 30,
  background_check: 30,
  privileging_file: 90,
  telehealth_agreement: 30,
  bls_acls: 90,
};

export function normalizeTrustText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createUnmappedRequirementKey(label: string): string {
  const normalized = normalizeTrustText(label).replace(/\s+/g, '_');
  return `unmapped_requirement:${normalized || 'unknown'}`;
}

export function isUnmappedRequirementKey(value: string): boolean {
  return value.startsWith('unmapped_requirement:');
}

export function mapRequirementLevelToWeight(level: unknown): RequirementWeight {
  if (level === 'L3') {
    return 3;
  }
  if (level === 'L2') {
    return 2;
  }
  return 1;
}

export function matchesCanonicalArtifactKey(
  canonicalArtifactKey: CanonicalArtifactKey,
  text: string,
): boolean {
  const normalized = normalizeTrustText(text);
  const rule = CANONICAL_ARTIFACT_RULES.find((candidate) => candidate.canonicalArtifactKey === canonicalArtifactKey);
  if (!rule) {
    return false;
  }

  return rule.patterns.some((pattern) => normalized.includes(pattern));
}

export function mapRequirementLabelToCanonicalKey(label: string): CanonicalArtifactKey | null {
  const normalized = normalizeTrustText(label);
  for (const rule of CANONICAL_ARTIFACT_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      return rule.canonicalArtifactKey;
    }
  }

  return null;
}

export function buildOrganizationRequirements(
  requirements: readonly EmployerRequirementSpec[],
): TrustRequirement[] {
  return requirements.map((requirement) => {
    const mappedKey = mapRequirementLabelToCanonicalKey(requirement.label);
    return {
      canonicalArtifactKey: mappedKey ?? createUnmappedRequirementKey(requirement.label),
      requirementLabel: requirement.label,
      requirementWeight: mapRequirementLevelToWeight(requirement.level),
      mapped: mappedKey !== null,
      source: 'organization_requirement',
    };
  });
}

export function getWorkflowDefaultRequirements(workflowContext: WorkflowContext): TrustRequirement[] {
  return WORKFLOW_DEFAULT_REQUIREMENTS[workflowContext].map((requirement) => ({
    canonicalArtifactKey: requirement.canonicalArtifactKey,
    requirementLabel: requirement.requirementLabel,
    requirementWeight: requirement.requirementWeight,
    mapped: true,
    source: 'workflow_default',
  }));
}

export function resolveTrustRequirements(
  workflowContext: WorkflowContext,
  organizationRequirements: readonly EmployerRequirementSpec[],
): TrustRequirement[] {
  if (organizationRequirements.length > 0) {
    return buildOrganizationRequirements(organizationRequirements);
  }

  return getWorkflowDefaultRequirements(workflowContext);
}

export function getFreshnessWindowDays(canonicalArtifactKey: string): number | null {
  if (isUnmappedRequirementKey(canonicalArtifactKey)) {
    return 90;
  }

  return FRESHNESS_WINDOWS_DAYS[canonicalArtifactKey as CanonicalArtifactKey] ?? 90;
}

export function resolveSourceTrustedIssuerId(source: string): string | null {
  const normalized = normalizeTrustText(source);
  for (const rule of SOURCE_TRUST_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      return rule.issuerId;
    }
  }

  return null;
}

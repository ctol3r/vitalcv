import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

import type { IMLCStatus } from './models/IMLCEligibility.js';
import type { PSYPACTStatus } from './models/Psycompact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMPACT_MATRIX_PATH = path.resolve(__dirname, '../../config/compact-matrix.v1.1.yaml');

export type CompactType = 'IMLC' | 'NLC' | 'PSYPACT' | 'APRN' | 'PT';

type NurseCompactStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'ACTIVE';
type AlliedCompactStatus = 'NOT_ELIGIBLE' | 'ELIGIBLE' | 'ACTIVE';

export interface ClinicianLicense {
  state: string;
  type: string;
  status: 'active' | 'inactive' | 'expired' | 'revoked';
  issueDate?: string | Date;
  expirationDate?: string | Date;
  isPrimary?: boolean;
  isMultiState?: boolean;
}

export interface IMLCCompactInfo {
  status?: IMLCStatus;
  homeState?: string;
  compactStates?: string[];
  lastCheckedAt?: string | Date;
}

export interface NurseCompactInfo {
  status?: NurseCompactStatus;
  homeState?: string;
  multistate?: boolean;
  privilegeStates?: string[];
  residencyDaysInCurrentState?: number;
  lastCheckedAt?: string | Date;
}

export interface PsypactInfo {
  status?: PSYPACTStatus;
  authorities?: Array<'APIT' | 'TAP'>;
  participatingStates?: string[];
  ePassport?: boolean;
  expiresAt?: string | Date;
}

export interface AprnCompactInfo {
  status?: AlliedCompactStatus;
  homeState?: string;
  privilegeStates?: string[];
  lastCheckedAt?: string | Date;
}

export interface PtCompactInfo {
  status?: AlliedCompactStatus;
  privilegeStates?: string[];
  restrictions?: string[];
  lastCheckedAt?: string | Date;
}

export interface ClinicianCompactProfile {
  did: string;
  profession?: string;
  homeState?: string;
  licenses?: ClinicianLicense[];
  metadata?: {
    residencyDaysInCurrentState?: number;
    hasDisciplinaryActions?: boolean;
  };
  compacts?: {
    imlc?: IMLCCompactInfo;
    nlc?: NurseCompactInfo;
    psypact?: PsypactInfo;
    aprn?: AprnCompactInfo;
    pt?: PtCompactInfo;
  };
}

export interface ConditionCheck {
  code: string;
  passed: boolean;
  detail: string;
}

export interface PracticeEligibilityResult {
  eligible: boolean;
  reason: string;
  conditions: ConditionCheck[];
}

interface CompactMatrix {
  compacts?: {
    [key: string]: {
      participating_states?: string[];
      special_rules?: Record<string, unknown>;
      active_issues?: Array<{ state: string; issue: string; details?: string }>;
    };
  };
  aprn_compact?: {
    participating_states?: string[];
  };
}

let cachedMatrix: CompactMatrix | null = null;

function loadCompactMatrix(): CompactMatrix {
  if (cachedMatrix) return cachedMatrix;
  const fileContents = fs.readFileSync(COMPACT_MATRIX_PATH, 'utf8');
  cachedMatrix = yaml.load(fileContents) as CompactMatrix;
  return cachedMatrix ?? {};
}

function getParticipatingStates(compact: CompactType): string[] {
  const matrix = loadCompactMatrix();
  if (compact === 'APRN') {
    return matrix.aprn_compact?.participating_states ?? [];
  }

  const key = compact === 'PT' ? 'PT_COMPACT' : compact;
  return matrix.compacts?.[key]?.participating_states ?? [];
}

function getActiveIssues(compact: CompactType, state: string) {
  const matrix = loadCompactMatrix();
  if (compact === 'APRN') return null;
  const key = compact === 'PT' ? 'PT_COMPACT' : compact;
  const issues = matrix.compacts?.[key]?.active_issues;
  if (!issues) return null;
  return issues.find((issue) => issue.state === state) ?? null;
}

class ConditionBuilder {
  private readonly conditions: ConditionCheck[] = [];

  add(code: string, passed: boolean, detail: string) {
    this.conditions.push({ code, passed, detail });
  }

  result(successReason: string, failureFallback = 'Compact eligibility requirements not satisfied'): PracticeEligibilityResult {
    const failing = this.conditions.find((cond) => !cond.passed);
    if (!failing) {
      return {
        eligible: true,
        reason: successReason,
        conditions: this.conditions,
      };
    }

    return {
      eligible: false,
      reason: failing.detail || failureFallback,
      conditions: this.conditions,
    };
  }
}

function normalizeState(state?: string): string | undefined {
  return state?.trim().toUpperCase();
}

function hasMinimumMonths(license?: ClinicianLicense, months = 12): boolean {
  if (!license?.issueDate) return false;
  const issueDate = new Date(license.issueDate);
  if (Number.isNaN(issueDate.getTime())) return false;
  const now = new Date();
  const diffMonths =
    (now.getFullYear() - issueDate.getFullYear()) * 12 +
    (now.getMonth() - issueDate.getMonth());
  return diffMonths >= months;
}

function hasActiveLicense(profile: ClinicianCompactProfile, predicate: (license: ClinicianLicense) => boolean): ClinicianLicense | undefined {
  return profile.licenses?.find((license) => license.status === 'active' && predicate(license));
}

function isPhysicianLicense(type?: string): boolean {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return normalized.includes('md') || normalized.includes('do') || normalized.includes('physician');
}

function isNursingLicense(type?: string): boolean {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return normalized.includes('rn') || normalized.includes('lpn') || normalized.includes('lvn');
}

function isAprnLicense(type?: string): boolean {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return normalized.includes('aprn') || normalized.includes('np') || normalized.includes('crna') || normalized.includes('cnm');
}

function isPhysicalTherapyLicense(type?: string): boolean {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return normalized.includes('pt') || normalized.includes('physical');
}

function ensureTargetState(targetState: string): string {
  if (!targetState) {
    throw new Error('targetState is required');
  }
  return targetState.trim().toUpperCase();
}

function evaluateIMLC(clinician: ClinicianCompactProfile, rawTargetState: string): PracticeEligibilityResult {
  const targetState = ensureTargetState(rawTargetState);
  const builder = new ConditionBuilder();
  const participatingStates = getParticipatingStates('IMLC');
  const targetSupported = participatingStates.includes(targetState);
  builder.add(
    'target_participating',
    targetSupported,
    targetSupported
      ? `Target state ${targetState} participates in IMLC`
      : `Target state ${targetState} is not part of the IMLC compact`
  );

  const imlc = clinician.compacts?.imlc;
  const derivedHomeState =
    normalizeState(imlc?.homeState) ||
    normalizeState(clinician.homeState) ||
    normalizeState(
      clinician.licenses?.find((license) => license.isPrimary)?.state
    );

  const homeStateSupported = !!derivedHomeState && participatingStates.includes(derivedHomeState);
  builder.add(
    'home_state_member',
    homeStateSupported,
    homeStateSupported
      ? `Home state ${derivedHomeState} participates in IMLC`
      : 'Clinician must designate an IMLC member home state'
  );

  const primaryLicense = hasActiveLicense(
    clinician,
    (license) => normalizeState(license.state) === derivedHomeState && isPhysicianLicense(license.type)
  );

  builder.add(
    'active_home_license',
    !!primaryLicense,
    primaryLicense
      ? `Active physician license found in home state ${derivedHomeState}`
      : 'Active physician license in the home state is required for IMLC'
  );

  const hasTenure = hasMinimumMonths(primaryLicense, 12);
  builder.add(
    'minimum_practice_time',
    hasTenure,
    hasTenure
      ? 'Primary license meets 12-month practice requirement'
      : 'Primary license must be active for at least 12 months to satisfy IMLC practice time rules'
  );

  const noDiscipline = clinician.metadata?.hasDisciplinaryActions !== true;
  builder.add(
    'discipline_check',
    noDiscipline,
    noDiscipline
      ? 'No disciplinary actions on record'
      : 'IMLC eligibility blocked by disciplinary or pending board actions'
  );

  const authorizedStates = new Set<string>();
  if (derivedHomeState) {
    authorizedStates.add(derivedHomeState);
  }
  imlc?.compactStates?.forEach((state) => authorizedStates.add(normalizeState(state)!));

  const coverage = authorizedStates.has(targetState);
  builder.add(
    'coverage',
    coverage,
    coverage
      ? `IMLC privilege lists ${targetState} among authorized states`
      : `IMLC privilege does not currently cover ${targetState}`
  );

  return builder.result(`IMLC privilege allows practice in ${targetState}`);
}

function evaluateNLC(clinician: ClinicianCompactProfile, rawTargetState: string): PracticeEligibilityResult {
  const targetState = ensureTargetState(rawTargetState);
  const builder = new ConditionBuilder();
  const participatingStates = getParticipatingStates('NLC');

  const targetSupported = participatingStates.includes(targetState);
  builder.add(
    'target_participating',
    targetSupported,
    targetSupported
      ? `Target state ${targetState} participates in the Nurse Licensure Compact`
      : `Target state ${targetState} is not part of the Nurse Licensure Compact`
  );

  const nlc = clinician.compacts?.nlc;
  const homeState = normalizeState(nlc?.homeState) || normalizeState(clinician.homeState);
  const homeSupported = !!homeState && participatingStates.includes(homeState);
  builder.add(
    'home_state_member',
    homeSupported,
    homeSupported
      ? `Home state ${homeState} participates in the Nurse Licensure Compact`
      : 'Home state must be an NLC participant'
  );

  const nurseLicense = hasActiveLicense(
    clinician,
    (license) => isNursingLicense(license.type) && normalizeState(license.state) === homeState
  );

  builder.add(
    'active_home_license',
    !!nurseLicense,
    nurseLicense
      ? `Active nursing license detected in ${homeState}`
      : 'Active nursing license in home state is required for multi-state privileges'
  );

  const multistatePrivilege = nlc?.multistate === true || nurseLicense?.isMultiState === true;
  builder.add(
    'multistate_flag',
    multistatePrivilege,
    multistatePrivilege
      ? 'Multi-state privilege is active'
      : 'NLC multi-state privilege is not active'
  );

  const residencyDays = nlc?.residencyDaysInCurrentState ?? clinician.metadata?.residencyDaysInCurrentState;
  const residencyRequirement = targetState === homeState ? true : (residencyDays ?? 0) >= 60;
  builder.add(
    'residency_60_day_rule',
    residencyRequirement,
    residencyRequirement
      ? 'Residency requirement satisfied for multi-state privilege portability'
      : 'NLC portability limited until 60-day residency requirement is satisfied'
  );

  const authorizedStates =
    nlc?.privilegeStates && nlc.privilegeStates.length > 0
      ? new Set(nlc.privilegeStates.map((state) => normalizeState(state)!))
      : new Set(participatingStates);

  const coverage = multistatePrivilege && authorizedStates.has(targetState);
  builder.add(
    'coverage',
    coverage,
    coverage
      ? `NLC multi-state privilege covers ${targetState}`
      : `NLC multi-state privilege does not list ${targetState}`
  );

  return builder.result(`NLC multi-state privilege allows practice in ${targetState}`);
}

function evaluatePSYPACT(clinician: ClinicianCompactProfile, rawTargetState: string): PracticeEligibilityResult {
  const targetState = ensureTargetState(rawTargetState);
  const builder = new ConditionBuilder();
  const participatingStates = getParticipatingStates('PSYPACT');

  const targetSupported = participatingStates.includes(targetState);
  builder.add(
    'target_participating',
    targetSupported,
    targetSupported
      ? `Target state ${targetState} participates in PSYPACT`
      : `Target state ${targetState} has not adopted PSYPACT`
  );

  const psypact = clinician.compacts?.psypact;

  const psychologistLicense = hasActiveLicense(
    clinician,
    (license) => normalizeState(license.state) && license.status === 'active' && license.type?.toLowerCase().includes('psych')
  );
  builder.add(
    'active_psychology_license',
    !!psychologistLicense,
    psychologistLicense
      ? 'Active psychology license detected'
      : 'Active psychology license is required for PSYPACT'
  );

  const hasEPassport = psypact?.ePassport === true;
  builder.add(
    'epassport',
    hasEPassport,
    hasEPassport
      ? 'PSYPACT e.Passport is active'
      : 'PSYPACT e.Passport must be active for interstate practice'
  );

  const authorityGranted = (psypact?.authorities ?? []).includes('APIT');
  builder.add(
    'apit_authority',
    authorityGranted,
    authorityGranted
      ? 'APIT authority granted for telepsychology'
      : 'APIT authority is required to render telepsychology services'
  );

  const coverage = psypact?.participatingStates?.map((state) => normalizeState(state)) ?? [];
  const coversTarget = coverage.includes(targetState);
  builder.add(
    'coverage',
    !!coversTarget,
    coversTarget
      ? `PSYPACT coverage list includes ${targetState}`
      : `PSYPACT coverage list does not include ${targetState}`
  );

  return builder.result(`PSYPACT privileges allow practice in ${targetState}`);
}

function evaluateAPRN(clinician: ClinicianCompactProfile, rawTargetState: string): PracticeEligibilityResult {
  const targetState = ensureTargetState(rawTargetState);
  const builder = new ConditionBuilder();
  const participatingStates = getParticipatingStates('APRN');

  const targetSupported = participatingStates.includes(targetState);
  builder.add(
    'target_participating',
    targetSupported,
    targetSupported
      ? `Target state ${targetState} is in the APRN compact adoption cohort`
      : `Target state ${targetState} has not adopted the APRN compact`
  );

  const aprnCompact = clinician.compacts?.aprn;
  const homeState = normalizeState(aprnCompact?.homeState) || normalizeState(clinician.homeState);
  const homeSupported = !!homeState && participatingStates.includes(homeState);
  builder.add(
    'home_state_member',
    homeSupported,
    homeSupported
      ? `Home state ${homeState} participates in the APRN compact`
      : 'Home state is not participating in the APRN compact'
  );

  const aprnLicense = hasActiveLicense(
    clinician,
    (license) => normalizeState(license.state) === homeState && isAprnLicense(license.type)
  );
  builder.add(
    'active_aprn_license',
    !!aprnLicense,
    aprnLicense
      ? `Active APRN license detected in ${homeState}`
      : 'Active APRN license in the home state is required'
  );

  const compactStatus = aprnCompact?.status && aprnCompact.status !== 'NOT_ELIGIBLE';
  builder.add(
    'compact_status',
    compactStatus,
    compactStatus
      ? 'APRN compact status is active'
      : 'APRN compact status is not active'
  );

  const authorizedStates =
    aprnCompact?.privilegeStates && aprnCompact.privilegeStates.length > 0
      ? aprnCompact.privilegeStates.map((state) => normalizeState(state)!)
      : participatingStates;

  const coverage = compactStatus && authorizedStates.includes(targetState);
  builder.add(
    'coverage',
    !!coverage,
    coverage
      ? `APRN compact privilege covers ${targetState}`
      : `APRN compact privilege does not include ${targetState}`
  );

  return builder.result(`APRN compact privilege allows practice in ${targetState}`);
}

function evaluatePT(clinician: ClinicianCompactProfile, rawTargetState: string): PracticeEligibilityResult {
  const targetState = ensureTargetState(rawTargetState);
  const builder = new ConditionBuilder();
  const participatingStates = getParticipatingStates('PT');

  const targetSupported = participatingStates.includes(targetState);
  builder.add(
    'target_participating',
    targetSupported,
    targetSupported
      ? `Target state ${targetState} participates in the PT Compact`
      : `Target state ${targetState} does not participate in the PT Compact`
  );

  const pt = clinician.compacts?.pt;
  const ptLicense = hasActiveLicense(
    clinician,
    (license) => isPhysicalTherapyLicense(license.type)
  );
  builder.add(
    'active_pt_license',
    !!ptLicense,
    ptLicense ? 'Active physical therapy license detected' : 'Active physical therapy license is required'
  );

  const ptStatus = pt?.status && pt.status !== 'NOT_ELIGIBLE';
  builder.add(
    'compact_status',
    ptStatus,
    ptStatus ? 'PT Compact privilege is active' : 'PT Compact privilege is not active'
  );

  const authorizedStates = new Set(
    (pt?.privilegeStates ?? []).map((state) => normalizeState(state)!)
  );
  const coverage = authorizedStates.has(targetState);
  builder.add(
    'coverage',
    coverage,
    coverage
      ? `PT Compact privilege covers ${targetState}`
      : `PT Compact privilege does not list ${targetState}`
  );

  const issue = getActiveIssues('PT', targetState);
  if (issue) {
    builder.add(
      'active_issue',
      false,
      issue.details
        ? `${issue.issue}: ${issue.details}`
        : issue.issue
    );
  }

  return builder.result(`PT Compact privilege allows practice in ${targetState}`);
}

export function evaluatePracticeEligibility(
  compactType: CompactType,
  clinicianProfile: ClinicianCompactProfile,
  targetState: string
): PracticeEligibilityResult {
  switch (compactType) {
    case 'IMLC':
      return evaluateIMLC(clinicianProfile, targetState);
    case 'NLC':
      return evaluateNLC(clinicianProfile, targetState);
    case 'PSYPACT':
      return evaluatePSYPACT(clinicianProfile, targetState);
    case 'APRN':
      return evaluateAPRN(clinicianProfile, targetState);
    case 'PT':
      return evaluatePT(clinicianProfile, targetState);
    default:
      throw new Error(`Unsupported compact type: ${compactType}`);
  }
}

export function listAuthorizedStatesForCompact(
  compactType: CompactType,
  clinicianProfile: ClinicianCompactProfile
): string[] {
  switch (compactType) {
    case 'IMLC': {
      const home = normalizeState(clinicianProfile.compacts?.imlc?.homeState) || normalizeState(clinicianProfile.homeState);
      const states = new Set<string>();
      if (home) states.add(home);
      clinicianProfile.compacts?.imlc?.compactStates?.forEach((state) => {
        const normalized = normalizeState(state);
        if (normalized) states.add(normalized);
      });
      return Array.from(states);
    }
    case 'NLC': {
      const nlc = clinicianProfile.compacts?.nlc;
      if (!nlc?.multistate) return [];
      if (nlc.privilegeStates && nlc.privilegeStates.length > 0) {
        return nlc.privilegeStates.map((state) => normalizeState(state)!).filter(Boolean);
      }
      return getParticipatingStates('NLC');
    }
    case 'PSYPACT':
      return (
        clinicianProfile.compacts?.psypact?.participatingStates?.map((state) => normalizeState(state)!).filter(Boolean) ??
        []
      );
    case 'APRN':
      return (
        clinicianProfile.compacts?.aprn?.privilegeStates?.map((state) => normalizeState(state)!).filter(Boolean) ??
        getParticipatingStates('APRN')
      );
    case 'PT':
      return (
        clinicianProfile.compacts?.pt?.privilegeStates?.map((state) => normalizeState(state)!).filter(Boolean) ?? []
      );
    default:
      return [];
  }
}


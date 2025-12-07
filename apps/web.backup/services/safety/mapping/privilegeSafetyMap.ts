import { ALL_PRIVILEGES_TOKEN, ensurePrivilegeCodes, type PrivilegeSafetySignalType } from '../models/PrivilegeSafetySignal.js';

export type PrivilegeSafetyImpactMap = Record<string, PrivilegeSafetySignalType[]>;

const GLOBAL_SIGNALS: PrivilegeSafetySignalType[] = [
  'LICENSE_RISK',
  'QUALITY_RISK',
  'COMPACT_ELIGIBILITY_LOSS',
  'NPDB_FLAG',
];

export const privilegeSafetyMap: PrivilegeSafetyImpactMap = {
  [ALL_PRIVILEGES_TOKEN]: GLOBAL_SIGNALS,
  'ANES-GEN': ['DEA_EXPIRED', 'OPPE_LOW', 'FPPE_FAILURE', 'QUALITY_RISK'],
  'PAIN-BLOCK': ['DEA_EXPIRED', 'QUALITY_RISK'],
  'CARD-CATH-LAB': ['QUALITY_RISK', 'PAYER_DENIAL_SPIKE', 'EHR_MISMATCH'],
  'HOSP-MED': ['LICENSE_RISK', 'QUALITY_RISK', 'PAYER_DENIAL_SPIKE'],
  'TELE-PSYCH': ['COMPACT_ELIGIBILITY_LOSS', 'QUALITY_RISK'],
  'IMAGING-CT': ['QUALITY_RISK', 'OPPE_LOW'],
  'ONC-INFUSION': ['DEA_EXPIRED', 'QUALITY_RISK'],
};

export function getSignalTypesForPrivilege(
  privilegeCode: string,
  map: PrivilegeSafetyImpactMap = privilegeSafetyMap
): PrivilegeSafetySignalType[] {
  const normalized = ensurePrivilegeCodes([privilegeCode])[0] ?? ALL_PRIVILEGES_TOKEN;
  if (map[normalized]) {
    return map[normalized];
  }
  return map[ALL_PRIVILEGES_TOKEN] ?? GLOBAL_SIGNALS;
}

interface ResolveOptions {
  candidatePrivileges?: string[];
  map?: PrivilegeSafetyImpactMap;
}

export function resolvePrivilegesForSignal(
  signalType: PrivilegeSafetySignalType,
  options: ResolveOptions = {}
): string[] {
  const map = options.map ?? privilegeSafetyMap;
  const candidates = options.candidatePrivileges
    ? ensurePrivilegeCodes(options.candidatePrivileges)
    : derivePrivilegesFromMap(signalType, map);

  if (candidates.length > 0) {
    return candidates;
  }

  const globalSignals = map[ALL_PRIVILEGES_TOKEN] ?? GLOBAL_SIGNALS;
  if (globalSignals.includes(signalType)) {
    return [ALL_PRIVILEGES_TOKEN];
  }
  return [];
}

function derivePrivilegesFromMap(
  signalType: PrivilegeSafetySignalType,
  map: PrivilegeSafetyImpactMap
): string[] {
  const matches = new Set<string>();
  for (const [code, types] of Object.entries(map)) {
    if (code === ALL_PRIVILEGES_TOKEN) {
      continue;
    }
    if (types.includes(signalType)) {
      matches.add(code);
    }
  }

  return Array.from(matches);
}


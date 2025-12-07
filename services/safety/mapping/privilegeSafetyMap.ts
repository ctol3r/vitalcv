import { PrivilegeSafetySignalType } from '../models/PrivilegeSafetySignal.js';

type SignalMatcher = {
  test: (privilegeCode: string) => boolean;
  signals: PrivilegeSafetySignalType[];
};

const SIGNAL_TYPE_ALIASES: Record<string, PrivilegeSafetySignalType> = {
  LIC_EXPIRED: 'LICENSE_RISK',
  LICENSE_EXPIRED: 'LICENSE_RISK',
};

const EXACT_PRIVILEGE_SIGNAL_MAP: Record<string, PrivilegeSafetySignalType[]> = {
  'LIC-GENERAL': ['LICENSE_RISK'],
  'LIC-STATE': ['LICENSE_RISK'],
  'DEA-REGISTERED': ['DEA_EXPIRED'],
  'BOARD-CERTIFIED': ['BOARD_EXPIRED'],
  'PAYER-ENROLLMENT': ['PAYER_DENIAL_SPIKE'],
};

const MATCHERS: SignalMatcher[] = [
  {
    test: (code) => /ANES|SED|PAIN/.test(code.toUpperCase()),
    signals: ['DEA_EXPIRED', 'QUALITY_RISK'],
  },
  {
    test: (code) => /CARD|CRIT/.test(code.toUpperCase()),
    signals: ['QUALITY_RISK', 'OPPE_LOW'],
  },
  {
    test: (code) => /FPPE|OPPE/.test(code.toUpperCase()),
    signals: ['FPPE_FAILURE', 'OPPE_LOW'],
  },
  {
    test: (code) => /EHR|IT|CONNECT/.test(code.toUpperCase()),
    signals: ['EHR_MISMATCH'],
  },
  {
    test: (code) => /COMPACT/.test(code.toUpperCase()),
    signals: ['COMPACT_ELIGIBILITY_LOSS'],
  },
];

const FALLBACK_SIGNALS: PrivilegeSafetySignalType[] = ['LICENSE_RISK', 'QUALITY_RISK'];

const SIGNAL_DEFAULT_PRIVILEGES: Record<PrivilegeSafetySignalType, string[]> = {
  LICENSE_RISK: ['ALL_PRIVILEGES'],
  QUALITY_RISK: ['QUALITY_PROGRAM'],
  EHR_MISMATCH: ['EHR_SYNC'],
  COMPACT_ELIGIBILITY_LOSS: ['COMPACT_ELIGIBILITY'],
  PAYER_DENIAL_SPIKE: ['PAYER_ENROLLMENT'],
  OPPE_LOW: ['OPPE_MONITORED'],
  FPPE_FAILURE: ['FPPE_MONITORED'],
  DEA_EXPIRED: ['ANES_CORE', 'PAIN_MANAGEMENT'],
  BOARD_EXPIRED: ['BOARD_CERT'],
  NPDB_FLAG: ['ALL_PRIVILEGES'],
};

export function normalizeSignalType(
  type: PrivilegeSafetySignalType | keyof typeof SIGNAL_TYPE_ALIASES
): PrivilegeSafetySignalType {
  if (type in SIGNAL_TYPE_ALIASES) {
    return SIGNAL_TYPE_ALIASES[type as keyof typeof SIGNAL_TYPE_ALIASES];
  }
  return type as PrivilegeSafetySignalType;
}

export function getSignalTypesForPrivilege(code: string): PrivilegeSafetySignalType[] {
  const normalizedCode = code.toUpperCase();
  const matches = new Set<PrivilegeSafetySignalType>();

  const exact = EXACT_PRIVILEGE_SIGNAL_MAP[normalizedCode];
  if (exact) {
    exact.forEach((signal) => matches.add(signal));
  }

  MATCHERS.forEach((matcher) => {
    if (matcher.test(normalizedCode)) {
      matcher.signals.forEach((signal) => matches.add(signal));
    }
  });

  if (matches.size === 0) {
    FALLBACK_SIGNALS.forEach((signal) => matches.add(signal));
  }

  return Array.from(matches);
}

export function filterPrivilegesForSignal(
  privilegeCodes: string[],
  signalType: PrivilegeSafetySignalType | keyof typeof SIGNAL_TYPE_ALIASES
): string[] {
  const normalizedSignal = normalizeSignalType(signalType);
  return privilegeCodes.filter((code) => getSignalTypesForPrivilege(code).includes(normalizedSignal));
}

export function isSignalGlobal(signalType: PrivilegeSafetySignalType): boolean {
  return signalType === 'LICENSE_RISK' || signalType === 'NPDB_FLAG';
}

export function getDefaultPrivilegesForSignal(
  signalType: PrivilegeSafetySignalType
): string[] {
  return SIGNAL_DEFAULT_PRIVILEGES[signalType] ?? ['UNSPECIFIED_PRIVILEGE'];
}


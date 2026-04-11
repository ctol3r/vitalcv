export enum DecisionState {
  READY = 'READY',
  CONDITIONAL = 'CONDITIONAL',
  BLOCKED = 'BLOCKED',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
}

export interface DecisionProfileSection {
  verified?: boolean | null;
}

export interface DecisionProfile {
  identity?: DecisionProfileSection | null;
  employment?: DecisionProfileSection | null;
}

const IDENTITY_FIELD = 'identity';
const IDENTITY_VERIFIED_FIELD = 'identity.verified';
const EMPLOYMENT_FIELD = 'employment';
const EMPLOYMENT_VERIFIED_FIELD = 'employment.verified';

function hasOwnValue<T extends object, K extends keyof T>(value: T, key: K): boolean {
  return value[key] !== undefined && value[key] !== null;
}

export function getMissingCriticalFields(profile: DecisionProfile): readonly string[] {
  const missing: string[] = [];

  if (!profile.identity) {
    missing.push(IDENTITY_FIELD);
  } else if (!hasOwnValue(profile.identity, 'verified')) {
    missing.push(IDENTITY_VERIFIED_FIELD);
  }

  if (!profile.employment) {
    missing.push(EMPLOYMENT_FIELD);
  } else if (!hasOwnValue(profile.employment, 'verified')) {
    missing.push(EMPLOYMENT_VERIFIED_FIELD);
  }

  return Object.freeze(missing);
}

export function isDecisionReady(profile: DecisionProfile): DecisionState {
  const missingFields = getMissingCriticalFields(profile);
  const missingIdentity = missingFields.some((field) => field.startsWith(IDENTITY_FIELD));

  if (missingIdentity) {
    return DecisionState.ACTION_REQUIRED;
  }

  if (profile.identity?.verified === false || profile.employment?.verified === false) {
    return DecisionState.BLOCKED;
  }

  const missingEmployment = missingFields.some((field) => field.startsWith(EMPLOYMENT_FIELD));
  if (missingEmployment) {
    return DecisionState.CONDITIONAL;
  }

  return DecisionState.READY;
}

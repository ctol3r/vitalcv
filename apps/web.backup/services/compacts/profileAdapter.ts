import type { CompactsStatusData } from './models/CompactsStatus.js';
import type {
  ClinicianCompactProfile,
  ClinicianLicense,
  IMLCCompactInfo,
  PsypactInfo,
} from './eligibilityEngine.js';

import type { IMLCStatus } from './models/IMLCEligibility.js';
import type { PSYPACTStatus } from './models/Psycompact.js';

const SYNTHETIC_LICENSE_MONTH_OFFSET = 18;

function createSyntheticIssueDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - SYNTHETIC_LICENSE_MONTH_OFFSET);
  return date.toISOString();
}

function ensureLicenseArray(profile: ClinicianCompactProfile): ClinicianLicense[] {
  if (!profile.licenses) profile.licenses = [];
  return profile.licenses;
}

function applyIMLCSection(profile: ClinicianCompactProfile, status: CompactsStatusData) {
  if (!status.imlcHomeState || status.imlcStatus === 'NOT_ELIGIBLE') {
    return;
  }

  const compactInfo: IMLCCompactInfo = {
    status: status.imlcStatus as IMLCStatus,
    homeState: status.imlcHomeState,
    compactStates: status.imlcCompactStates,
  };

  profile.compacts = profile.compacts ?? {};
  profile.compacts.imlc = compactInfo;

  const licenses = ensureLicenseArray(profile);
  const hasHomeLicense = licenses.some(
    (license) => license.state === status.imlcHomeState && license.type?.toLowerCase().includes('md'),
  );

  if (!hasHomeLicense) {
    licenses.push({
      state: status.imlcHomeState,
      type: 'MD',
      status: 'active',
      issueDate: createSyntheticIssueDate(),
      isPrimary: true,
    });
  }
}

function applyPSYPACTSection(profile: ClinicianCompactProfile, status: CompactsStatusData) {
  if (status.psypactStatus === 'NOT_ELIGIBLE' || status.psypactStates.length === 0) {
    return;
  }

  const authorities = ['APIT'];
  const ePassport = (status.metadata as any)?.psypact?.ePassport ?? true;

  const psypactInfo: PsypactInfo = {
    status: status.psypactStatus as PSYPACTStatus,
    participatingStates: status.psypactStates,
    authorities,
    ePassport,
  };

  profile.compacts = profile.compacts ?? {};
  profile.compacts.psypact = psypactInfo;

  const primaryState = status.psypactStates[0] || status.imlcHomeState || profile.homeState || 'AZ';
  const licenses = ensureLicenseArray(profile);
  const hasPsychLicense = licenses.some(
    (license) => license.state === primaryState && license.type?.toLowerCase().includes('psych'),
  );

  if (!hasPsychLicense) {
    licenses.push({
      state: primaryState,
      type: 'Clinical Psychologist',
      status: 'active',
      issueDate: createSyntheticIssueDate(),
      isPrimary: true,
    });
  }
}

export function buildClinicianProfileFromStatus(
  status: CompactsStatusData,
  overrides?: Partial<ClinicianCompactProfile>
): ClinicianCompactProfile {
  const profile: ClinicianCompactProfile = {
    did: status.clinicianDid,
    homeState: status.imlcHomeState || status.counselingHomeState,
    licenses: [],
    metadata: {
      hasDisciplinaryActions: false,
      residencyDaysInCurrentState: 365,
    },
    compacts: {},
  };

  applyIMLCSection(profile, status);
  applyPSYPACTSection(profile, status);

  if (overrides) {
    if (overrides.metadata) {
      profile.metadata = { ...profile.metadata, ...overrides.metadata };
    }
    if (overrides.compacts) {
      profile.compacts = { ...profile.compacts, ...overrides.compacts };
    }
    if (overrides.licenses) {
      profile.licenses = overrides.licenses;
    }
    if (overrides.homeState) {
      profile.homeState = overrides.homeState;
    }
    if (overrides.profession) {
      profile.profession = overrides.profession;
    }
  }

  return profile;
}


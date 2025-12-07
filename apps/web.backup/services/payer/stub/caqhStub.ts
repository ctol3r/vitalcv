/**
 * B169C-PAYER-002: CAQH stub for demo + local development
 *
 * Provides a deterministic CAQH payload so the payer requirements UI can be exercised
 * without hitting the real CAQH ProView API.
 */

import type { CaqhProfile } from '../caqhClient.js';
import {
  buildCaqhFieldsFromProfile,
  parseCaqhProfileFields,
  type CaqhProfileFields,
} from '../models/CAQHProfile.js';

export interface DemoCaqhProfileSnapshot {
  clinicianId: string;
  caqhId: string;
  fetchedAt: string;
  fields: CaqhProfileFields;
}

const DEMO_CLINICIAN_ID = 'did:example:clinician-demo';
const DEMO_CAQH_ID = 'CAQH-DEMO-0001';

const baseCaqhProfile: CaqhProfile = {
  caqhId: DEMO_CAQH_ID,
  providerId: '1234567890',
  status: 'Active',
  lastUpdateDate: new Date().toISOString(),
  attestationDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  profile: {
    personalInfo: {
      firstName: 'Jordan',
      lastName: 'Harper',
      dateOfBirth: '1983-04-19',
      ssn: '****-4321',
    },
    licenses: [
      {
        licenseNumber: 'A123456',
        state: 'CA',
        licenseType: 'MD',
        issueDate: '2014-03-01',
        expirationDate: '2026-03-01',
        status: 'Active',
      },
      {
        licenseNumber: 'DEA8765432',
        state: 'FED',
        licenseType: 'DEA',
        issueDate: '2015-05-01',
        expirationDate: '2027-05-01',
        status: 'Active',
      },
    ],
    education: [
      {
        degree: 'MD',
        school: 'UC San Diego School of Medicine',
        graduationDate: '2011-06-01',
        specialty: 'Internal Medicine',
      },
      {
        degree: 'Residency',
        school: 'Stanford Health Residency',
        graduationDate: '2014-06-01',
        specialty: 'Internal Medicine',
      },
    ],
    boardCertifications: [
      {
        board: 'American Board of Internal Medicine',
        specialty: 'Internal Medicine',
        certificationNumber: 'ABIM-998877',
        issueDate: '2015-07-01',
        expirationDate: '2025-07-01',
        status: 'Active',
      },
    ],
    workHistory: [
      {
        facilityName: 'Bay Internal Medicine Group',
        startDate: '2018-01-01',
        position: 'Attending Physician',
      },
      {
        facilityName: 'Mission Primary Care',
        startDate: '2015-07-01',
        endDate: '2017-12-31',
        position: 'Hospitalist',
      },
    ],
    malpracticeInsurance: {
      carrier: 'Medical Protective',
      policyNumber: 'MP-123-456-789',
      coverageAmount: 2000000,
      expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
};

const demoFields: CaqhProfileFields = (() => {
  const built = buildCaqhFieldsFromProfile(baseCaqhProfile, DEMO_CLINICIAN_ID);
  const fallbackLocation = {
    name: 'Bay Internal Medicine Group',
    taxonomyCode: '207R00000X',
    phone: '(415) 555-0110',
    fax: '(415) 555-0199',
    startDate: '2018-01-01',
    address: {
      line1: '123 Market St',
      line2: 'Suite 400',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'US',
    },
  };

  return parseCaqhProfileFields({
    ...built,
    practiceLocations:
      built.practiceLocations.length > 0
        ? built.practiceLocations.map((loc, index) =>
            index === 0
              ? {
                  ...loc,
                  ...fallbackLocation,
                }
              : loc
          )
        : [fallbackLocation],
  });
})();

const DEMO_CAQH_PROFILE = {
  clinicianId: DEMO_CLINICIAN_ID,
  caqhId: DEMO_CAQH_ID,
  fields: demoFields,
} as const;

export function getDemoCaqhProfile(): DemoCaqhProfileSnapshot {
  return {
    clinicianId: DEMO_CAQH_PROFILE.clinicianId,
    caqhId: DEMO_CAQH_PROFILE.caqhId,
    fetchedAt: new Date().toISOString(),
    fields: parseCaqhProfileFields({
      ...DEMO_CAQH_PROFILE.fields,
      lastSyncedAt: new Date().toISOString(),
    }),
  };
}

export async function fetchDemoCaqhProfile(): Promise<DemoCaqhProfileSnapshot> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getDemoCaqhProfile();
}

/**
 * B169C-PAYER-002: CAQH stub used for payer enrollment demos
 *
 * Returns deterministic CAQH profile data so the payer requirements
 * API/UI can function without a live CAQH integration.
 */

import { MOCK_CAQH_PROFILE } from '../caqhClient.js';
import {
  mapCaqhProfileToFields,
  type CaqhProfileFields,
  type PracticeLocation,
  type SpecialtyField,
} from '../models/CAQHProfile.js';

export interface DemoCaqhProfile {
  clinicianId: string;
  caqhId: string;
  fields: CaqhProfileFields;
}

const DEMO_CLINICIAN_ID = 'did:example:clinician-demo';

const DEMO_SPECIALTIES: SpecialtyField[] = [
  {
    specialty: 'Internal Medicine',
    taxonomyCode: '207R00000X',
    primary: true,
    status: 'Active',
    effectiveDate: MOCK_CAQH_PROFILE.attestationDate,
    lastUpdatedAt: MOCK_CAQH_PROFILE.lastUpdateDate,
  },
  {
    specialty: 'Telehealth Primary Care',
    taxonomyCode: '390200000X',
    primary: false,
    status: 'Active',
    effectiveDate: MOCK_CAQH_PROFILE.attestationDate,
    lastUpdatedAt: MOCK_CAQH_PROFILE.lastUpdateDate,
  },
];

const DEMO_PRACTICE_LOCATIONS: PracticeLocation[] = [
  {
    facilityName: 'Sunrise Medical Group',
    address1: '123 Market Street',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    phoneNumber: '415-555-0199',
    startDate: '2018-04-01',
    currentlyPracticing: true,
  },
  {
    facilityName: 'Telehealth Home Office',
    address1: '200 Virtual Way',
    city: 'Los Angeles',
    state: 'CA',
    postalCode: '90012',
    phoneNumber: '213-555-0110',
    startDate: '2020-01-01',
    currentlyPracticing: true,
  },
];

/**
 * Returns a demo CAQH snapshot that mirrors the persisted DB format.
 */
export function getDemoCaqhProfile(): DemoCaqhProfile {
  const fields = mapCaqhProfileToFields(MOCK_CAQH_PROFILE, {
    clinicianId: DEMO_CLINICIAN_ID,
    syncedAt: new Date(),
    specialties: DEMO_SPECIALTIES,
    practiceLocations: DEMO_PRACTICE_LOCATIONS,
    metadata: {
      source: 'demo',
    },
  });

  return {
    clinicianId: DEMO_CLINICIAN_ID,
    caqhId: fields.caqhId,
    fields,
  };
}
/**
 * B169C-PAYER-002: CAQH stub for demo + payer enrollment prefill
 *
 * Provides a deterministic CAQH snapshot that mirrors the structure stored
 * in `CaqhProfile.fields`. Used by demo flows + unit tests.
 */

import { mapCaqhProfileToFields, type CaqhProfileFields } from '../models/CAQHProfile.js';
import { MOCK_CAQH_PROFILE } from '../caqhClient.js';

export interface StubCaqhProfile {
  clinicianId: string;
  caqhId: string;
  lastSyncedAt: string;
  fields: CaqhProfileFields;
}

const BASE_FIELDS = mapCaqhProfileToFields({
  ...MOCK_CAQH_PROFILE,
  profile: {
    ...MOCK_CAQH_PROFILE.profile,
    licenses: [
      ...MOCK_CAQH_PROFILE.profile.licenses,
      {
        licenseNumber: 'DEA1234567',
        state: 'FED',
        licenseType: 'DEA',
        issueDate: '2014-01-01',
        expirationDate: '2027-12-31',
        status: 'Active' as const,
      },
    ],
  },
});

const DEFAULT_STUB: StubCaqhProfile = {
  clinicianId: 'clinician-demo-001',
  caqhId: BASE_FIELDS.caqhId,
  lastSyncedAt: new Date().toISOString(),
  fields: BASE_FIELDS,
};

export function getDemoCaqhProfile(
  overrides?: Partial<Omit<StubCaqhProfile, 'fields'>> & { fields?: Partial<CaqhProfileFields> }
): StubCaqhProfile {
  const mergedFields = {
    ...DEFAULT_STUB.fields,
    ...(overrides?.fields || {}),
  };

  return {
    clinicianId: overrides?.clinicianId ?? DEFAULT_STUB.clinicianId,
    caqhId: overrides?.caqhId ?? DEFAULT_STUB.caqhId,
    lastSyncedAt: overrides?.lastSyncedAt ?? new Date().toISOString(),
    fields: mergedFields,
  };
}


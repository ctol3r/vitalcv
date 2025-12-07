/**
 * B139A-FHIR-011: International Provider Directory Normalization
 *
 * Adapters for:
 * - US NPPES (National Plan and Provider Enumeration System)
 * - Canada NOC (National Occupational Classification)
 * - Australia AHPRA (Australian Health Practitioner Regulation Agency)
 *
 * Normalizes to FHIR R4 Practitioner resource
 */

/**
 * Source registry enum
 */
export enum ProviderRegistry {
  US_NPPES = 'US_NPPES',
  CA_NOC = 'CA_NOC',
  AU_AHPRA = 'AU_AHPRA',
}

/**
 * FHIR R4 Practitioner (simplified)
 */
export interface FhirPractitioner {
  resourceType: 'Practitioner';
  id: string;
  identifier: Array<{
    system: string;
    value: string;
    type?: { coding?: Array<{ system: string; code: string }> };
  }>;
  name: Array<{
    family: string;
    given: string[];
    prefix?: string[];
    suffix?: string[];
  }>;
  telecom?: Array<{
    system: 'phone' | 'email' | 'fax';
    value: string;
  }>;
  address?: Array<{
    line: string[];
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  }>;
  qualification: Array<{
    code: { coding: Array<{ system: string; code: string; display: string }> };
    issuer?: { display: string };
  }>;
  meta?: {
    source: string;
    lastUpdated: string;
  };
}

/**
 * US NPPES record (simplified)
 */
export interface NppesRecord {
  npi: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  credential?: string;
  taxonomy: string;
  taxonomyDescription: string;
  licenseNumber?: string;
  licenseState?: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  phone?: string;
}

/**
 * Canada NOC record (simplified)
 */
export interface NocRecord {
  providerId: string;
  firstName: string;
  lastName: string;
  nocCode: string; // e.g., "3111" for general practitioners
  nocTitle: string;
  province: string;
  registrationNumber: string;
  registrationBody: string;
  postalCode?: string;
}

/**
 * Australia AHPRA record (simplified)
 */
export interface AhpraRecord {
  ahpraNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  profession: string; // e.g., "Medical Practitioner"
  specialty?: string;
  registrationType: string;
  state: string;
  registrationExpiry: string;
}

/**
 * Adapt US NPPES record to FHIR Practitioner
 */
export function adaptNppesToFhir(nppes: NppesRecord): FhirPractitioner {
  return {
    resourceType: 'Practitioner',
    id: `nppes-${nppes.npi}`,
    identifier: [
      {
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: nppes.npi,
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'NPI',
            },
          ],
        },
      },
      ...(nppes.licenseNumber && nppes.licenseState
        ? [
            {
              system: `urn:oid:2.16.840.1.113883.4.6.${nppes.licenseState}`,
              value: nppes.licenseNumber,
            },
          ]
        : []),
    ],
    name: [
      {
        family: nppes.lastName,
        given: [nppes.firstName, ...(nppes.middleName ? [nppes.middleName] : [])],
        ...(nppes.credential ? { suffix: [nppes.credential] } : {}),
      },
    ],
    ...(nppes.phone ? { telecom: [{ system: 'phone' as const, value: nppes.phone }] } : {}),
    address: [
      {
        line: [nppes.address1],
        city: nppes.city,
        state: nppes.state,
        postalCode: nppes.postalCode,
        country: 'USA',
      },
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://nucc.org/provider-taxonomy',
              code: nppes.taxonomy,
              display: nppes.taxonomyDescription,
            },
          ],
        },
      },
    ],
    meta: {
      source: 'US_NPPES',
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Adapt Canada NOC record to FHIR Practitioner
 */
export function adaptNocToFhir(noc: NocRecord): FhirPractitioner {
  return {
    resourceType: 'Practitioner',
    id: `noc-${noc.providerId}`,
    identifier: [
      {
        system: `urn:oid:2.16.840.1.113883.3.277.${noc.province}`, // Canadian province OID
        value: noc.registrationNumber,
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MD', // Medical License number
            },
          ],
        },
      },
    ],
    name: [
      {
        family: noc.lastName,
        given: [noc.firstName],
      },
    ],
    address: noc.postalCode
      ? [
          {
            line: [],
            city: '',
            postalCode: noc.postalCode,
            state: noc.province,
            country: 'CAN',
          },
        ]
      : undefined,
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'https://noc.esdc.gc.ca/',
              code: noc.nocCode,
              display: noc.nocTitle,
            },
          ],
        },
        issuer: {
          display: noc.registrationBody,
        },
      },
    ],
    meta: {
      source: 'CA_NOC',
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Adapt Australia AHPRA record to FHIR Practitioner
 */
export function adaptAhpraToFhir(ahpra: AhpraRecord): FhirPractitioner {
  return {
    resourceType: 'Practitioner',
    id: `ahpra-${ahpra.ahpraNumber}`,
    identifier: [
      {
        system: 'http://ns.electronichealth.net.au/id/hi/hpii/1.0',
        value: ahpra.ahpraNumber,
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'AHPRA',
            },
          ],
        },
      },
    ],
    name: [
      {
        family: ahpra.lastName,
        given: [ahpra.firstName, ...(ahpra.middleName ? [ahpra.middleName] : [])],
      },
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx',
              code: ahpra.profession.replace(/\s+/g, '_').toLowerCase(),
              display: ahpra.profession,
            },
          ],
        },
      },
      ...(ahpra.specialty
        ? [
            {
              code: {
                coding: [
                  {
                    system: 'https://www.ahpra.gov.au',
                    code: ahpra.specialty.replace(/\s+/g, '_').toLowerCase(),
                    display: ahpra.specialty,
                  },
                ],
              },
            },
          ]
        : []),
    ],
    meta: {
      source: 'AU_AHPRA',
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Generic adapter - routes to appropriate adapter based on registry
 */
export function adaptToFhir(
  record: NppesRecord | NocRecord | AhpraRecord,
  registry: ProviderRegistry
): FhirPractitioner {
  switch (registry) {
    case ProviderRegistry.US_NPPES:
      return adaptNppesToFhir(record as NppesRecord);
    case ProviderRegistry.CA_NOC:
      return adaptNocToFhir(record as NocRecord);
    case ProviderRegistry.AU_AHPRA:
      return adaptAhpraToFhir(record as AhpraRecord);
    default:
      throw new Error(`Unknown registry: ${registry}`);
  }
}

/**
 * Batch adapt multiple records
 */
export function batchAdaptToFhir(
  records: Array<{ data: NppesRecord | NocRecord | AhpraRecord; registry: ProviderRegistry }>
): FhirPractitioner[] {
  return records.map(({ data, registry }) => adaptToFhir(data, registry));
}


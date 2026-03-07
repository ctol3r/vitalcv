/**
 * fhirExporter.ts — Wave 120: FHIR R4 Export Hardening
 *
 * Exports clinician data as FHIR R4 resources:
 *   - Practitioner (NPI, name, identifiers, qualifications)
 *   - PractitionerRole (taxonomy, organization, location)
 *   - Qualification (licenses, certifications, board certs)
 *
 * Conforms to US Core 6.1 profiles where applicable.
 */

import { createHash } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

interface ProviderData {
  npi: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  credential?: string;
  gender?: string;
  organization?: string;
  taxonomies?: Array<{
    code: string;
    description: string;
    primary: boolean;
    state?: string;
    license?: string;
  }>;
  addresses?: Array<{
    purpose: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    phone?: string;
  }>;
  credentials?: Array<{
    credentialId: string;
    type: string;
    issuer: string;
    status: string;
    issuedAt?: string;
    expiresAt?: string;
    licenseNumber?: string;
    state?: string;
  }>;
  trustBand?: string;
}

interface FHIRIdentifier {
  system: string;
  value: string;
  type?: { coding: Array<{ system: string; code: string; display: string }> };
}

interface FHIRQualification {
  identifier?: FHIRIdentifier[];
  code: { coding: Array<{ system: string; code: string; display: string }>; text: string };
  period?: { start?: string; end?: string };
  issuer?: { display: string };
}

interface FHIRPractitioner {
  resourceType: 'Practitioner';
  id: string;
  meta: { profile: string[]; lastUpdated: string };
  identifier: FHIRIdentifier[];
  active: boolean;
  name: Array<{
    use: string;
    family: string;
    given: string[];
    suffix?: string[];
  }>;
  gender?: string;
  qualification: FHIRQualification[];
  extension: Array<{ url: string; valueString?: string; valueCoding?: unknown }>;
}

interface FHIRPractitionerRole {
  resourceType: 'PractitionerRole';
  id: string;
  meta: { profile: string[] };
  active: boolean;
  practitioner: { reference: string; display: string };
  code: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  specialty: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  location?: Array<{ display: string }>;
}

interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'collection';
  timestamp: string;
  total: number;
  entry: Array<{
    fullUrl: string;
    resource: FHIRPractitioner | FHIRPractitionerRole;
  }>;
  meta: {
    tag: Array<{ system: string; code: string; display: string }>;
  };
}

// ── Constants ─────────────────────────────────────────────────────────

const FHIR_NPI_SYSTEM = 'http://hl7.org/fhir/sid/us-npi';
const VITALCV_SYSTEM = 'https://vitalcv.io/fhir';
const TAXONOMY_SYSTEM = 'http://nucc.org/provider-taxonomy';
const US_CORE_PRACTITIONER = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner';
const US_CORE_PRACTITIONER_ROLE = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitionerrole';

// ── Mapping ───────────────────────────────────────────────────────────

function mapGender(g: string | undefined): string | undefined {
  if (!g) return undefined;
  const map: Record<string, string> = { M: 'male', F: 'female', m: 'male', f: 'female', male: 'male', female: 'female' };
  return map[g] ?? 'unknown';
}

function mapQualifications(data: ProviderData): FHIRQualification[] {
  const quals: FHIRQualification[] = [];

  // From credentials
  for (const cred of data.credentials ?? []) {
    quals.push({
      identifier: cred.licenseNumber ? [{
        system: `${VITALCV_SYSTEM}/license`,
        value: cred.licenseNumber,
      }] : undefined,
      code: {
        coding: [{
          system: `${VITALCV_SYSTEM}/credential-type`,
          code: cred.type,
          display: cred.type.replace(/([A-Z])/g, ' $1').trim(),
        }],
        text: `${cred.type}${cred.state ? ` (${cred.state})` : ''}`,
      },
      period: {
        start: cred.issuedAt,
        end: cred.expiresAt,
      },
      issuer: { display: cred.issuer },
    });
  }

  // From taxonomies (licenses)
  for (const tax of data.taxonomies ?? []) {
    if (tax.license) {
      quals.push({
        identifier: [{
          system: `${VITALCV_SYSTEM}/taxonomy-license`,
          value: tax.license,
        }],
        code: {
          coding: [{
            system: TAXONOMY_SYSTEM,
            code: tax.code,
            display: tax.description,
          }],
          text: `${tax.description}${tax.state ? ` — ${tax.state}` : ''}`,
        },
      });
    }
  }

  return quals;
}

// ── Export ─────────────────────────────────────────────────────────────

/**
 * Export a provider as a FHIR R4 Bundle containing Practitioner + PractitionerRole.
 */
export function exportProviderAsFHIR(data: ProviderData): FHIRBundle {
  const now = new Date().toISOString();
  const displayName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');

  const practitioner: FHIRPractitioner = {
    resourceType: 'Practitioner',
    id: data.npi,
    meta: {
      profile: [US_CORE_PRACTITIONER],
      lastUpdated: now,
    },
    identifier: [
      {
        system: FHIR_NPI_SYSTEM,
        value: data.npi,
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'NPI',
            display: 'National Provider Identifier',
          }],
        },
      },
    ],
    active: true,
    name: [{
      use: 'official',
      family: data.lastName ?? '',
      given: [data.firstName, data.middleName].filter(Boolean) as string[],
      suffix: data.credential ? [data.credential] : undefined,
    }],
    gender: mapGender(data.gender),
    qualification: mapQualifications(data),
    extension: [
      {
        url: `${VITALCV_SYSTEM}/StructureDefinition/trust-band`,
        valueString: data.trustBand ?? 'UNKNOWN',
      },
      {
        url: `${VITALCV_SYSTEM}/StructureDefinition/bundle-hash`,
        valueString: createHash('sha256')
          .update(JSON.stringify({ npi: data.npi, name: displayName }))
          .digest('hex'),
      },
    ],
  };

  // PractitionerRole from taxonomies
  const roles: FHIRPractitionerRole[] = (data.taxonomies ?? [])
    .filter((t) => t.primary)
    .map((tax, idx) => ({
      resourceType: 'PractitionerRole' as const,
      id: `${data.npi}-role-${idx}`,
      meta: { profile: [US_CORE_PRACTITIONER_ROLE] },
      active: true,
      practitioner: {
        reference: `Practitioner/${data.npi}`,
        display: displayName,
      },
      code: [{
        coding: [{
          system: TAXONOMY_SYSTEM,
          code: tax.code,
          display: tax.description,
        }],
      }],
      specialty: [{
        coding: [{
          system: TAXONOMY_SYSTEM,
          code: tax.code,
          display: tax.description,
        }],
      }],
      location: tax.state ? [{ display: tax.state }] : undefined,
    }));

  const entries = [
    {
      fullUrl: `urn:uuid:${data.npi}`,
      resource: practitioner as FHIRPractitioner | FHIRPractitionerRole,
    },
    ...roles.map((r) => ({
      fullUrl: `urn:uuid:${r.id}`,
      resource: r as FHIRPractitioner | FHIRPractitionerRole,
    })),
  ];

  const bundle: FHIRBundle = {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: now,
    total: entries.length,
    entry: entries,
    meta: {
      tag: [{
        system: `${VITALCV_SYSTEM}/export`,
        code: 'fhir-r4',
        display: 'VitalCV FHIR R4 Export',
      }],
    },
  };

  log('info', 'fhir_exporter: bundle generated', {
    npi: data.npi,
    resources: entries.length,
    qualifications: practitioner.qualification.length,
  });

  return bundle;
}

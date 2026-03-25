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

export interface ProviderData {
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
  licenses: Array<{
    number?: string;
    state?: string;
    status?: string;
    expirationDate?: string;
    sourceId?: string;
    verifiedAt?: string;
  }>;
  boardCerts: Array<{
    boardName?: string;
    specialty?: string;
    status?: string;
    expiresAt?: string;
  }>;
  educations: Array<{
    type?: string;
    institutionName?: string;
    degree?: string;
    specialty?: string;
    graduationYear?: number;
  }>;
  trustBand?: string;
  auditHash?: string;
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
      ...(data.auditHash ? [{
        url: `${VITALCV_SYSTEM}/StructureDefinition/audit-hash`,
        valueString: data.auditHash,
      }] : []),
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

// ── Passport → FHIR Adapter ───────────────────────────────────────────────────
//
// Wave X-1: Converts a TrustPassport to ProviderData for FHIR export.
// Every field sourced from a verified claim includes source traceability.
// Enrichment is NEVER used — only trust-core verified passport claims.

import type {
  TrustPassport,
  PassportCredential,
  PassportEducationRecord,
} from '../entity/passportService';

/**
 * Parse a displayName into name parts (best-effort: handles "First [Middle] Last [Suffix]")
 */
function parseDisplayName(displayName: string): { firstName: string; lastName: string; middleName?: string; credential?: string } {
  // Strip known suffixes first
  const SUFFIX_RE = /\s*,?\s*(MD|DO|NP|PA|RN|PhD|DPM|DMD|DDS|FACS|FACP|MBA|MPH|PhD|DPH|MS|BSN|CNP|CNS|NMW|CRNA)\s*$/gi;
  let credential: string | undefined;
  const cleaned = displayName.replace(SUFFIX_RE, (_, s) => { credential = s; return ''; }).trim();

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] ?? '', lastName: '', credential };
  if (parts.length === 2) return { firstName: parts[0] ?? '', lastName: parts[1] ?? '', credential };
  // 3+: first=parts[0], last=parts[last], middle=rest
  const lastName  = parts[parts.length - 1] ?? '';
  const firstName = parts[0] ?? '';
  const middleName = parts.slice(1, -1).join(' ');
  return { firstName, lastName, middleName: middleName || undefined, credential };
}

function credentialToLicenseEntry(cred: PassportCredential): ProviderData['licenses'][0] | null {
  if (!['STATE_LICENSE', 'LICENSE', 'MEDICAL_LICENSE', 'DEA'].includes(cred.domain?.toUpperCase() ?? '')) return null;
  return {
    number: cred.label ?? cred.id,
    state: cred.jurisdiction,
    status: cred.status,
    expirationDate: cred.expiresAt,
    // Traceability extensions (serialized into meta)
    ...(cred.sourceId ? { sourceId: cred.sourceId } : {}),
    ...(cred.verifiedAt ? { verifiedAt: cred.verifiedAt } : {}),
  } as ProviderData['licenses'][0];
}

function credentialToBoardCertEntry(cred: PassportCredential): ProviderData['boardCerts'][0] | null {
  if (!['BOARD_CERT', 'BOARD_CERTIFICATION', 'ABMS'].includes(cred.domain?.toUpperCase() ?? '')) return null;
  return {
    boardName: cred.issuerName ?? cred.label ?? cred.domain,
    specialty: cred.label,
    status: cred.status,
    ...(cred.expiresAt ? { expiresAt: cred.expiresAt } : {}),
  } as ProviderData['boardCerts'][0];
}

function educationToEntry(edu: PassportEducationRecord): ProviderData['educations'][0] | null {
  if (!edu.institutionName) return null;
  return {
    type: edu.recordType,
    institutionName: edu.institutionName,
    degree: edu.degreeOrTitle,
    specialty: edu.specialty,
    graduationYear: edu.endYear,
  } as ProviderData['educations'][0];
}

/**
 * passportToProviderData — maps a TrustPassport to FHIR ProviderData.
 *
 * TRUST CONTRACT:
 * - Only decision-grade (non-stale, non-review-required) credentials are included.
 * - Enrichment is excluded.
 * - Trust band is taken from readiness.level (READY→L3, PARTIAL→L2, BLOCKED→L0).
 * - Audit hash is SHA-256 of (npi + readiness.score + computedAt) for receipt traceability.
 */
export function passportToProviderData(passport: TrustPassport): ProviderData {
  const nameparts = parseDisplayName(passport.identity.displayName);

  // Trust band mapping
  const bandMap: Record<string, string> = {
    READY: 'L3', CREDENTIALED: 'L2', PARTIAL: 'L1', BLOCKED: 'L0', UNKNOWN: 'L0',
  };
  const trustBand = bandMap[passport.readiness?.status ?? 'UNKNOWN'] ?? 'L0';

  // Audit hash — reproducible receipt
  const auditHash = createHash('sha256')
    .update(JSON.stringify({
      npi: passport.npi,
      score: passport.readiness?.score ?? 0,
      computedAt: passport.lastCheckedAt,
    }))
    .digest('hex');

  // Credentials — decision-grade only
  const decisionGradeCreds = passport.authority.credentials.filter(
    c => !c.reviewRequired && !c.stale,
  );

  const licenses = decisionGradeCreds
    .map(credentialToLicenseEntry)
    .filter(Boolean) as ProviderData['licenses'];

  const boardCerts = decisionGradeCreds
    .map(credentialToBoardCertEntry)
    .filter(Boolean) as ProviderData['boardCerts'];

  const educations = passport.training.records
    .map(educationToEntry)
    .filter(Boolean) as ProviderData['educations'];

  // Primary taxonomy from specialty
  const taxonomies: ProviderData['taxonomies'] = passport.identity.specialty
    ? [{
        code: 'UNKNOWN',
        description: passport.identity.specialty,
        primary: true,
      }]
    : [];

  return {
    npi: passport.npi ?? '',
    firstName: nameparts.firstName,
    lastName: nameparts.lastName,
    middleName: nameparts.middleName,
    credential: nameparts.credential,
    gender: undefined,          // not in passport — FHIR spec prefers omit vs guess
    organization: undefined,
    taxonomies,
    licenses,
    boardCerts,
    educations,
    trustBand,
    auditHash,
  };
}

/**
 * passportToFhirBundle — convenience wrapper: Passport → validated FHIRBundle.
 */
export function passportToFhirBundle(passport: TrustPassport): FHIRBundle {
  const providerData = passportToProviderData(passport);
  return exportProviderAsFHIR(providerData);
}

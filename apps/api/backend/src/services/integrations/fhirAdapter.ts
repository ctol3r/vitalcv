/**
 * fhirAdapter.ts — Wave 65: FHIR Interoperability Layer
 *
 * Maps VitalCV trust artifacts to FHIR R4 resources:
 *   - Practitioner
 *   - PractitionerRole
 *   - Qualification
 *
 * Allows hospital systems to ingest credentials directly.
 */

// ── FHIR Types (R4 subset) ───────────────────────────────────────────────

interface FhirIdentifier {
  system: string;
  value: string;
}

interface FhirCodeableConcept {
  coding: Array<{ system: string; code: string; display: string }>;
  text?: string;
}

interface FhirPeriod {
  start?: string;
  end?: string;
}

interface FhirQualification {
  identifier?: FhirIdentifier[];
  code: FhirCodeableConcept;
  period?: FhirPeriod;
  issuer?: { display: string };
}

interface FhirPractitioner {
  resourceType: 'Practitioner';
  id: string;
  identifier: FhirIdentifier[];
  active: boolean;
  name?: Array<{ text: string }>;
  qualification: FhirQualification[];
  meta: { lastUpdated: string; source: string };
}

interface FhirPractitionerRole {
  resourceType: 'PractitionerRole';
  id: string;
  active: boolean;
  practitioner: { reference: string; display?: string };
  organization?: { reference: string; display: string };
  code: FhirCodeableConcept[];
  specialty?: FhirCodeableConcept[];
  period?: FhirPeriod;
}

// ── VitalCV Input Types ───────────────────────────────────────────────────

interface TrustArtifact {
  npi: string;
  clinicianName?: string;
  specialty?: string;
  credentials: Array<{
    id: string;
    source: string;
    status: string;
    verifiedAt: string;
    expiresAt: string | null;
    issuer?: string;
  }>;
  crsScore: number;
  crsBand: string;
  employerAssociations?: Array<{
    organizationName: string;
    role: string;
    startDate: string;
  }>;
}

// ── Mapping Functions ─────────────────────────────────────────────────────

const CREDENTIAL_CODE_MAP: Record<string, { system: string; code: string }> = {
  'medical license': { system: 'http://terminology.hl7.org/CodeSystem/v2-0360', code: 'MD' },
  'dea': { system: 'http://terminology.hl7.org/CodeSystem/v2-0360', code: 'DEA' },
  'board cert': { system: 'http://terminology.hl7.org/CodeSystem/v2-0360', code: 'BC' },
  'hospital privileges': { system: 'http://terminology.hl7.org/CodeSystem/v2-0360', code: 'HP' },
};

function mapCredentialCode(source: string): FhirCodeableConcept {
  const lower = source.toLowerCase();
  for (const [key, val] of Object.entries(CREDENTIAL_CODE_MAP)) {
    if (lower.includes(key)) {
      return {
        coding: [{ system: val.system, code: val.code, display: source }],
        text: source,
      };
    }
  }
  return {
    coding: [{ system: 'http://vitalcv.com/credential-type', code: 'OTHER', display: source }],
    text: source,
  };
}

// ── Public API ────────────────────────────────────────────────────────────

export function toFhirPractitioner(artifact: TrustArtifact): FhirPractitioner {
  const qualifications: FhirQualification[] = artifact.credentials.map((cred) => ({
    identifier: [{ system: 'http://vitalcv.com/credential', value: cred.id }],
    code: mapCredentialCode(cred.source),
    period: {
      start: cred.verifiedAt,
      end: cred.expiresAt ?? undefined,
    },
    issuer: cred.issuer ? { display: cred.issuer } : undefined,
  }));

  return {
    resourceType: 'Practitioner',
    id: `vitalcv-${artifact.npi}`,
    identifier: [
      { system: 'http://hl7.org/fhir/sid/us-npi', value: artifact.npi },
      { system: 'http://vitalcv.com/crs', value: `${artifact.crsScore}/${artifact.crsBand}` },
    ],
    active: artifact.crsBand !== 'RED',
    name: artifact.clinicianName ? [{ text: artifact.clinicianName }] : undefined,
    qualification: qualifications,
    meta: {
      lastUpdated: new Date().toISOString(),
      source: 'http://vitalcv.com',
    },
  };
}

export function toFhirPractitionerRoles(artifact: TrustArtifact): FhirPractitionerRole[] {
  if (!artifact.employerAssociations) return [];

  return artifact.employerAssociations.map((assoc, i) => ({
    resourceType: 'PractitionerRole' as const,
    id: `vitalcv-role-${artifact.npi}-${i}`,
    active: true,
    practitioner: {
      reference: `Practitioner/vitalcv-${artifact.npi}`,
      display: artifact.clinicianName,
    },
    organization: {
      reference: `Organization/${assoc.organizationName.toLowerCase().replace(/\s+/g, '-')}`,
      display: assoc.organizationName,
    },
    code: [{
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/practitioner-role', code: 'doctor', display: assoc.role }],
    }],
    specialty: artifact.specialty ? [{
      coding: [{ system: 'http://snomed.info/sct', code: '394802001', display: artifact.specialty }],
    }] : undefined,
    period: { start: assoc.startDate },
  }));
}

export function toFhirBundle(artifact: TrustArtifact): Record<string, unknown> {
  const practitioner = toFhirPractitioner(artifact);
  const roles = toFhirPractitionerRoles(artifact);

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      { resource: practitioner, fullUrl: `urn:uuid:${practitioner.id}` },
      ...roles.map((role) => ({ resource: role, fullUrl: `urn:uuid:${role.id}` })),
    ],
  };
}

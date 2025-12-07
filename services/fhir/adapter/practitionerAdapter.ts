import { PractitionerResource, FhirAddress, FhirContactPoint, FhirIdentifier, FhirQualification } from '../types/r6';

const NPI_SYSTEM = 'urn:oid:2.16.840.1.113883.4.6';
const DEFAULT_SPECIALTY_SYSTEM = 'http://nucc.org/provider-taxonomy';

export interface ClinicianIdentifier {
  system: string;
  value: string;
}

export interface ClinicianContact {
  email: string;
  phone?: string;
}

export interface ClinicianAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ClinicianSpecialty {
  code: string;
  display?: string;
  system?: string;
  issuer?: string;
}

export interface InternalClinician {
  id: string;
  npi?: string;
  name: {
    first: string;
    last: string;
    middle?: string[];
    prefix?: string[];
    suffix?: string[];
  };
  contact: ClinicianContact;
  identifiers?: ClinicianIdentifier[];
  addresses?: ClinicianAddress[];
  specialties?: ClinicianSpecialty[];
  qualifications?: ClinicianSpecialty[];
  active?: boolean;
}

function buildIdentifierSet(clinician: InternalClinician): FhirIdentifier[] {
  const identifiers: FhirIdentifier[] = [];
  const seen = new Set<string>();

  if (clinician.npi) {
    const key = `${NPI_SYSTEM}:${clinician.npi}`;
    seen.add(key);
    identifiers.push({
      system: NPI_SYSTEM,
      value: clinician.npi,
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'NPI',
          display: 'National Provider Identifier',
        }],
      },
    });
  }

  for (const identifier of clinician.identifiers ?? []) {
    const key = `${identifier.system}:${identifier.value}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    identifiers.push({
      system: identifier.system,
      value: identifier.value,
    });
  }

  if (identifiers.length === 0) {
    throw new Error('Clinician must have at least one identifier (NPI preferred)');
  }

  return identifiers;
}

function toAddress(address: ClinicianAddress): FhirAddress {
  const line: string[] = [];
  if (address.line1) line.push(address.line1);
  if (address.line2) line.push(address.line2);

  return {
    line: line.length ? line : undefined,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country ?? 'USA',
  };
}

function buildTelecom(contact: ClinicianContact): FhirContactPoint[] {
  const telecom: FhirContactPoint[] = [
    {
      system: 'email',
      value: contact.email,
      use: 'work',
    },
  ];

  if (contact.phone) {
    telecom.push({
      system: 'phone',
      value: contact.phone,
      use: 'work',
    });
  }

  return telecom;
}

function buildQualifications(clinician: InternalClinician): FhirQualification[] {
  const qualifications: FhirQualification[] = [];

  for (const qualification of clinician.qualifications ?? []) {
    qualifications.push({
      code: {
        coding: [{
          system: qualification.system ?? DEFAULT_SPECIALTY_SYSTEM,
          code: qualification.code,
          display: qualification.display ?? qualification.code,
        }],
      },
      issuer: qualification.issuer ? { display: qualification.issuer } : undefined,
    });
  }

  for (const specialty of clinician.specialties ?? []) {
    qualifications.push({
      code: {
        coding: [{
          system: specialty.system ?? DEFAULT_SPECIALTY_SYSTEM,
          code: specialty.code,
          display: specialty.display ?? specialty.code,
        }],
      },
    });
  }

  if (qualifications.length === 0) {
    throw new Error('Clinician must have at least one specialty or qualification');
  }

  return qualifications;
}

export function clinicianToPractitioner(clinician: InternalClinician): PractitionerResource {
  const identifier = buildIdentifierSet(clinician);
  const telecom = buildTelecom(clinician.contact);
  const addresses = (clinician.addresses ?? []).map(toAddress).filter(address =>
    address.line || address.city || address.state || address.postalCode || address.country
  );

  if (addresses.length === 0) {
    throw new Error('Clinician must include at least one address');
  }

  const given = [
    clinician.name.first,
    ...(clinician.name.middle ?? []),
  ].filter(Boolean);

  if (!clinician.name.last || given.length === 0) {
    throw new Error('Clinician name must include first and last values');
  }

  const qualification = buildQualifications(clinician);

  return {
    resourceType: 'Practitioner',
    id: clinician.id,
    active: clinician.active ?? true,
    identifier,
    name: [{
      use: 'official',
      family: clinician.name.last,
      given,
      prefix: clinician.name.prefix?.length ? clinician.name.prefix : undefined,
      suffix: clinician.name.suffix?.length ? clinician.name.suffix : undefined,
    }],
    telecom,
    address: addresses,
    qualification,
  };
}



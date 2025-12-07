import type {
  PractitionerResource,
  FhirAddress,
  FhirContactPoint,
  FhirIdentifier,
  FhirQualification,
} from '../../../../../services/fhir/types/r6';

const NPI_SYSTEM = 'urn:oid:2.16.840.1.113883.4.6';
const TAXONOMY_SYSTEM = 'http://nucc.org/provider-taxonomy';

export interface PractitionerMapperInput {
  id: string;
  npi: string;
  active?: boolean;
  name: {
    first: string;
    last: string;
    middle?: string[];
    prefix?: string[];
    suffix?: string[];
  };
  telecom?: {
    email?: string;
    phone?: string;
  };
  addresses?: Array<{
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  specialties?: Array<{
    code: string;
    display?: string;
  }>;
  qualifications?: Array<{
    code: string;
    display?: string;
    issuer?: string;
  }>;
}

export function mapPractitioner(input: PractitionerMapperInput): PractitionerResource {
  const identifier: FhirIdentifier[] = [
    {
      system: NPI_SYSTEM,
      value: input.npi,
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'NPI',
            display: 'National Provider Identifier',
          },
        ],
      },
    },
  ];

  const telecom: FhirContactPoint[] = [];
  if (input.telecom?.email) {
    telecom.push({ system: 'email', value: input.telecom.email, use: 'work' });
  }
  if (input.telecom?.phone) {
    telecom.push({ system: 'phone', value: input.telecom.phone, use: 'work' });
  }

  const address: FhirAddress[] =
    input.addresses?.map((addr) => ({
      line: [addr.line1, addr.line2].filter(Boolean) as string[],
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country ?? 'USA',
    })) ?? [];

  const qualification = buildQualifications(input);

  return {
    resourceType: 'Practitioner',
    id: input.id,
    active: input.active ?? true,
    identifier,
    name: [
      {
        use: 'official',
        family: input.name.last,
        given: [input.name.first, ...(input.name.middle ?? [])].filter(Boolean),
        prefix: input.name.prefix,
        suffix: input.name.suffix,
      },
    ],
    telecom: telecom.length ? telecom : undefined,
    address: address.length ? address : undefined,
    qualification: qualification.length ? qualification : undefined,
  };
}

function buildQualifications(input: PractitionerMapperInput): FhirQualification[] {
  const qualifications: FhirQualification[] = [];

  for (const specialty of input.specialties ?? []) {
    qualifications.push({
      code: {
        coding: [
          {
            system: TAXONOMY_SYSTEM,
            code: specialty.code,
            display: specialty.display ?? specialty.code,
          },
        ],
      },
    });
  }

  for (const qual of input.qualifications ?? []) {
    qualifications.push({
      code: {
        coding: [
          {
            system: TAXONOMY_SYSTEM,
            code: qual.code,
            display: qual.display ?? qual.code,
          },
        ],
      },
      issuer: qual.issuer ? { display: qual.issuer } : undefined,
    });
  }

  return qualifications;
}











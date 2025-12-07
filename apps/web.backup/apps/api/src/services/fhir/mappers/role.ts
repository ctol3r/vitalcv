import type {
  PractitionerRoleResource,
  FhirCodeableConcept,
  FhirIdentifier,
  FhirReference,
} from '../../../../../services/fhir/types/r6';

const ROLE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/practitioner-role';
const SPECIALTY_SYSTEM = 'http://nucc.org/provider-taxonomy';
const COMPACT_EXTENSION =
  'https://vitalcv.health/fhir/StructureDefinition/compact-eligibility';
const MATCH_SUITABILITY_EXTENSION =
  'https://vitalcv.health/fhir/StructureDefinition/match-suitability';

export interface PractitionerRoleMapperInput {
  id: string;
  practitionerId?: string;
  organization: {
    id: string;
    name?: string;
  };
  specialty: {
    code: string;
    display?: string;
  };
  modality?: 'in-person' | 'telehealth' | 'hybrid';
  active?: boolean;
  locations?: Array<{
    state?: string;
    display?: string;
  }>;
  compactEligible?: boolean;
  identifier?: FhirIdentifier[];
  telecom?: Array<{
    system: 'phone' | 'email' | 'url';
    value: string;
    use?: 'work' | 'home';
  }>;
  matchSuitability?: {
    score: number;
    method?: string;
    generatedAt?: string;
    rationale?: string[];
  };
}

export function mapPractitionerRole(input: PractitionerRoleMapperInput): PractitionerRoleResource {
  const specialty = buildSpecialty(input.specialty);
  const code = buildRoleCode(input.specialty);
  const location = buildLocations(input.locations);
  const practitionerRef = input.practitionerId
    ? { reference: `Practitioner/${input.practitionerId}` }
    : undefined;

  return {
    resourceType: 'PractitionerRole',
    id: input.id,
    active: input.active ?? true,
    practitioner: practitionerRef,
    organization: buildOrganizationReference(input.organization),
    specialty,
    code,
    location,
    telecom: input.telecom,
    identifier: input.identifier,
    extension: buildExtensions(input),
  };
}

function buildSpecialty(specialty: PractitionerRoleMapperInput['specialty']): FhirCodeableConcept[] {
  return [
    {
      coding: [
        {
          system: SPECIALTY_SYSTEM,
          code: specialty.code,
          display: specialty.display ?? specialty.code,
        },
      ],
    },
  ];
}

function buildRoleCode(specialty: PractitionerRoleMapperInput['specialty']): FhirCodeableConcept[] {
  const normalized = specialty.display ?? specialty.code;
  const codeValue = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return [
    {
      coding: [
        {
          system: ROLE_SYSTEM,
          code: codeValue,
          display: normalized,
        },
      ],
      text: normalized,
    },
  ];
}

function buildOrganizationReference(org: PractitionerRoleMapperInput['organization']): FhirReference {
  return {
    reference: `Organization/${org.id}`,
    display: org.name ?? org.id,
  };
}

function buildLocations(
  locations: PractitionerRoleMapperInput['locations'],
): FhirReference[] | undefined {
  if (!locations?.length) {
    return undefined;
  }
  return locations.map((location) => ({
    reference: location.state ? `Location/${location.state}` : 'Location/virtual',
    display: location.display ?? location.state ?? 'Virtual',
  }));
}

function buildExtensions(input: PractitionerRoleMapperInput) {
  const extensions: Array<Record<string, unknown>> = [
    {
      url: COMPACT_EXTENSION,
      valueBoolean: Boolean(input.compactEligible),
    },
  ];

  if (input.matchSuitability) {
    extensions.push(buildSuitabilityExtension(input.matchSuitability));
  }

  return extensions;
}

function buildSuitabilityExtension(
  suitability: NonNullable<PractitionerRoleMapperInput['matchSuitability']>,
) {
  const rationaleExtensions =
    suitability.rationale?.slice(0, 3).map((note) => ({
      url: 'note',
      valueString: note,
    })) ?? [];

  return {
    url: MATCH_SUITABILITY_EXTENSION,
    extension: [
      {
        url: 'score',
        valueDecimal: Number(suitability.score.toFixed(3)),
      },
      {
        url: 'method',
        valueString: suitability.method ?? 'multi-signal-v5',
      },
      {
        url: 'generatedAt',
        valueDateTime: suitability.generatedAt ?? new Date().toISOString(),
      },
      ...rationaleExtensions,
    ],
  };
}


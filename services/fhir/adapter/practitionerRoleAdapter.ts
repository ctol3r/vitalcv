import { PractitionerRoleResource, FhirCodeableConcept, FhirReference } from '../types/r6';

const DEFAULT_ROLE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/practitioner-role';
const SPECIALTY_SYSTEM = 'http://nucc.org/provider-taxonomy';

export interface JobPostingLocation {
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface JobPostingForPractitionerRole {
  id: string;
  title: string;
  partnerId: string;
  partnerName?: string;
  specialty: string;
  requiredStates: string[];
  status?: 'active' | 'closed' | 'filled';
  telehealth?: boolean;
  modality?: 'in-person' | 'telehealth' | 'hybrid' | string;
  location?: JobPostingLocation | null;
  fhirMetadata?: Record<string, unknown> | null;
}

export interface PractitionerRoleContext {
  practitionerId?: string;
  organizationId?: string;
  roleCode?: string;
  roleCodeSystem?: string;
  telehealthUrl?: string;
}

function buildSpecialty(job: JobPostingForPractitionerRole): FhirCodeableConcept[] {
  return [
    {
      coding: [{
        system: SPECIALTY_SYSTEM,
        code: job.specialty,
        display: job.specialty,
      }],
    },
  ];
}

function buildCode(job: JobPostingForPractitionerRole, ctx: PractitionerRoleContext): FhirCodeableConcept[] {
  const codeValue = ctx.roleCode ?? job.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
  const system = ctx.roleCodeSystem ?? DEFAULT_ROLE_SYSTEM;

  return [
    {
      coding: [{
        system,
        code: codeValue,
        display: job.title,
      }],
      text: job.title,
    },
  ];
}

function buildLocations(job: JobPostingForPractitionerRole): FhirReference[] | undefined {
  const states = new Set<string>();
  for (const state of job.requiredStates ?? []) {
    states.add(state);
  }
  if (job.location?.state) {
    states.add(job.location.state);
  }

  if (states.size === 0) {
    return undefined;
  }

  return Array.from(states).map(state => ({
    reference: `Location/${state}`,
    display: `State: ${state}`,
  }));
}

export function jobPostingToPractitionerRole(
  job: JobPostingForPractitionerRole,
  context: PractitionerRoleContext = {}
): PractitionerRoleResource {
  const organizationId = context.organizationId ?? job.partnerId;
  const organizationDisplay = job.partnerName ?? job.partnerId;

  const telehealthUrl = context.telehealthUrl ?? 'virtual-care';
  const telehealthEnabled = job.telehealth === true || job.modality === 'telehealth' || job.modality === 'hybrid';

  return {
    resourceType: 'PractitionerRole',
    id: job.id,
    active: job.status !== 'closed' && job.status !== 'filled',
    practitioner: context.practitionerId
      ? {
          reference: `Practitioner/${context.practitionerId}`,
        }
      : undefined,
    organization: {
      reference: `Organization/${organizationId}`,
      display: organizationDisplay,
    },
    code: buildCode(job, context),
    specialty: buildSpecialty(job),
    location: buildLocations(job),
    telecom: telehealthEnabled
      ? [{
          system: 'url',
          value: telehealthUrl,
          use: 'work',
        }]
      : undefined,
    virtualService: telehealthEnabled
      ? [{
          channelType: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/service-mode',
              code: 'virtual',
              display: 'Virtual',
            }],
          },
          telecom: [{
            system: 'url',
            value: telehealthUrl,
          }],
        }]
      : undefined,
    period: undefined,
  };
}



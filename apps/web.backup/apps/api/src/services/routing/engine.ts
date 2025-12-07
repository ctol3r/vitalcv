import type { Prisma, RoutingRequest } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

export type RoutingTargetSystem = 'ATS' | 'EHR' | 'CVO' | 'TEFCA Node';
export type RoutingMethod = 'FHIR' | 'OIDC4VC';

export interface RoutingInput {
  clinicianId: string;
  targetSystem: RoutingTargetSystem;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RoutingEnvelope {
  method: RoutingMethod;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface RoutingPlan {
  request: RoutingRequest;
  envelope: RoutingEnvelope;
}

export type ClinicianContext = {
  id: string;
  npi: string | null;
  state: string | null;
  specialty: string | null;
  user: {
    name: string | null;
    email: string | null;
    did: string | null;
  } | null;
  licenses: Array<{
    state: string | null;
    licenseNumber: string;
    expiryDate: Date | null;
  }>;
};

export class RoutingEngine {
  private readonly prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = new PrismaClient()) {
    this.prisma = prismaClient;
  }

  async planRequest(input: RoutingInput): Promise<RoutingPlan> {
    const context = await this.loadContext(input.clinicianId);
    if (!context) {
      throw new Error(`Clinician ${input.clinicianId} not found`);
    }

    const envelope = buildEnvelope(input.targetSystem, context, input.payload);
    const request = await this.prisma.routingRequest.create({
      data: {
        clinicianId: input.clinicianId,
        targetSystem: input.targetSystem,
        method: envelope.method,
        payload: {
          envelope,
        } as Prisma.JsonObject,
        status: 'pending',
      },
    });

    return { request, envelope };
  }

  private async loadContext(clinicianId: string): Promise<ClinicianContext | null> {
    const clinician = await this.prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            did: true,
          },
        },
      },
    });

    if (!clinician) return null;

    const licenses = await this.prisma.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        state: true,
        licenseNumber: true,
        expiryDate: true,
      },
    });

    return {
      id: clinician.id,
      npi: clinician.npi,
      state: clinician.state,
      specialty: clinician.specialty,
      user: clinician.user,
      licenses,
    };
  }
}

export function buildEnvelope(
  targetSystem: RoutingTargetSystem,
  clinician: ClinicianContext,
  overrides?: Record<string, unknown>,
): RoutingEnvelope {
  switch (targetSystem) {
    case 'ATS':
      return {
        method: 'FHIR',
        body: {
          bundle: buildPractitionerBundle(clinician),
          destination: 'ats',
          ...overrides,
        },
        headers: {
          'Content-Type': 'application/fhir+json',
        },
        metadata: {
          delivery: 'FHIR Bundle',
          includesRoles: true,
        },
      };
    case 'EHR':
      return {
        method: 'FHIR',
        body: {
          bundle: buildPractitionerBundle(clinician),
          smartLaunch: {
            launchUri: process.env.SMART_LAUNCH_URL ?? 'https://ehr.example/smart/launch',
            scopes: ['launch', 'openid', 'profile', 'offline_access', 'user/*.read'],
          },
          cdsHooks: [
            {
              hook: 'practitioner-crd',
              payload: {
                clinicianId: clinician.id,
                specialty: clinician.specialty,
              },
            },
          ],
          ...overrides,
        },
        headers: {
          'Content-Type': 'application/fhir+json',
          'X-SMART-LAUNCH': 'required',
        },
        metadata: {
          delivery: 'SMART-on-FHIR + CDS Hooks',
        },
      };
    case 'TEFCA Node':
      return {
        method: 'FHIR',
        body: {
          directoryPayload: buildTefcaDirectoryPayload(clinician),
          ...overrides,
        },
        headers: {
          'Content-Type': 'application/fhir+json',
        },
        metadata: {
          delivery: 'TEFCA Practitioner/Role',
        },
      };
    case 'CVO':
      return {
        method: 'OIDC4VC',
        body: {
          presentation: buildOidcPresentation(clinician),
          ...overrides,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        metadata: {
          delivery: 'OIDC4VCI/VP packet',
        },
      };
    default:
      throw new Error(`Unsupported routing target: ${targetSystem}`);
  }
}

function buildPractitionerBundle(clinician: ClinicianContext) {
  const practitioner = {
    resourceType: 'Practitioner',
    id: clinician.id,
    identifier: clinician.npi
      ? [{ system: 'http://hl7.org/fhir/sid/us-npi', value: clinician.npi }]
      : undefined,
    name: clinician.user?.name
      ? [
          {
            text: clinician.user.name,
          },
        ]
      : undefined,
    telecom: clinician.user?.email
      ? [
          {
            system: 'email',
            value: clinician.user.email,
          },
        ]
      : undefined,
  };

  const role = {
    resourceType: 'PractitionerRole',
    id: `${clinician.id}-role`,
    practitioner: {
      reference: `Practitioner/${clinician.id}`,
    },
    specialty: clinician.specialty
      ? [
          {
            coding: [
              {
                system: 'http://nucc.org/provider-taxonomy',
                code: clinician.specialty,
              },
            ],
          },
        ]
      : undefined,
    extension: [
      {
        url: 'https://vitalcv.health/extensions/compact-eligibility',
        valueBoolean: clinician.licenses.length >= 2,
      },
    ],
  };

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      { fullUrl: `Practitioner/${clinician.id}`, resource: practitioner },
      { fullUrl: `PractitionerRole/${clinician.id}-role`, resource: role },
    ],
  };
}

function buildTefcaDirectoryPayload(clinician: ClinicianContext) {
  return {
    practitioner: {
      id: clinician.id,
      npi: clinician.npi,
      did: clinician.user?.did,
      specialties: clinician.specialty ? [clinician.specialty] : [],
    },
    roles: clinician.licenses.map((license) => ({
      jurisdiction: license.state,
      licenseNumber: license.licenseNumber,
      expiresOn: license.expiryDate?.toISOString() ?? null,
    })),
  };
}

function buildOidcPresentation(clinician: ClinicianContext) {
  return {
    protocol: 'OIDC4VP',
    vp_token: {
      type: ['VerifiablePresentation', 'VitalCredentialPassport'],
      holder: clinician.user?.did ?? `did:key:${clinician.id}`,
      verifiableCredential: [
        {
          id: `urn:vc:license:${clinician.id}`,
          type: ['VerifiableCredential', 'StateLicense'],
          credentialSubject: {
            clinicianId: clinician.id,
            npi: clinician.npi,
            licenses: clinician.licenses.map((license) => ({
              state: license.state,
              licenseNumber: license.licenseNumber,
              expiresOn: license.expiryDate?.toISOString() ?? null,
            })),
          },
        },
      ],
    },
    presentation_submission: {
      definition_id: 'cvo-routing',
      descriptor_map: [
        {
          id: 'license-vc',
          path: '$.vp_token.verifiableCredential[0]',
          format: 'vc+ldp',
        },
      ],
    },
  };
}


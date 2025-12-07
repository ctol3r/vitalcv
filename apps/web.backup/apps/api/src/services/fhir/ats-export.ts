import crypto from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  clinicianToPractitioner,
  type InternalClinician,
} from '../../../../services/fhir/adapter/practitionerAdapter';
import {
  jobPostingToPractitionerRole,
  type JobPostingLocation,
} from '../../../../services/fhir/adapter/practitionerRoleAdapter';
import type {
  PractitionerResource,
  PractitionerRoleResource,
  FhirCodeableConcept,
} from '../../../../services/fhir/types/r6';

type FetchImpl = typeof fetch;
type ClinicianWithExtensions = Prisma.ClinicianProfileGetPayload<{ include: { user: true } }> & {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  boardStatus?: string | null;
};

export interface AtsWebhookTarget {
  id: string;
  url: string;
  secret: string;
}

export interface AtsExportRequest {
  clinicianId: string;
  webhook: AtsWebhookTarget;
  orgId?: string;
  prisma?: PrismaClient;
  fetchImpl?: FetchImpl;
}

export interface AtsExportResult {
  webhookId: string;
  delivered: boolean;
  payloadHash: string;
  responseStatus?: number;
  responseBody?: unknown;
}

export interface AtsBundleBuilderOptions {
  clinicianId: string;
  orgId?: string | null;
  prisma?: PrismaClient;
}

type BundleEntryResource = PractitionerResource | PractitionerRoleResource | VerificationResultResource;

export interface AtsApplicantBundle {
  clinicianId: string;
  orgId?: string | null;
  bundle: {
    resourceType: 'Bundle';
    type: 'collection';
    timestamp: string;
    entry: Array<{ resource: BundleEntryResource }>;
    meta: {
      taggedOrgId: string | null;
    };
  };
}

export interface VerificationResultResource {
  resourceType: 'VerificationResult';
  id: string;
  status: 'attested' | 'in-process' | 'revoked';
  statusDate?: string;
  target: Array<{ reference: string; display?: string }>;
  need?: { coding: FhirCodeableConcept[] };
  validationType?: { coding: FhirCodeableConcept[] };
  validationProcess?: string[];
  failureAction?: { coding: FhirCodeableConcept[] };
  primarySource?: Array<{
    who: { display: string };
    type?: FhirCodeableConcept;
    validationDate?: string;
    validationStatus?: FhirCodeableConcept;
    canPushUpdates?: boolean;
  }>;
  attestation?: {
    mode?: FhirCodeableConcept;
    source?: { display: string };
    time?: string;
  };
  statusReason?: FhirCodeableConcept;
  validationResult?: FhirCodeableConcept;
  recorded?: string;
  extension?: Array<Record<string, unknown>>;
}

const SIGNATURE_VERSION = 'v1';
const DEFAULT_FETCH_TIMEOUT = 45_000;

export async function buildAtsApplicantBundle(
  options: AtsBundleBuilderOptions,
): Promise<AtsApplicantBundle> {
  const client = options.prisma ?? new PrismaClient();
  const ownsClient = !options.prisma;

  try {
    const [clinician, licenses, readiness] = await Promise.all([
      client.clinicianProfile.findUnique({
        where: { id: options.clinicianId },
        include: { user: true },
      }),
      client.stateLicenseVerification.findMany({
        where: { clinicianId: options.clinicianId },
        orderBy: { verifiedAt: 'desc' },
        take: 25,
      }),
      client.clinicianReadinessScore.findUnique({
        where: { clinicianId: options.clinicianId },
      }),
    ]);

    if (!clinician || !clinician.user) {
      throw new Error(`Clinician ${options.clinicianId} not found or missing user profile`);
    }

    const extendedClinician = clinician as ClinicianWithExtensions;
    const practitioner = buildPractitionerResource(extendedClinician, licenses);
    const practitionerRole = buildPractitionerRole(extendedClinician, licenses, readiness);
    const verificationResult = buildVerificationResult(extendedClinician, licenses, readiness);
    const taggedOrgId = options.orgId ?? extendedClinician.orgId ?? null;
    const timestamp = new Date().toISOString();

    return {
      clinicianId: options.clinicianId,
      orgId: taggedOrgId,
      bundle: {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp,
        entry: [
          { resource: practitioner },
          { resource: practitionerRole },
          { resource: verificationResult },
        ],
        meta: {
          taggedOrgId,
        },
      },
    };
  } finally {
    if (ownsClient) {
      await client.$disconnect();
    }
  }
}

export async function sendAtsFhirExport(options: AtsExportRequest): Promise<AtsExportResult> {
  const prisma = options.prisma ?? new PrismaClient();
  const fetchImpl = options.fetchImpl ?? fetchWithTimeout;

  const applicant = await buildAtsApplicantBundle({
    clinicianId: options.clinicianId,
    orgId: options.orgId,
    prisma,
  });

  const payload = {
    webhookId: options.webhook.id,
    clinicianId: options.clinicianId,
    sentAt: new Date().toISOString(),
    bundle: applicant.bundle,
  };

  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
  const signature = signPayload(options.webhook.secret, timestamp, body);

  const response = await fetchImpl(options.webhook.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ats-webhook-id': options.webhook.id,
      'x-ats-signature': `${SIGNATURE_VERSION}=${signature}`,
      'x-ats-timestamp': timestamp,
      'x-payload-sha256': payloadHash,
    },
    body,
  });

  let responseBody: unknown = null;
  try {
    const text = await response.text();
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
    throw new Error(
      `ATS webhook ${options.webhook.id} responded with ${response.status}: ${
        typeof responseBody === 'object' ? JSON.stringify(responseBody) : responseBody ?? 'unknown'
      }`,
    );
  }

  return {
    webhookId: options.webhook.id,
    delivered: true,
    payloadHash,
    responseStatus: response.status,
    responseBody,
  };
}

function buildPractitionerResource(
  clinician: ClinicianWithExtensions,
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
): PractitionerResource {
  const internal: InternalClinician = {
    id: clinician.id,
    npi: clinician.npi ?? undefined,
    name: splitName(clinician.user?.name ?? clinician.id),
    contact: {
      email: clinician.user?.email ?? 'unknown@vitalcv.health',
      phone: clinician.user?.phone ?? undefined,
    },
    addresses: buildAddresses(clinician, licenses),
    specialties: [
      {
        code: (clinician.specialty ?? 'General Practice').toUpperCase(),
        display: clinician.specialty ?? 'General Practice',
      },
    ],
    identifiers: [
      {
        system: 'https://vitalcv.health/clinicians',
        value: clinician.id,
      },
    ],
    active: true,
    qualifications: clinician.boardStatus
      ? [
          {
            code: clinician.boardStatus,
            display: clinician.boardStatus,
          },
        ]
      : undefined,
  };

  return clinicianToPractitioner(internal);
}

function buildPractitionerRole(
  clinician: ClinicianWithExtensions,
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
  readiness: Prisma.ClinicianReadinessScoreGetPayload<{}> | null,
): PractitionerRoleResource {
  const requiredStates = Array.from(
    new Set(
      licenses
        .filter((license) => license.status?.toUpperCase() === 'ACTIVE')
        .map((license) => license.state)
        .filter(Boolean) as string[],
    ),
  );

  const primaryLocation: JobPostingLocation | null = clinician.city || clinician.state
    ? {
        city: clinician.city ?? undefined,
        state: clinician.state ?? undefined,
        postalCode: clinician.zip ?? undefined,
      }
    : null;

  const readinessFactors = (readiness?.factors as Record<string, unknown>) ?? {};

  return jobPostingToPractitionerRole(
    {
      id: `${clinician.id}-role`,
      title: `${clinician.specialty ?? 'Clinician'} Candidate`,
      partnerId: clinician.orgId ?? 'vitalcv',
      partnerName: clinician.orgId ?? 'Vital Credentialing',
      specialty: clinician.specialty ?? 'General Practice',
      requiredStates,
      status: 'active',
      telehealth: readinessFactors.telehealthReady === true,
      modality: readinessFactors.telehealthReady ? 'telehealth' : 'in-person',
      location: primaryLocation,
      fhirMetadata: {
        readinessScore: readiness?.score ?? null,
        readinessComponents: readinessFactors.readinessComponents ?? null,
        compactEligibility: readinessFactors.compactEligibility ?? null,
      },
    },
    {
      practitionerId: clinician.id,
      organizationId: clinician.orgId ?? undefined,
    },
  );
}

function buildVerificationResult(
  clinician: ClinicianWithExtensions,
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
  readiness: Prisma.ClinicianReadinessScoreGetPayload<{}> | null,
): VerificationResultResource {
  const activeLicenses = licenses.filter(
    (license) => (license.status ?? '').toUpperCase() === 'ACTIVE',
  );
  const status: VerificationResultResource['status'] =
    activeLicenses.length > 0 ? 'attested' : 'in-process';

  const primarySources = activeLicenses.slice(0, 5).map((license) => ({
    who: { display: `${license.state} ${license.source ?? 'State Board'}` },
    type: codeable('http://terminology.hl7.org/CodeSystem/verificationresult-primary-source-type', 'lic-board', 'Licensing board'),
    validationDate: license.verifiedAt?.toISOString() ?? license.updatedAt?.toISOString() ?? undefined,
    validationStatus: codeable(
      'http://terminology.hl7.org/CodeSystem/verificationresult-validation-status',
      'successful',
      'Verification successful',
    ),
    canPushUpdates: true,
  }));

  const riskSummary = (readiness?.factors as { riskScore?: number })?.riskScore ?? null;

  return {
    resourceType: 'VerificationResult',
    id: `${clinician.id}-verification`,
    status,
    statusDate: new Date().toISOString(),
    recorded: new Date().toISOString(),
    target: [
      {
        reference: `Practitioner/${clinician.id}`,
        display: clinician.user?.name ?? clinician.id,
      },
    ],
    need: codeableConcept('http://terminology.hl7.org/CodeSystem/verificationresult-need', 'initial', 'Initial onboarding verification'),
    validationType: codeableConcept(
      'http://terminology.hl7.org/CodeSystem/verificationresult-validation-type',
      'primary',
      'Primary source verification',
    ),
    validationProcess: ['psv', 'licensure', 'sanctions', 'compact'],
    primarySource: primarySources,
    failureAction:
      status === 'attested'
        ? undefined
        : codeableConcept(
            'http://terminology.hl7.org/CodeSystem/verificationresult-failure-action',
            'none',
            'Additional evidence required before attestation',
          ),
    attestation: {
      mode: codeable(
        'http://terminology.hl7.org/CodeSystem/verificationresult-attestation-mode',
        'official-records',
        'Official records',
      ),
      source: { display: clinician.orgId ?? 'Vital Credentialing' },
      time: new Date().toISOString(),
    },
    extension: [
      {
        url: 'https://vitalcv.health/fhir/StructureDefinition/readiness-signal',
        valueCodeableConcept: codeable(
          'https://vitalcv.health/codes/readiness',
          riskSummary && riskSummary > 0.7 ? 'elevated' : 'stable',
          riskSummary && riskSummary > 0.7 ? 'Elevated risk' : 'Stable risk profile',
        ),
      },
    ],
  };
}

function buildAddresses(
  clinician: ClinicianWithExtensions,
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[],
) {
  const addresses: InternalClinician['addresses'] = [];
  if (clinician.city || clinician.state || clinician.zip) {
    addresses.push({
      line1: clinician.addressLine1 ?? undefined,
      line2: clinician.addressLine2 ?? undefined,
      city: clinician.city ?? undefined,
      state: clinician.state ?? undefined,
      postalCode: clinician.zip ?? undefined,
      country: 'USA',
    });
  }
  licenses
    .slice(0, 3)
    .filter((license) => license.state)
    .forEach((license) => {
      addresses.push({
        state: license.state ?? undefined,
        country: 'USA',
      });
    });
  if (addresses.length === 0) {
    addresses.push({
      state: clinician.state ?? 'CA',
      country: 'USA',
    });
  }
  return addresses;
}

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first: 'Unknown', last: 'Clinician' };
  }
  if (parts.length === 1) {
    return { first: parts[0], last: parts[0] };
  }
  return {
    first: parts[0],
    last: parts[parts.length - 1],
    middle: parts.slice(1, -1),
  };
}

function codeable(system: string, code: string, display?: string): FhirCodeableConcept {
  return {
    coding: [
      {
        system,
        code,
        display,
      },
    ],
    text: display,
  };
}

function codeableConcept(system: string, code: string, display?: string) {
  return {
    coding: [
      {
        system,
        code,
        display,
      },
    ],
    text: display,
  };
}

function signPayload(secret: string, timestamp: string, body: string) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function fetchWithTimeout(
  input: Parameters<FetchImpl>[0],
  init?: Parameters<FetchImpl>[1],
): ReturnType<FetchImpl> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT);
  try {
    return await globalThis.fetch(input, { ...(init ?? {}), signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}



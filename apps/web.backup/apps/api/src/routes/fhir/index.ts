import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { clinicianToPractitioner } from '../../../../services/fhir/adapter/practitionerAdapter';
import { jobPostingToPractitionerRole } from '../../../../services/fhir/adapter/practitionerRoleAdapter';
import { buildEndpointFromEhrConfig, orgProfileToOrganization, OrgProfileForFhir } from '../../../../services/fhir/adapter/organizationAdapter';
import { validateResource } from '../../../../services/fhir/validator';
import { buildOperationOutcome, outcomeFromValidation } from '../../../../services/fhir/operationOutcome';
import { JobPostingLocation } from '../../../../services/fhir/adapter/practitionerRoleAdapter';
import { PractitionerResource, PractitionerRoleResource, OrganizationResource, EndpointResource } from '../../../../services/fhir/types/r6';

const prisma = new PrismaClient();
const router = express.Router();

type R6Resource = PractitionerResource | PractitionerRoleResource | OrganizationResource | EndpointResource;

function respondWithValidation(res: Response, resource: R6Resource, type: typeof resource['resourceType']) {
  const validation = validateResource(resource, type);
  if (!validation.valid) {
    return res.status(400).json(outcomeFromValidation(type, validation.errors));
  }
  return res.json(resource);
}

function notFound(res: Response, message: string) {
  return res.status(404).json(
    buildOperationOutcome([{
      severity: 'error',
      code: 'not-found',
      diagnostics: message,
    }])
  );
}

function serverError(res: Response, error: unknown) {
  const diagnostics = error instanceof Error ? error.message : 'Unknown error';
  return res.status(500).json(
    buildOperationOutcome([{
      severity: 'error',
      code: 'exception',
      diagnostics,
    }])
  );
}

function splitName(fullName: string | null): { first: string; last: string; middle?: string[] } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
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

router.get('/Practitioner/:id', async (req: Request, res: Response) => {
  try {
    const clinician = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { clinicianProfile: true },
    });

    if (!clinician || !clinician.clinicianProfile) {
      return notFound(res, `Practitioner ${req.params.id} not found`);
    }

    const nameParts = splitName(clinician.name);
    const practitioner = clinicianToPractitioner({
      id: clinician.id,
      npi: clinician.clinicianProfile.npi,
      name: {
        first: nameParts.first,
        last: nameParts.last,
        middle: nameParts.middle,
      },
      contact: {
        email: clinician.email,
        phone: clinician.phone ?? undefined,
      },
      addresses: [{
        state: clinician.clinicianProfile.state,
        country: 'USA',
      }],
      specialties: [{
        code: clinician.clinicianProfile.specialty,
        display: clinician.clinicianProfile.specialty,
      }],
    });

    return respondWithValidation(res, practitioner, 'Practitioner');
  } catch (error) {
    return serverError(res, error);
  }
});

function extractString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

type JobStatus = 'active' | 'closed' | 'filled';

function normalizeJobStatus(status: string | null): JobStatus {
  if (status === 'closed' || status === 'filled') {
    return status;
  }
  return 'active';
}

router.get('/PractitionerRole/:id', async (req: Request, res: Response) => {
  try {
    const job = await prisma.jobPosting.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return notFound(res, `PractitionerRole ${req.params.id} not found`);
    }

    const location = job.location as JobPostingLocation | null;
    const fhirMetadata = job.fhirMetadata as Record<string, unknown> | null;

    const metadata = job.fhirMetadata as Record<string, unknown> | null;
    const telehealthUrl = extractString(metadata?.telehealthUrl);

    const resource = jobPostingToPractitionerRole(
      {
        id: job.id,
        title: job.title,
        partnerId: job.partnerId,
        specialty: job.specialty,
        requiredStates: job.requiredStates,
        status: normalizeJobStatus(job.status),
        telehealth: job.telehealth,
        modality: job.modality as any,
        location,
        fhirMetadata,
      },
      {
        practitionerId: typeof req.query.practitionerId === 'string' ? req.query.practitionerId : undefined,
        organizationId: job.partnerId,
        telehealthUrl,
      }
    );

    return respondWithValidation(res, resource, 'PractitionerRole');
  } catch (error) {
    return serverError(res, error);
  }
});

router.get('/Organization/:id', async (req: Request, res: Response) => {
  try {
    const org = await prisma.orgProfile.findUnique({
      where: { orgId: req.params.id },
    });

    if (!org) {
      return notFound(res, `Organization ${req.params.id} not found`);
    }

    const organization = orgProfileToOrganization({
      orgId: org.orgId,
      name: org.name,
      contactEmail: org.contactEmail,
      address: org.address as OrgProfileForFhir['address'],
    });

    return respondWithValidation(res, organization, 'Organization');
  } catch (error) {
    return serverError(res, error);
  }
});

router.get('/Endpoint/:orgId', async (req: Request, res: Response) => {
  try {
    const config = await prisma.ehrConfig.findUnique({
      where: { orgId: req.params.orgId },
    });

    if (!config) {
      return notFound(res, `Endpoint for org ${req.params.orgId} not found`);
    }

    const orgProfile = await prisma.orgProfile.findUnique({
      where: { orgId: req.params.orgId },
    });

    const metadata = config.metadata as Record<string, unknown> | null;
    const org: OrgProfileForFhir = orgProfile
      ? {
          orgId: orgProfile.orgId,
          name: orgProfile.name,
          contactEmail: orgProfile.contactEmail,
          address: orgProfile.address as OrgProfileForFhir['address'],
        }
      : {
          orgId: config.orgId,
          name: extractString(metadata?.organizationName) ?? config.orgId,
          contactEmail: extractString(metadata?.contactEmail) ?? 'support@vitalcv.health',
        };

    const endpoint = buildEndpointFromEhrConfig(org, config);
    return respondWithValidation(res, endpoint, 'Endpoint');
  } catch (error) {
    return serverError(res, error);
  }
});

export default router;



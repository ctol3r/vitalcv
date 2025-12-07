/**
 * S72-STRETCH-C-006: EHR FHIR PractitionerRole real mapping (from SMART client)
 *
 * GET /ehr/fhir/practitionerRoles proxies SMART client; applies mapping;
 * returns normalized JSON; masks PHI in logs.
 */

import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { SmartClient } from '../../../../../services/ehr/smartClient.js';
import {
  mapPractitionerRoleToProvider,
  type FhirPractitionerRole,
  type FhirPractitioner,
} from '../../../../../services/ehr/mapping/practitionerMapper.js';
import { logEhrFacadeRequest } from '../../../../../services/audit/ehrFacadeEvents.js';
import { ehrFacadeKillSwitchGuard } from '../../../../../services/flags/wireKillSwitches.js';

const router: Router = express.Router();
const prisma = new PrismaClient();

/**
 * Mask PHI in logs (names, emails, phones, addresses)
 */
function maskPHI(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskPHI);
  }

  const masked: any = {};
  const phiFields = [
    'name',
    'firstName',
    'lastName',
    'middleName',
    'displayName',
    'email',
    'phone',
    'address',
    'birthDate',
    'ssn',
    'identifier',
  ];

  for (const [key, value] of Object.entries(data)) {
    if (phiFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      // Mask PHI fields
      if (typeof value === 'string' && value.length > 0) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object') {
        masked[key] = maskPHI(value);
      } else {
        masked[key] = '***MASKED***';
      }
    } else {
      // Recursively mask nested objects
      masked[key] = typeof value === 'object' && value !== null ? maskPHI(value) : value;
    }
  }

  return masked;
}

/**
 * GET /ehr/fhir/practitionerRoles
 *
 * Fetches PractitionerRole resources from EHR, applies mapping, and returns normalized JSON.
 * Supports query parameters for filtering (department, specialty, etc.)
 */
router.get('/', ehrFacadeKillSwitchGuard, async (req: Request, res: Response) => {
  const startTime = Date.now();
  let statusCode: number | undefined;
  let errorMessage: string | undefined;

  try {
    // Extract orgId from auth context
    const orgId = (req.headers['x-org-id'] as string) || (req as any).user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Organization ID is required' });
      return;
    }

    // Fetch EHR config for organization
    const ehrConfig = await prisma.ehrConfig.findUnique({
      where: { orgId },
    });

    if (!ehrConfig || !ehrConfig.isActive) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'EHR integration not configured for this organization',
      });
      return;
    }

    // Build FHIR query parameters
    const queryParams: Record<string, string> = {};

    // Support filtering by department (organization)
    if (req.query.department) {
      queryParams.organization = req.query.department as string;
    }

    // Support filtering by specialty
    if (req.query.specialty) {
      queryParams.specialty = req.query.specialty as string;
    }

    // Support filtering by active status
    if (req.query.active !== undefined) {
      queryParams.active = req.query.active as string;
    }

    // Support _count for pagination
    if (req.query._count) {
      queryParams._count = req.query._count as string;
    }

    // Build query string
    const queryString = new URLSearchParams(queryParams).toString();
    const fhirPath = queryString ? `PractitionerRole?${queryString}` : 'PractitionerRole';

    // Create SMART client and fetch PractitionerRole resources
    const client = new SmartClient(ehrConfig);
    const response = await client.request(fhirPath);
    statusCode = response.status;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FHIR request failed: ${response.status} - ${errorText}`);
    }

    // Parse FHIR Bundle response
    const fhirBundle: any = await response.json();

    // Extract PractitionerRole entries
    const practitionerRoles: FhirPractitionerRole[] = [];
    const practitionerRefs = new Set<string>();

    if (fhirBundle.entry) {
      for (const entry of fhirBundle.entry) {
        if (entry.resource?.resourceType === 'PractitionerRole') {
          practitionerRoles.push(entry.resource as FhirPractitionerRole);

          // Collect practitioner references for batch fetching
          if (entry.resource.practitioner?.reference) {
            practitionerRefs.add(entry.resource.practitioner.reference);
          }
        }
      }
    }

    // Fetch associated Practitioner resources if needed
    const practitioners = new Map<string, FhirPractitioner>();
    if (practitionerRefs.size > 0) {
      // Fetch practitioners in batch (simplified - in production, use _include or batch requests)
      for (const ref of practitionerRefs) {
        try {
          const practitionerId = ref.split('/')[1];
          const practitionerResponse = await client.request(`Practitioner/${practitionerId}`);

          if (practitionerResponse.ok) {
            const practitioner = (await practitionerResponse.json()) as FhirPractitioner;
            practitioners.set(ref, practitioner);
          }
        } catch (error) {
          // Log but continue if practitioner fetch fails
          console.warn(`Failed to fetch practitioner ${ref}: ${error}`);
        }
      }
    }

    // Map PractitionerRole resources to normalized format
    const normalizedRoles = practitionerRoles.map((role) => {
      const practitioner = role.practitioner?.reference
        ? practitioners.get(role.practitioner.reference)
        : undefined;

      return mapPractitionerRoleToProvider(role, practitioner, ehrConfig.ehrType);
    });

    // Return normalized response
    const responseData = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: normalizedRoles.length,
      entry: normalizedRoles.map((provider) => ({
        resource: provider,
      })),
      meta: {
        lastUpdated: new Date().toISOString(),
      },
    };

    res.status(200).json(responseData);

    // Log request with PHI masking
    const duration = Date.now() - startTime;
    const maskedQueryParams = maskPHI(req.query);
    await logEhrFacadeRequest({
      orgId,
      source: 'ehr',
      resourceType: 'PractitionerRole',
      queryParams: maskedQueryParams as Record<string, any>,
      statusCode: 200,
      duration,
      resultCount: normalizedRoles.length,
    });
  } catch (error) {
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PractitionerRoles] Error:', errorMessage);

    // Mask any PHI in error details
    const safeError = maskPHI({ message: errorMessage });

    res.status(statusCode).json({
      error: 'PractitionerRoleFetchError',
      message: 'Failed to fetch PractitionerRole resources from EHR',
      details: safeError,
    });

    // Log failed request with PHI masking
    const duration = Date.now() - startTime;
    const orgId = (req.headers['x-org-id'] as string) || (req as any).user?.orgId;
    if (orgId) {
      const maskedQueryParams = maskPHI(req.query);
      await logEhrFacadeRequest({
        orgId,
        source: 'ehr',
        resourceType: 'PractitionerRole',
        queryParams: maskedQueryParams as Record<string, any>,
        statusCode,
        duration,
        errorMessage: safeError.message,
      });
    }
  }
});

/**
 * GET /ehr/fhir/practitionerRoles/:id
 *
 * Fetches a specific PractitionerRole by ID
 */
router.get('/:id', ehrFacadeKillSwitchGuard, async (req: Request, res: Response) => {
  const startTime = Date.now();
  let statusCode: number | undefined;
  let errorMessage: string | undefined;

  try {
    const orgId = (req.headers['x-org-id'] as string) || (req as any).user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Organization ID is required' });
      return;
    }

    const ehrConfig = await prisma.ehrConfig.findUnique({
      where: { orgId },
    });

    if (!ehrConfig || !ehrConfig.isActive) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'EHR integration not configured for this organization',
      });
      return;
    }

    const client = new SmartClient(ehrConfig);
    const roleId = req.params.id;

    // Fetch PractitionerRole
    const roleResponse = await client.request(`PractitionerRole/${roleId}`);
    statusCode = roleResponse.status;

    if (!roleResponse.ok) {
      const errorText = await roleResponse.text();
      throw new Error(`FHIR request failed: ${roleResponse.status} - ${errorText}`);
    }

    const role = (await roleResponse.json()) as FhirPractitionerRole;

    // Fetch associated Practitioner if available
    let practitioner: FhirPractitioner | undefined;
    if (role.practitioner?.reference) {
      try {
        const practitionerId = role.practitioner.reference.split('/')[1];
        const practitionerResponse = await client.request(`Practitioner/${practitionerId}`);

        if (practitionerResponse.ok) {
          practitioner = (await practitionerResponse.json()) as FhirPractitioner;
        }
      } catch (error) {
        console.warn(`Failed to fetch practitioner: ${error}`);
      }
    }

    // Map to normalized format
    const normalized = mapPractitionerRoleToProvider(role, practitioner, ehrConfig.ehrType);

    res.status(200).json(normalized);

    // Log with PHI masking
    const duration = Date.now() - startTime;
    await logEhrFacadeRequest({
      orgId,
      source: 'ehr',
      resourceType: 'PractitionerRole',
      queryParams: { id: roleId },
      statusCode: 200,
      duration,
    });
  } catch (error) {
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PractitionerRoles] Error:', errorMessage);

    const safeError = maskPHI({ message: errorMessage });

    res.status(statusCode).json({
      error: 'PractitionerRoleFetchError',
      message: 'Failed to fetch PractitionerRole resource',
      details: safeError,
    });

    const duration = Date.now() - startTime;
    const orgId = (req.headers['x-org-id'] as string) || (req as any).user?.orgId;
    if (orgId) {
      await logEhrFacadeRequest({
        orgId,
        source: 'ehr',
        resourceType: 'PractitionerRole',
        queryParams: { id: req.params.id },
        statusCode,
        duration,
        errorMessage: safeError.message,
      });
    }
  }
});

export default router;


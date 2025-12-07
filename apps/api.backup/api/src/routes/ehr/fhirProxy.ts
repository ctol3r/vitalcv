/**
 * B136A-EHR-003: FHIR Facade - EHR Proxy for Practitioner & PractitionerRole
 *
 * Proxies FHIR R6 requests to configured EHR with PHI-stripped logging.
 * Preserves query parameters and handles authentication transparently.
 */

import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { SmartClient } from '../../../../../services/ehr/smartClient.js';
import { logEhrFacadeRequest } from '../../../../../services/audit/ehrFacadeEvents.js';
import { featureFlagGuard, checkFeatureFlag, getFeatureFlagService } from '../../../../../services/flags/featureFlags.js';
import { ehrFacadeKillSwitchGuard } from '../../../../../services/flags/wireKillSwitches.js';
import { riskGate } from '../../middleware/riskGate.js';

const router: Router = express.Router();
const prisma = new PrismaClient();

/**
 * B149B-FF-011: Guard EHR facade behind `ehr.facade.enabled` flag (per-org)
 * GET /ehr/fhir/Practitioner
 *
 * Proxy search/read requests to EHR FHIR server
 */
router.get(
  '/Practitioner',
  riskGate('ehrFacade'), // B143F-LOOP-002: Risk gate middleware for high-value endpoint
  ehrFacadeKillSwitchGuard, // B141D-FF-006: Kill-switch guard (emergency shutdown)
  featureFlagGuard('ehr.facade.enabled', {
    orgIdExtractor: (req) => req.headers['x-org-id'] as string || (req as any).user?.orgId,
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EHR facade feature is currently disabled for this organization.',
  }),
  async (req: Request, res: Response) => {
    await proxyFhirRequest('Practitioner', req, res);
  }
);

/**
 * B149B-FF-011: Guard EHR facade behind `ehr.facade.enabled` flag (per-org)
 * GET /ehr/fhir/Practitioner/:id
 *
 * Proxy read requests for specific Practitioner
 */
router.get(
  '/Practitioner/:id',
  riskGate('ehrFacade'), // B143F-LOOP-002: Risk gate middleware for high-value endpoint
  ehrFacadeKillSwitchGuard, // B141D-FF-006: Kill-switch guard (emergency shutdown)
  featureFlagGuard('ehr.facade.enabled', {
    orgIdExtractor: (req) => req.headers['x-org-id'] as string || (req as any).user?.orgId,
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EHR facade feature is currently disabled for this organization.',
  }),
  async (req: Request, res: Response) => {
    await proxyFhirRequest(`Practitioner/${req.params.id}`, req, res);
  }
);

/**
 * B149B-FF-011: Guard EHR facade behind `ehr.facade.enabled` flag (per-org)
 * GET /ehr/fhir/PractitionerRole
 *
 * Proxy search requests to EHR FHIR server
 */
router.get(
  '/PractitionerRole',
  riskGate('ehrFacade'), // B143F-LOOP-002: Risk gate middleware for high-value endpoint
  ehrFacadeKillSwitchGuard, // B141D-FF-006: Kill-switch guard (emergency shutdown)
  featureFlagGuard('ehr.facade.enabled', {
    orgIdExtractor: (req) => req.headers['x-org-id'] as string || (req as any).user?.orgId,
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EHR facade feature is currently disabled for this organization.',
  }),
  async (req: Request, res: Response) => {
    await proxyFhirRequest('PractitionerRole', req, res);
  }
);

/**
 * B149B-FF-011: Guard EHR facade behind `ehr.facade.enabled` flag (per-org)
 * GET /ehr/fhir/PractitionerRole/:id
 *
 * Proxy read requests for specific PractitionerRole
 */
router.get(
  '/PractitionerRole/:id',
  riskGate('ehrFacade'), // B143F-LOOP-002: Risk gate middleware for high-value endpoint
  ehrFacadeKillSwitchGuard, // B141D-FF-006: Kill-switch guard (emergency shutdown)
  featureFlagGuard('ehr.facade.enabled', {
    orgIdExtractor: (req) => req.headers['x-org-id'] as string || (req as any).user?.orgId,
    statusCode: 404,
    errorCode: 'FEATURE_DISABLED',
    errorMessage: 'EHR facade feature is currently disabled for this organization.',
  }),
  async (req: Request, res: Response) => {
    await proxyFhirRequest(`PractitionerRole/${req.params.id}`, req, res);
  }
);

/**
 * Core proxy logic for FHIR requests
 */
async function proxyFhirRequest(resourcePath: string, req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  let statusCode: number | undefined;
  let errorMessage: string | undefined;

  try {
    // Extract orgId from auth context
    const orgId = req.headers['x-org-id'] as string || (req as any).user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Organization ID is required' });
      return;
    }

    // Fetch EHR config for organization
    const ehrConfig = await prisma.ehrConfig.findUnique({
      where: { orgId },
    });

    if (!ehrConfig || !ehrConfig.isActive) {
      res.status(403).json({ error: 'Forbidden', message: 'EHR integration not configured for this organization' });
      return;
    }

    // Create SMART client and make request
    const client = new SmartClient(ehrConfig);
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const path = queryString ? `${resourcePath}?${queryString}` : resourcePath;

    const response = await client.request(path);
    statusCode = response.status;

    // Stream response back to client
    const body = await response.text();
    res.status(response.status)
      .set('Content-Type', response.headers.get('content-type') || 'application/fhir+json')
      .send(body);

    // Log successful request
    const duration = Date.now() - startTime;
    await logEhrFacadeRequest({
      orgId,
      source: 'ehr',
      resourceType: resourcePath.split('/')[0],
      queryParams: req.query as Record<string, any>,
      statusCode,
      duration,
    });
  } catch (error) {
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('EHR FHIR proxy error:', errorMessage);

    res.status(statusCode).json({
      error: 'ProxyError',
      message: 'Failed to proxy FHIR request to EHR',
      details: errorMessage,
    });

    // Log failed request
    const duration = Date.now() - startTime;
    const orgId = req.headers['x-org-id'] as string || (req as any).user?.orgId;
    if (orgId) {
      await logEhrFacadeRequest({
        orgId,
        source: 'ehr',
        resourceType: resourcePath.split('/')[0],
        queryParams: req.query as Record<string, any>,
        statusCode,
        duration,
        errorMessage,
      });
    }
  }
}

export default router;


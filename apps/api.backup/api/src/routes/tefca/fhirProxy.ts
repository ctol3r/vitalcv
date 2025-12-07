/**
 * B136A-TEFCA-007: TEFCA FHIR Facade - Read-only Proxy for PractitionerRole
 *
 * Proxies FHIR R6 requests to TEFCA QHIN endpoint with PoU appended.
 * Logs all requests in audit trail with PHI masking.
 */

import express, { Request, Response, Router } from 'express';
import fetch from 'node-fetch';
import { enforceTefcaPou, TefcaRequest } from '../../middleware/tefcaPou.js';
import { logEhrFacadeRequest } from '../../../../../services/audit/ehrFacadeEvents.js';

const router: Router = express.Router();

// Apply PoU enforcement to all TEFCA routes
router.use(enforceTefcaPou);

/**
 * GET /tefca/fhir/PractitionerRole
 *
 * Proxy search requests to TEFCA QHIN endpoint
 */
router.get('/PractitionerRole', async (req: TefcaRequest, res: Response) => {
  await proxyTefcaRequest('PractitionerRole', req, res);
});

/**
 * GET /tefca/fhir/PractitionerRole/:id
 *
 * Proxy read requests for specific PractitionerRole
 */
router.get('/PractitionerRole/:id', async (req: TefcaRequest, res: Response) => {
  await proxyTefcaRequest(`PractitionerRole/${req.params.id}`, req, res);
});

/**
 * GET /tefca/fhir/Practitioner (read-only)
 *
 * Proxy read requests for Practitioner (directory lookup)
 */
router.get('/Practitioner', async (req: TefcaRequest, res: Response) => {
  await proxyTefcaRequest('Practitioner', req, res);
});

/**
 * GET /tefca/fhir/Practitioner/:id
 *
 * Proxy read requests for specific Practitioner
 */
router.get('/Practitioner/:id', async (req: TefcaRequest, res: Response) => {
  await proxyTefcaRequest(`Practitioner/${req.params.id}`, req, res);
});

/**
 * Core proxy logic for TEFCA FHIR requests
 */
async function proxyTefcaRequest(resourcePath: string, req: TefcaRequest, res: Response): Promise<void> {
  const startTime = Date.now();
  let statusCode: number | undefined;
  let errorMessage: string | undefined;

  try {
    const { orgId, purposeOfUse, qhinConfig } = req.tefca!;

    // Build QHIN endpoint URL with PoU appended
    const queryParams = new URLSearchParams(req.query as Record<string, string>);

    // Append Purpose of Use to query (TEFCA requirement)
    queryParams.set('_purposeOfUse', purposeOfUse);
    queryParams.set('_requester', qhinConfig.orgIdentifier);

    const qhinUrl = `${qhinConfig.qhinEndpoint}/${resourcePath}?${queryParams.toString()}`;

    // Make request to QHIN endpoint
    const response = await fetch(qhinUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/fhir+json',
        'X-Purpose-Of-Use': purposeOfUse,
        'X-Organization-Id': qhinConfig.orgIdentifier,
        ...(qhinConfig.authConfig?.headers || {}),
      },
    });

    statusCode = response.status;
    const body = await response.text();

    // Mask PHI in traces (already done by logEhrFacadeRequest)
    res.status(response.status)
      .set('Content-Type', response.headers.get('content-type') || 'application/fhir+json')
      .send(body);

    // Log successful request
    const duration = Date.now() - startTime;
    await logEhrFacadeRequest({
      orgId,
      source: 'tefca',
      resourceType: resourcePath.split('/')[0],
      queryParams: req.query as Record<string, any>,
      purposeOfUse,
      statusCode,
      duration,
    });
  } catch (error) {
    statusCode = 500;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('TEFCA FHIR proxy error:', errorMessage);

    res.status(statusCode).json({
      error: 'TefcaProxyError',
      message: 'Failed to proxy FHIR request to TEFCA QHIN',
      details: errorMessage,
    });

    // Log failed request
    const duration = Date.now() - startTime;
    const { orgId, purposeOfUse } = req.tefca!;
    await logEhrFacadeRequest({
      orgId,
      source: 'tefca',
      resourceType: resourcePath.split('/')[0],
      queryParams: req.query as Record<string, any>,
      purposeOfUse,
      statusCode,
      duration,
      errorMessage,
    });
  }
}

export default router;


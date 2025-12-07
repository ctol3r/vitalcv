// backend/src/routes/fhir.ts — FHIR facade for verifier export (MVP)

import { Router, Request, Response } from 'express';

export const fhir = Router();

/**
 * GET /api/fhir/verification-result/:token
 * Translate internal verification payload → FHIR VerificationResult Bundle
 */
fhir.get('/verification-result/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // TODO: Validate token and fetch verification result
    // For now, return FHIR structure

    res.json({
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `urn:uuid:${req.params.token}`,
          resource: {
            resourceType: 'VerificationResult',
            status: 'attested',
            target: [
              {
                reference: 'Credential/' + token,
              },
            ],
            attestedDateTime: new Date().toISOString(),
            verifier: {
              who: {
                reference: 'Organization/vitalcv',
              },
            },
            failureAction: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/failure-action',
                  code: 'fatal',
                },
              ],
            },
          },
        },
      ],
    });
  } catch (error: any) {
    console.error('FHIR verification result error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          details: { text: error.message },
        },
      ],
    });
  }
});


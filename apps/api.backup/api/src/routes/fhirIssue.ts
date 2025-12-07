/**
 * FHIR $issue endpoint - SMART-FHIR 2.0 IG + OIDC4VCI
 * Emits VC 2.0 payloads (JOSE/COSE) per HL7 SMART 2.0 IG
 */

import { Router, Request, Response } from 'express';
import { signVc } from '../services/crypto-signer';
import { mapFhirToVC } from '../services/fhir-map';

export const fhirIssue = Router();

fhirIssue.post('/fhir/$issue', async (req: Request, res: Response) => {
  try {
    const { bundle, type } = req.body;

    if (!bundle || bundle.resourceType !== 'Bundle') {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            details: { text: 'Invalid FHIR Bundle' },
          },
        ],
      });
    }

    // Map FHIR Bundle to VC 2.0
    const vc = await mapFhirToVC(bundle, type);

    // Sign the VC
    const signed = await signVc(vc);

    res.json({
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'credential',
          valueVerifiableCredential: signed,
        },
      ],
    });
  } catch (error: any) {
    console.error('FHIR $issue error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          details: { text: error.message || 'Internal server error' },
        },
      ],
    });
  }
});


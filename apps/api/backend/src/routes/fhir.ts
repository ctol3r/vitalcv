import type { Express, Request, Response } from 'express';
import { fhirAuthGuard } from '../middleware/fhirAuth';
import { mapClinicianToFhir } from '../services/fhir/mapper';

export function registerFhirRoutes(app: Express): void {
  app.get('/api/fhir/r4/Practitioner', fhirAuthGuard, (req: Request, res: Response) => {
    const identifier = req.query.identifier as string;

    if (!identifier) {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'required',
          diagnostics: 'Missing identifier parameter (e.g., ?identifier={npi})'
        }]
      });
      return;
    }

    // Mock clinician data
    const clinicianMock = {
      id: identifier,
      npi: identifier,
      name: 'Dr. Jane Smith',
      license: 'MD12345'
    };

    // Mock credentials
    const credentialsMock = [
      { type: 'StateLicense', status: 'valid' }
    ];

    const fhirBundle = mapClinicianToFhir(clinicianMock, credentialsMock);

    res.type('application/fhir+json');
    res.json(fhirBundle);
  });
}

/**
 * fhir.ts — Wave X-1: FHIR Bridge (Controlled)
 *
 * Exports a verified TrustPassport as a FHIR R4 Practitioner bundle.
 *
 * TRUTH CONTRACT:
 * - Only decision-grade claims are exported (non-stale, non-review-required)
 * - No enrichment data included
 * - No write-back to external systems — export-only
 * - Every exported field is traceable to a passport receipt
 *
 * Routes:
 *   GET /api/fhir/r4/Practitioner?identifier={npi}
 *   GET /api/fhir/r4/Practitioner/:npi
 */

import type { Express, Request, Response } from 'express';
import { fhirAuthGuard } from '../middleware/fhirAuth';
import { passportToFhirBundle } from '../services/fhir/fhirExporter';
import { buildPassportByNpi } from '../services/entity/passportService';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

function sendFhirError(res: Response, status: number, code: string, diagnostics: string): void {
  res.status(status).type('application/fhir+json').json({
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'error', code, diagnostics }],
  });
}

async function serveFhirPractitioner(npi: string, res: Response): Promise<void> {
  if (!NPI_RE.test(npi)) {
    sendFhirError(res, 400, 'value', `Invalid NPI format: ${npi}. Must be 10 digits.`);
    return;
  }

  try {
    const passport = await buildPassportByNpi(npi);

    if (!passport) {
      sendFhirError(res, 404, 'not-found', `No passport found for NPI ${npi}. Run ingestion first.`);
      return;
    }

    const bundle = passportToFhirBundle(passport);

    log('info', 'fhir_export', {
      npi,
      readinessScore: passport.readiness?.score ?? 0,
      credentialCount: passport.authority.credentials.length,
    });

    res.type('application/fhir+json').json(bundle);
  } catch (err) {
    log('error', 'fhir_export_error', { npi, err: String(err) });
    sendFhirError(res, 500, 'exception', 'FHIR export failed. Check ingest pipeline status.');
  }
}

export function registerFhirRoutes(app: Express): void {
  // ── GET /api/fhir/r4/Practitioner?identifier={npi} ─────────────────────────
  // FHIR standard search by identifier (system|value or bare NPI)
  app.get('/api/fhir/r4/Practitioner', fhirAuthGuard, async (req: Request, res: Response) => {
    const identifier = req.query.identifier as string;
    if (!identifier) {
      sendFhirError(res, 400, 'required', 'Missing identifier parameter (e.g., ?identifier=1234567890 or ?identifier=http://hl7.org/fhir/sid/us-npi|1234567890)');
      return;
    }
    // Strip FHIR system prefix if present: "http://hl7.org/fhir/sid/us-npi|1234567890"
    const npi = identifier.includes('|') ? identifier.split('|').pop()! : identifier;
    await serveFhirPractitioner(npi.trim(), res);
  });

  // ── GET /api/fhir/r4/Practitioner/:npi ─────────────────────────────────────
  // Direct NPI lookup (non-standard but practical for direct use)
  app.get('/api/fhir/r4/Practitioner/:npi', fhirAuthGuard, async (req: Request, res: Response) => {
    await serveFhirPractitioner(req.params.npi, res);
  });

  // ── GET /api/fhir/r4/metadata ───────────────────────────────────────────────
  // FHIR Capability Statement (minimal — supports search by NPI identifier)
  app.get('/api/fhir/r4/metadata', (_req: Request, res: Response) => {
    res.type('application/fhir+json').json({
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      software: { name: 'VitalCV FHIR Bridge', version: '1.0' },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [{
        mode: 'server',
        resource: [{
          type: 'Practitioner',
          interaction: [{ code: 'read' }, { code: 'search-type' }],
          searchParam: [{
            name: 'identifier',
            type: 'token',
            documentation: 'NPI identifier (http://hl7.org/fhir/sid/us-npi|{npi})',
          }],
        }],
      }],
    });
  });
}

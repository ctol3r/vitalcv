/**
 * manifest.ts — GET /api/manifest/:npi
 *
 * Thin wrapper exposing the existing EmployerEvidencePacket as a
 * manifest URL. Zero new logic — we call buildPassportByNpi() and
 * then buildEmployerEvidencePacket() which already produces the full
 * manifest shape (readiness posture, coverage, claims, limitations,
 * freshness, verification paths, artifact + receipt references).
 *
 * Single-source rule: this route is the ONLY manifest endpoint.
 */

import type { Express, Request, Response } from 'express';
import { buildPassportByNpi } from '../services/entity/passportService';
import { buildEmployerEvidencePacket } from '../services/entity/employerPacket';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

export function registerManifestRoutes(app: Express): void {
  app.get('/api/manifest/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || !NPI_RE.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'npi must be a 10-digit string.',
      });
    }

    // employerId is optional on the URL — falls back to a generic
    // 'public-view' label when not supplied. Packet-building does not
    // branch on employerId identity, only records it in the manifest.
    const employerIdParam = req.query.employerId;
    const employerId =
      typeof employerIdParam === 'string' && employerIdParam.trim().length > 0
        ? employerIdParam.trim()
        : 'public-view';

    try {
      const passport = await buildPassportByNpi(npi);
      if (!passport) {
        return res.status(404).json({
          error: 'passport_not_found',
          error_description: 'No passport data available for the provided NPI.',
        });
      }

      const packet = buildEmployerEvidencePacket({
        passport,
        employerId,
      });

      log('info', 'manifest_served', {
        npi_prefix: npi.slice(0, 4) + '····',
        employerId,
      });
      return res.status(200).json(packet);
    } catch (error) {
      log('error', 'manifest_failed', {
        npi_prefix: npi.slice(0, 4) + '····',
        message: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({
        error: 'manifest_failed',
        error_description: 'Could not build manifest.',
      });
    }
  });
}

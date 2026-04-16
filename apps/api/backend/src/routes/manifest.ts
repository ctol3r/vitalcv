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
import { applyManifestFailureGuards } from '../services/entity/manifestValidation';
import { getVerificationReceiptsForNpi } from '../services/identity/identityIngestionPipeline';
import { manifestCache } from '../services/ttlCache';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;
const EMPLOYER_ID_RE = /[^a-zA-Z0-9._:@/-]+/g;

function sanitizeEmployerId(raw: unknown): string {
  if (typeof raw !== 'string') {
    return 'public-view';
  }

  const normalized = raw.trim().replace(EMPLOYER_ID_RE, '').slice(0, 128);
  return normalized.length > 0 ? normalized : 'public-view';
}

function manifestCacheKey(npi: string, employerId: string): string {
  return `${npi}:${employerId}`;
}

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
    const employerId = sanitizeEmployerId(req.query.employerId);
    const cacheKey = manifestCacheKey(npi, employerId);

    res.setHeader('Cache-Control', 'private, max-age=60');
    const cached = manifestCache.get(cacheKey);
    if (cached) {
      log('info', 'manifest_cache_hit', {
        npi_prefix: npi.slice(0, 4) + '····',
        employerId,
      });
      res.setHeader('X-VitalCV-Cache', 'HIT');
      return res.status(200).type('application/json').send(cached);
    }

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
      const receipts = await getVerificationReceiptsForNpi(npi).catch((error) => {
        log('warn', 'manifest_receipt_load_failed', {
          npi_prefix: npi.slice(0, 4) + '····',
          employerId,
          message: error instanceof Error ? error.message : 'unknown',
        });
        return [];
      });
      const hardenedPacket = applyManifestFailureGuards(packet, receipts);
      if (hardenedPacket.readinessPosture && hardenedPacket.readinessPosture !== 'stable') {
        log('warn', 'manifest_validation_degraded', {
          npi_prefix: npi.slice(0, 4) + '····',
          employerId,
          readinessPosture: hardenedPacket.readinessPosture,
          validationIssueCount:
            typeof hardenedPacket.limitations === 'object' && hardenedPacket.limitations !== null
              ? hardenedPacket.limitations.validationIssues?.length ?? 0
              : 0,
        });
      }
      const serializedPacket = JSON.stringify(JSON.parse(JSON.stringify(hardenedPacket)));
      manifestCache.set(cacheKey, serializedPacket);

      log('info', 'manifest_served', {
        npi_prefix: npi.slice(0, 4) + '····',
        employerId,
        cache: 'MISS',
        readinessPosture: hardenedPacket.readinessPosture,
      });
      res.setHeader('X-VitalCV-Cache', 'MISS');
      return res.status(200).type('application/json').send(serializedPacket);
    } catch (error) {
      log('error', 'manifest_failed', {
        npi_prefix: npi.slice(0, 4) + '····',
        employerId,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({
        error: 'manifest_failed',
        error_description: 'Could not build manifest.',
      });
    }
  });
}

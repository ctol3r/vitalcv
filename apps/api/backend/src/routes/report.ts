/**
 * report.ts — Credential Intelligence Report API
 *
 * Routes:
 *   POST /api/report              — Generate a full CIR for a given NPI
 *   GET  /api/report/:npi         — Generate a CIR via GET (no org requirements)
 *   GET  /api/report/:npi/summary — Compact summary: status + score + time-to-start + top 3 blockers
 *
 * SECURITY:
 * - All external input treated as unsafe (NPI validated, orgRequirements sanitized)
 * - requestingOrg is logged but never returned in response
 * - No write-back to trust data
 */

import type { Express, Request, Response } from 'express';
import {
  generateCredentialIntelligenceReport,
  type CredentialIntelligenceReport,
} from '../services/report/credentialIntelligenceReport';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

function sanitizeOrgRequirements(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter(r => typeof r === 'string')
    .map(r => (r as string).trim())
    .filter(r => r.length > 0 && r.length <= 256)
    .slice(0, 20); // max 20 requirements per request
}

function sanitizeString(raw: unknown, maxLen = 128): string | undefined {
  if (typeof raw !== 'string') return undefined;
  return raw.trim().slice(0, maxLen) || undefined;
}

export function registerReportRoutes(app: Express): void {

  // ── POST /api/report ────────────────────────────────────────────────────────
  //
  // Generate a full Credential Intelligence Report.
  //
  // Body:
  //   {
  //     "npi": "1003000126",
  //     "orgRequirements": ["State medical license", "DEA registration"],  // optional
  //     "requestingOrg": "Memorial Hospital"                                // optional, audit only
  //   }
  app.post('/api/report', async (req: Request, res: Response) => {
    const { npi, orgRequirements, requestingOrg } = req.body ?? {};

    if (!npi || !NPI_RE.test(String(npi))) {
      res.status(400).json({
        error: 'Invalid or missing NPI. Must be a 10-digit string.',
        example: { npi: '1003000126' },
      });
      return;
    }

    try {
      const report = await generateCredentialIntelligenceReport({
        npi: String(npi),
        orgRequirements: sanitizeOrgRequirements(orgRequirements),
        requestingOrg: sanitizeString(requestingOrg),
      });

      res.json(report);
    } catch (err) {
      log('error', 'report_route_error', { npi, err: String(err) });
      res.status(500).json({ error: 'Report generation failed. Check ingest pipeline status.', npi });
    }
  });

  // ── GET /api/report/:npi ────────────────────────────────────────────────────
  //
  // Convenience GET for no-body clients and direct browser access.
  app.get('/api/report/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!NPI_RE.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI', npi });
      return;
    }

    try {
      const report = await generateCredentialIntelligenceReport({ npi });
      res.json(report);
    } catch (err) {
      log('error', 'report_get_error', { npi, err: String(err) });
      res.status(500).json({ error: 'Report generation failed.', npi });
    }
  });

  // ── GET /api/report/:npi/summary ────────────────────────────────────────────
  //
  // Compact summary — designed for employer dashboards, list views, and pilot demos.
  // Returns only: identity, readiness, time-to-start, top 3 blockers, top 3 risk flags.
  // Suitable for < 5KB payloads that render in < 60 seconds.
  app.get('/api/report/:npi/summary', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!NPI_RE.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI', npi });
      return;
    }

    try {
      const full = await generateCredentialIntelligenceReport({ npi });

      const summary = {
        npi: full.npi,
        displayName: full.displayName,
        specialty: full.specialty,
        generatedAt: full.generatedAt,
        reportId: full.reportId,
        readinessStatus: full.readinessStatus,
        readinessScore: full.readinessScore,
        readinessLevel: full.readinessLevel,
        trustBand: full.trustPosture.band,
        trustBandLabel: full.trustPosture.bandLabel,
        trustScore: full.trustPosture.score,
        timeToStart: full.timeToStart,
        topBlockers: full.blockers.slice(0, 3).map(b => ({
          domain: b.domain,
          title: b.title,
          severity: b.severity,
          estimatedResolutionDays: b.estimatedResolutionDays,
          action: b.action,
        })),
        topRiskFlags: full.riskFlags.slice(0, 3).map(f => ({
          severity: f.severity,
          title: f.title,
          blocks: f.blocks,
        })),
        missingData: full.missingData.slice(0, 5),
        gatedData: full.gatedData,
        reportHash: full.reportHash,
        methodology: full.methodology,
      };

      res.json(summary);
    } catch (err) {
      log('error', 'report_summary_error', { npi, err: String(err) });
      res.status(500).json({ error: 'Report summary failed.', npi });
    }
  });
}

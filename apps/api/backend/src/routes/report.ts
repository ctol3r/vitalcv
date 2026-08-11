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
 * - The subject must be a clinician the CALLER is bound to (added below).
 *
 * WHY THESE ROUTES NOW REQUIRE A BOUND HOLDER
 * A report is a derived assessment of a named clinician — readiness, blockers,
 * risk flags, time-to-start — keyed on an NPI. NPIs are public identifiers
 * published by NPPES, so a subject taken from the URL is enumerable rather than
 * guessable. Input validation ("NPI validated") answers whether the parameter is
 * well-formed, never whether the caller may read that person's assessment; the
 * original header above listed only the former under "SECURITY:".
 *
 * The only thing standing in front of these handlers was the global tenant
 * guard, and that guard is a turnstile, not a scope: `TENANT_ORG_BINDING`
 * defaults to `off`, and middleware/organizationContext.ts documents its own
 * query/header sources as unauthenticated and "NOT an authorization decision"
 * even under `enforce`. So org context was a formality the caller supplied
 * about itself.
 *
 * These are the same helpers `/api/apply/shares/:npi` uses, deliberately —
 * copying the shape that is already correct rather than inventing a second one.
 *
 * PRODUCT QUESTION LEFT OPEN, ON PURPOSE
 * Holder-only is the fail-closed answer, not necessarily the final one. If an
 * employer is meant to read a candidate's report, that is a recipient-scoped
 * share decision and belongs with the share authorization model — not a route
 * that answers for any NPI. Nothing in the app calls these routes today, so
 * fail-closed costs no working surface.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import {
  generateCredentialIntelligenceReport,
  type CredentialIntelligenceReport,
} from '../services/report/credentialIntelligenceReport';
import { log } from '../obs/logger';
import { requireVerifiedClerkUserId, requireNpiAuthorization } from '../middleware/verifiedActor';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

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
  //     "npi": "1558395516",
  //     "orgRequirements": ["State medical license", "DEA registration"],  // optional
  //     "requestingOrg": "Memorial Hospital"                                // optional, audit only
  //   }
  app.post('/api/report', asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireVerifiedClerkUserId(req);
    const { npi, orgRequirements, requestingOrg } = req.body ?? {};

    if (!npi || !NPI_RE.test(String(npi))) {
      res.status(400).json({
        error: 'Invalid or missing NPI. Must be a 10-digit string.',
        example: { npi: '1558395516' },
      });
      return;
    }
    await requireNpiAuthorization(clerkUserId, String(npi), req);

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
  }));

  // ── GET /api/report/:npi ────────────────────────────────────────────────────
  //
  // Convenience GET for no-body clients and direct browser access.
  app.get('/api/report/:npi', asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireVerifiedClerkUserId(req);
    const { npi } = req.params;

    if (!NPI_RE.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI', npi });
      return;
    }
    await requireNpiAuthorization(clerkUserId, npi, req);

    try {
      const report = await generateCredentialIntelligenceReport({ npi });
      res.json(report);
    } catch (err) {
      log('error', 'report_get_error', { npi, err: String(err) });
      res.status(500).json({ error: 'Report generation failed.', npi });
    }
  }));

  // ── GET /api/report/:npi/summary ────────────────────────────────────────────
  //
  // Compact summary — designed for employer dashboards, list views, and pilot demos.
  // Returns only: identity, readiness, time-to-start, top 3 blockers, top 3 risk flags.
  // Suitable for < 5KB payloads that render in < 60 seconds.
  app.get('/api/report/:npi/summary', asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = requireVerifiedClerkUserId(req);
    const { npi } = req.params;

    if (!NPI_RE.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI', npi });
      return;
    }
    await requireNpiAuthorization(clerkUserId, npi, req);

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
  }));
}

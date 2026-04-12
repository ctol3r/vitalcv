/**
 * research.ts — Wave 12: Research Identity Layer
 *
 * API routes for the research identity dimension:
 *
 *   GET  /api/research/pubmed/:clinicianId     — fetch PubMed publications
 *   GET  /api/research/trials/:clinicianId      — fetch ClinicalTrials.gov trials
 *   GET  /api/research/orcid/auth               — get ORCID OAuth URL
 *   POST /api/research/orcid/link               — exchange code → link ORCID
 *   DELETE /api/research/orcid/:clinicianId      — unlink ORCID
 *   GET  /api/research/profile/:clinicianId      — full research profile + score
 *   PUT  /api/research/disclosure/:clinicianId   — update disclosure preferences
 *
 * Auth: x-clerk-user-id header required.
 * Audit: every mutating endpoint writes an AuditEvent before returning 2xx.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';
import { requireAuditBeforeResponse } from '../services/audit/auditService';
import { sha256ForPayload } from '../utils/deterministic';
import prisma from '../graphql/prisma_client';
import {
  fetchPubMedPublications,
  fetchClinicalTrials,
  getOrcidAuthUrl,
  linkOrcidAccount,
  unlinkOrcidAccount,
  fetchFullResearchProfile,
} from '../services/identity/researchOrchestrator';
import type { ResearchDisclosurePreferences } from '@vitalcv/domain-common';

// ── Helpers ────────────────────────────────────────────────────

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
}

function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

function requireParam(req: Request, key: string): string {
  const val = (req.params[key] ?? '').trim();
  if (!val) throw new HttpError(400, `Missing required parameter: ${key}`);
  return val;
}

function requireBodyField(body: Record<string, unknown>, key: string): string {
  const val = typeof body[key] === 'string' ? (body[key] as string).trim() : '';
  if (!val) throw new HttpError(400, `Missing required body field: ${key}`);
  return val;
}

// ── Route registration ────��───────────────────────────────────

export function registerResearchRoutes(app: Express): void {
  // ── PubMed publications ─────────────────────────────────────
  app.get(
    '/api/research/pubmed/:clinicianId',
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      const clinicianId = requireParam(req, 'clinicianId');
      const name = (req.query.name as string | undefined)?.trim() ?? '';
      const affiliation = (req.query.affiliation as string | undefined)?.trim() ?? '';
      const npi = (req.query.npi as string | undefined)?.trim() ?? '';

      if (!name) throw new HttpError(400, 'Query parameter "name" is required.');

      const result = await fetchPubMedPublications(clinicianId, npi, name, affiliation);
      res.status(200).json(result);
    }),
  );

  // ── ClinicalTrials.gov ──────────────────────────────────────
  app.get(
    '/api/research/trials/:clinicianId',
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      const clinicianId = requireParam(req, 'clinicianId');
      const name = (req.query.name as string | undefined)?.trim() ?? '';
      const npi = (req.query.npi as string | undefined)?.trim() ?? '';

      if (!name) throw new HttpError(400, 'Query parameter "name" is required.');

      const result = await fetchClinicalTrials(clinicianId, npi, name);
      res.status(200).json(result);
    }),
  );

  // ── ORCID OAuth URL ─────────────────────────────────────────
  app.get(
    '/api/research/orcid/auth',
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      const state = (req.query.state as string | undefined)?.trim() ?? '';
      if (!state) throw new HttpError(400, 'Query parameter "state" is required.');

      const url = getOrcidAuthUrl(state);
      res.status(200).json({ authUrl: url });
    }),
  );

  // ── ORCID link (exchange code) ──────────────────────────────
  app.post(
    '/api/research/orcid/link',
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const code = requireBodyField(body, 'code');
      const clinicianId = requireBodyField(body, 'clinicianId');

      const profile = await linkOrcidAccount(code, clinicianId);
      res.status(200).json(profile);
    }),
  );

  // ── ORCID unlink ──────────���─────────────────────────────────
  app.delete(
    '/api/research/orcid/:clinicianId',
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      const clinicianId = requireParam(req, 'clinicianId');
      const orcidId = (req.query.orcidId as string | undefined)?.trim() ?? '';
      if (!orcidId) throw new HttpError(400, 'Query parameter "orcidId" is required.');

      await unlinkOrcidAccount(clinicianId, orcidId);
      res.status(200).json({ success: true, clinicianId, orcidId });
    }),
  );

  // ── Full research profile + score ───────────────────────────
  app.get(
    '/api/research/profile/:clinicianId',
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      const clinicianId = requireParam(req, 'clinicianId');
      const name = (req.query.name as string | undefined)?.trim() ?? '';
      const affiliation = (req.query.affiliation as string | undefined)?.trim() ?? '';
      const npi = (req.query.npi as string | undefined)?.trim() ?? '';

      if (!name) throw new HttpError(400, 'Query parameter "name" is required.');

      const profile = await fetchFullResearchProfile(clinicianId, npi, name, affiliation, null);
      res.status(200).json(profile);
    }),
  );

  // ── Update disclosure preferences ───────────────────────────
  app.put(
    '/api/research/disclosure/:clinicianId',
    asyncHandler(async (req: Request, res: Response) => {
      requireClerkUserId(req);
      const clinicianId = requireParam(req, 'clinicianId');
      const body = (req.body ?? {}) as Record<string, unknown>;

      const preferences: ResearchDisclosurePreferences = Object.freeze({
        showPublications: body.showPublications === true,
        showTrials: body.showTrials === true,
        showOrcid: body.showOrcid === true,
        showResearchScore: body.showResearchScore === true,
      });

      await requireAuditBeforeResponse(prisma, {
        type: 'RESEARCH_DISCLOSURE_UPDATED',
        hash: sha256ForPayload({ clinicianId, ...preferences }),
        referenceId: clinicianId,
        clinicianId,
        metadata: { ...preferences },
      });

      res.status(200).json({ clinicianId, disclosure: preferences });
    }),
  );

  log('info', 'routes_registered', { component: 'research', routeCount: 7 });
}

/**
 * Wave 190 — Verifier Pipeline Routes.
 *
 * ⚠️  NOT WIRED. `registerVerifierPipelineRoutes` is intentionally not called
 * from app.ts. Do not re-register it without fixing the defects below first —
 * routes/__tests__/verifierPipelineNotWired.test.ts fails if you do.
 *
 * WHY IT WAS UNWIRED
 * Every route below was reachable in production with no authentication. The
 * global `requireTenantContextOrReadAccess` does run in front of them, but the
 * org context it demands comes from a caller-supplied `x-org-id` header or
 * `?organizationId=` query param (middleware/organizationContext.ts says so in
 * its own comment: "unauthenticated ... tracked as gap G1"). So the guard costs
 * an attacker exactly one header. Verified against production on fab96fc41:
 * a bare GET /api/verifier/candidates returns 401, and the same request with
 * `x-org-id: probe-org` returns 200.
 *
 * Nothing called any of this. The "Apply with VitalCV" embed it was built for
 * mounts an iframe at the *page* /widget/apply (packages/embed-sdk/src/index.ts),
 * which exists only under apps/web/app/_archive/wave119 and 404s in production.
 * The live apply flow is POST /api/opportunities/:id/apply, which is DB-backed
 * and unrelated. Restoring the embed is roadmap item H1
 * (docs/ops/vitalcv-enterprise-100-task-map.md).
 *
 * WHAT A RESTORE MUST FIX (all four, not just the first)
 *  1. POST /api/widget/apply takes npi, opportunityId and verifierOrgId straight
 *     from the request body — anyone could file an application attributed to any
 *     clinician, against any opportunity, for any org. The applicant's NPI must
 *     come from an authenticated holder identity, and the org from the
 *     opportunity record — never from the body.
 *  2. GET /api/verifier/candidates and /candidates/pool scope results by the
 *     `x-verifier-org-id` header, defaulting to 'DEMO_ORG'. That header is
 *     independent of the tenant guard's `x-org-id`, so even a legitimately
 *     authenticated member of org A can read org B's candidate queue by setting
 *     it. Org scope must be derived server-side from the caller's verified
 *     membership. This is the same header-trust weakness that
 *     middleware/orgRoleGuard.ts documents — do not repeat it. requireOrgRole is
 *     authorization only; it authenticates nobody and runs in SHADOW today.
 *  3. GET /api/holder/applications?npi= returns any clinician's full application
 *     history — which employers they applied to, and when — keyed on an NPI. NPIs
 *     are public identifiers published by NPPES, so this is enumerable, not
 *     merely guessable. It must be scoped to the authenticated holder.
 *  4. POST /api/verifier/offers/respond accepts or declines an offer given only
 *     its offerId, with no ownership check — a third party who learns an id can
 *     answer on the clinician's behalf. It must verify the offer belongs to the
 *     authenticated holder.
 *
 * The blast radius was limited because both stores are in-process Maps
 * (services/verifier/verifierPipelineService.ts) that die on every deploy and are
 * never read from the database. That bounded the damage; it did not make the
 * routes safe, and it stops being true the moment this is backed by Postgres.
 *
 * POST /api/widget/apply               — Apply with VitalCV (opportunity-specific)
 * GET  /api/verifier/candidates        — Candidate queue for verifier org
 * POST /api/verifier/offers/send       — Send instant offer
 * POST /api/verifier/offers/respond    — Holder accepts / declines offer
 * GET  /api/verifier/candidates/pool   — Prequalified instant-offer pool
 * GET  /api/holder/applications        — Holder's own application history
 */

import type { Express, Request, Response } from 'express';
import {
  applyToOpportunity,
  getCandidateQueue,
  getPrequalifiedPool,
  sendInstantOffer,
  respondToOffer,
  getApplicationsByNpi,
} from '../services/verifier/verifierPipelineService';

export function registerVerifierPipelineRoutes(app: Express): void {

  /**
   * POST /api/widget/apply
   * Body: { npi, opportunityId, verifierOrgId, matchScore?, matchBand?, instantOfferEligible? }
   */
  app.post('/api/widget/apply', (req: Request, res: Response) => {
    const { npi, opportunityId, verifierOrgId } = req.body ?? {};
    if (!npi || !opportunityId) {
      res.status(400).json({ error: 'npi and opportunityId required' });
      return;
    }
    const record = applyToOpportunity({
      npi,
      opportunityId,
      verifierOrgId: verifierOrgId ?? 'UNKNOWN_ORG',
      source: 'widget',
      matchScore: req.body.matchScore,
      matchBand: req.body.matchBand,
      instantOfferEligible: req.body.instantOfferEligible ?? false,
    });
    res.status(201).json({ application: record });
  });

  /**
   * GET /api/verifier/candidates?opportunityId=
   * Query: opportunityId (optional filter)
   * Header: x-verifier-org-id
   */
  app.get('/api/verifier/candidates', (req: Request, res: Response) => {
    const verifierOrgId = (req.headers['x-verifier-org-id'] as string) ?? 'DEMO_ORG';
    const opportunityId = req.query.opportunityId as string | undefined;
    const candidates = getCandidateQueue(verifierOrgId, opportunityId);
    res.json({ candidates, total: candidates.length });
  });

  /**
   * GET /api/verifier/candidates/pool
   * Returns only instant-offer eligible candidates.
   */
  app.get('/api/verifier/candidates/pool', (req: Request, res: Response) => {
    const verifierOrgId = (req.headers['x-verifier-org-id'] as string) ?? 'DEMO_ORG';
    const pool = getPrequalifiedPool(verifierOrgId);
    res.json({ pool, total: pool.length });
  });

  /**
   * POST /api/verifier/offers/send
   * Body: { npi, opportunityId, verifierOrgId?, message?, expiresInHours? }
   */
  app.post('/api/verifier/offers/send', (req: Request, res: Response) => {
    const { npi, opportunityId } = req.body ?? {};
    if (!npi || !opportunityId) {
      res.status(400).json({ error: 'npi and opportunityId required' });
      return;
    }
    const verifierOrgId = (req.headers['x-verifier-org-id'] as string)
      ?? req.body.verifierOrgId
      ?? 'DEMO_ORG';
    const offer = sendInstantOffer({
      npi,
      opportunityId,
      verifierOrgId,
      message: req.body.message,
      expiresInHours: req.body.expiresInHours,
    });
    res.status(201).json({ offer });
  });

  /**
   * POST /api/verifier/offers/respond
   * Body: { offerId, accept }
   */
  app.post('/api/verifier/offers/respond', (req: Request, res: Response) => {
    const { offerId, accept } = req.body ?? {};
    if (!offerId || accept === undefined) {
      res.status(400).json({ error: 'offerId and accept required' });
      return;
    }
    const offer = respondToOffer(offerId, Boolean(accept));
    if (!offer) { res.status(404).json({ error: 'Offer not found' }); return; }
    res.json({ offer });
  });

  /**
   * GET /api/holder/applications?npi=
   * Returns a holder's own application history.
   */
  app.get('/api/holder/applications', (req: Request, res: Response) => {
    const npi = req.query.npi as string;
    if (!npi) { res.status(400).json({ error: 'npi required' }); return; }
    const applications = getApplicationsByNpi(npi);
    res.json({ applications, total: applications.length });
  });
}

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
 * WHAT A RESTORE MUST FIX — 2 of 4 CLOSED (V2-03, 2026-08-10), 2 STILL OPEN.
 *
 * ⚠️  Closing two defects did NOT make this file safe to wire. Defects 1 and 2
 *     are untouched and each is independently sufficient to re-open the hole
 *     this module was unwired for. The NOT WIRED status above still stands.
 *
 *  1. ❌ STILL OPEN — POST /api/widget/apply takes npi, opportunityId and
 *     verifierOrgId straight from the request body — anyone could file an
 *     application attributed to any clinician, against any opportunity, for any
 *     org. The applicant's NPI must come from an authenticated holder identity,
 *     and the org from the opportunity record — never from the body.
 *  2. ❌ STILL OPEN — GET /api/verifier/candidates and /candidates/pool scope
 *     results by the `x-verifier-org-id` header, defaulting to 'DEMO_ORG'. That
 *     header is independent of the tenant guard's `x-org-id`, so even a
 *     legitimately authenticated member of org A can read org B's candidate
 *     queue by setting it. Org scope must be derived server-side from the
 *     caller's verified membership. This is the same header-trust weakness that
 *     middleware/orgRoleGuard.ts documents — do not repeat it. requireOrgRole is
 *     authorization only; it authenticates nobody and runs in SHADOW today.
 *  3. ✅ CLOSED (#948) — GET /api/holder/applications returned any clinician's
 *     full application history, keyed on a `?npi=` query parameter. The subject
 *     is now resolved from the verified Clerk session via
 *     `resolveAuthorizedNpis`; `?npi=` is compared and refused on mismatch, and
 *     can no longer select rows.
 *  4. ✅ CLOSED (#949) — POST /api/verifier/offers/respond accepted or declined
 *     an offer given only its offerId. It now requires a verified session whose
 *     ownership bindings include `offer.npi`, refuses anything not PENDING (409)
 *     and anything past `expiresAt` (410, and the offer transitions to EXPIRED).
 *     `offerId` is an identifier, never a bearer credential.
 *
 * Both fixes are proved by routes/__tests__/verifierPipelineAuthorization.test.ts,
 * which mounts these handlers on a throwaway Express app. That test exercising
 * them is NOT the same as this module being served — see the not-wired test.
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

import type { Express, NextFunction, Request, Response } from 'express';
import {
  applyToOpportunity,
  getCandidateQueue,
  getPrequalifiedPool,
  sendInstantOffer,
  respondToOffer,
  getApplicationsForNpis,
} from '../services/verifier/verifierPipelineService';
import { HttpError } from '../utils/httpError';
import { requireVerifiedClerkUserId, resolveAuthorizedNpis } from '../middleware/verifiedActor';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

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
   * POST /api/verifier/offers/respond — defect 4, closed (#949).
   * Body: { offerId, accept }
   *
   * The responder is the holder the offer was issued to, proven by a verified
   * Clerk session and an ownership binding — never by possession of `offerId`.
   *
   * ON 404 WHERE THE ISSUE SPECIFIED 403. #949 asks for "403 otherwise" when
   * `offer.npi` does not match the session. This returns 404 for both "no such
   * offer" and "not yours", deliberately, because a 403 is an existence oracle:
   * it tells anyone holding a guessed id that the offer is real and belongs to
   * someone else. That contradicts the boundary the same program states for
   * shares — a recipient must not learn that another recipient's record exists,
   * "including through counts/titles/errors". The stricter answer is a superset
   * of the issue's intent; flag it if you want the literal 403 back.
   */
  app.post(
    '/api/verifier/offers/respond',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const { offerId, accept } = req.body ?? {};
      if (!offerId || accept === undefined) {
        throw new HttpError(400, 'offerId and accept required');
      }

      const authorizedNpis = await resolveAuthorizedNpis(clerkUserId);
      const result = respondToOffer({ offerId, accept: Boolean(accept), authorizedNpis });

      if (result.ok) {
        res.json({ offer: result.offer });
        return;
      }
      switch (result.reason) {
        case 'not_found':
          throw new HttpError(404, 'Offer not found.');
        case 'expired':
          // 410 Gone: the offer existed and can no longer be answered. Distinct
          // from 409 so the surface can say which happened.
          throw new HttpError(410, 'This offer has expired.', 'OFFER_EXPIRED');
        case 'not_pending':
          throw new HttpError(
            409,
            `This offer was already ${result.offer.status.toLowerCase()}.`,
            'OFFER_NOT_PENDING',
          );
      }
    }),
  );

  /**
   * GET /api/holder/applications — defect 3, closed (#948).
   *
   * Returns the authenticated holder's own application history, and only that.
   * The subject is resolved server-side from the verified session; `?npi=` can
   * no longer select rows. It is accepted solely as an assertion about who the
   * caller believes they are, and a mismatch is refused rather than honoured —
   * so the parameter can never widen the result set, only fail to narrow it.
   *
   * This matters more than it looks: NPIs are public identifiers published by
   * NPPES, so the old handler was walkable straight from the registry, and each
   * record discloses which employers a clinician applied to and when.
   */
  app.get(
    '/api/holder/applications',
    asyncHandler(async (req: Request, res: Response) => {
      const clerkUserId = requireVerifiedClerkUserId(req);
      const authorizedNpis = await resolveAuthorizedNpis(clerkUserId);

      const requestedNpi = typeof req.query.npi === 'string' ? req.query.npi.trim() : undefined;
      if (requestedNpi) {
        // Compared, never used as a selector. 403 is safe here where it was not
        // for offers: the caller is authenticated and NPIs are public, so this
        // reveals nothing they could not read from NPPES.
        if (!authorizedNpis.includes(requestedNpi)) {
          throw new HttpError(403, 'This NPI is not linked to your account.', 'OWNERSHIP_REQUIRED');
        }
      }

      const scope = requestedNpi ? [requestedNpi] : authorizedNpis;
      const applications = getApplicationsForNpis(scope);
      res.json({ applications, total: applications.length });
    }),
  );
}

/**
 * Intake Routes — Wave 183: Resume, NPI, Links, and Work Auth Ingestion
 *
 * POST /api/profile/resume/upload
 * POST /api/profile/links
 * POST /api/profile/work-auth
 * POST /api/profile/npi/bootstrap
 * GET  /api/profile/completeness
 */

import type { Express, NextFunction, Request, Response } from 'express';
import {
  bootstrapNpiIntake,
  bootstrapStudentIntake,
  clearResume,
  getProfileCompleteness,
  getProfileSharing,
  getPublicCareerProfile,
  ingestLinks,
  ingestResumeUpload,
  ingestWorkAuth,
  updateProfileSharing,
  updateSelfAttested,
  type ClearableLinkField,
} from '../services/intake/intakeService';
import prisma from '../graphql/prisma_client';
import { ensureWorkspaceUser } from '../services/workspace/workspaceService';
import { identityStateForUser, requireIdentityTier } from '../services/identity/identityGate';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { HttpError } from '../utils/httpError';

const NPI_RE = /^\d{10}$/;

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function getHeader(req: Request, key: string): string {
  const val = req.headers[key];
  return (Array.isArray(val) ? val[0] : val)?.trim() ?? '';
}

function requireUserId(req: Request): string {
  const id = getHeader(req, 'x-clerk-user-id');
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

/**
 * Resolve the signed-in Clerk identity to the internal `User.id` UUID.
 *
 * `PersonProfile.userId` is a UUID column keyed to `User.id` (that is how the
 * workspace read side hydrates the wallet). Passing the raw Clerk id
 * (`user_…`) into these queries can never succeed — the query engine rejects
 * it before the row is touched. `ensureWorkspaceUser` creates the User row on
 * first touch when the proxy forwards `x-clerk-user-email` (the /get-ready
 * flow loads /api/me/workspaces first, which does the same), and fails with a
 * clean 404 when it cannot resolve one.
 *
 * Exported for sibling clinician-personal route families (Career Garden) so
 * they resolve identity through this one audited path instead of reading
 * identity headers themselves (keeps the header-trust ratchet flat).
 */
export async function requireInternalUserId(req: Request): Promise<string> {
  const clerkUserId = requireUserId(req);
  const email = getHeader(req, 'x-clerk-user-email') || undefined;
  const user = await ensureWorkspaceUser(clerkUserId, email);
  return user.id;
}

export function registerIntakeRoutes(app: Express): void {

  /**
   * POST /api/profile/resume/upload
   * Body: { fileName: string; fileUrl: string } to attach, or { clear: true }
   * to remove the current resume link.
   */
  app.post(
    '/api/profile/resume/upload',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const { fileName, fileUrl, clear } = req.body as {
        fileName?: string;
        fileUrl?: string;
        clear?: boolean;
      };

      if (clear === true) {
        const cleared = await clearResume(userId);
        res.json(cleared);
        return;
      }

      if (!fileName || !fileUrl) {
        throw new HttpError(400, 'fileName and fileUrl are required.');
      }

      const result = await ingestResumeUpload(userId, fileName, fileUrl);
      res.status(201).json(result);
    }),
  );

  /**
   * POST /api/profile/links
   * Body: { linkedinUrl?: string; portfolioUrl?: string; otherUrls?: string[];
   *         clear?: ('linkedinUrl'|'portfolioUrl')[] }
   * A field named in `clear` is taken back to empty (unless the same payload
   * also provides a new value for it).
   */
  app.post(
    '/api/profile/links',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const { linkedinUrl, portfolioUrl, otherUrls, clear } =
        req.body as {
          linkedinUrl?: string;
          portfolioUrl?: string;
          otherUrls?: string[];
          clear?: string[];
        };

      const CLEARABLE: ClearableLinkField[] = ['linkedinUrl', 'portfolioUrl'];
      const clearFields = Array.isArray(clear)
        ? CLEARABLE.filter((f) => clear.includes(f))
        : [];

      const result = await ingestLinks(userId, linkedinUrl, portfolioUrl, otherUrls ?? [], clearFields);
      res.json(result);
    }),
  );

  /**
   * POST /api/profile/work-auth
   * Body: { workAuthStatus: 'authorized' | 'visa_required' | 'other' } to set,
   * or { clear: true } to take work authorization back to unstated.
   */
  app.post(
    '/api/profile/work-auth',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const { workAuthStatus, clear } = req.body as { workAuthStatus?: string; clear?: boolean };

      if (clear === true) {
        const cleared = await ingestWorkAuth(userId, null);
        res.json(cleared);
        return;
      }

      const ALLOWED = ['authorized', 'visa_required', 'other'];
      if (!workAuthStatus || !ALLOWED.includes(workAuthStatus)) {
        throw new HttpError(400, `workAuthStatus must be one of: ${ALLOWED.join(', ')}`);
      }

      const result = await ingestWorkAuth(userId, workAuthStatus);
      res.json(result);
    }),
  );

  /**
   * POST /api/profile/self-attested
   * Body: { selfAttested: SelfAttestedProfile } — full-document replace of the
   * clinician's USER_ENTERED profile layer (contact, medical school,
   * subspecialty, work history, affiliations, career goals, research). Values
   * here are never source-verified.
   */
  app.post(
    '/api/profile/self-attested',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const body = req.body as { selfAttested?: unknown } | undefined;
      const input = body && typeof body === 'object' && 'selfAttested' in body
        ? body.selfAttested
        : body;
      const result = await updateSelfAttested(userId, input);
      res.json({ selfAttested: result });
    }),
  );

  /**
   * POST /api/profile/npi/bootstrap
   * Body: { npi: string }
   */
  app.post(
    '/api/profile/npi/bootstrap',
    asyncHandler(async (req, res) => {
      requireUserId(req); // 401 before any validation or row creation
      const { npi, profession, attested, attestationVersion } = req.body as {
        npi?: string;
        profession?: string;
        attested?: boolean;
        attestationVersion?: string;
      };

      if (!npi || !NPI_RE.test(npi)) {
        throw new HttpError(400, 'npi must be exactly 10 digits.');
      }

      const userId = await requireInternalUserId(req);
      const result = await bootstrapNpiIntake(userId, npi, {
        profession,
        attested,
        attestationVersion,
      });
      res.status(201).json(result);
    }),
  );

  /**
   * POST /api/profile/student/bootstrap
   * Student / no-NPI lane — starts a PREVIEW-ONLY profile (self-attested, no
   * NPI). Body: { attested?: boolean, attestationVersion?: string }.
   * Tenant-guard exempt via the `/api/profile/` skip-list (onboarding-time,
   * Clerk-user-scoped, no org yet — same rationale as NPI bootstrap).
   */
  app.post(
    '/api/profile/student/bootstrap',
    asyncHandler(async (req, res) => {
      requireUserId(req); // 401 before any row work
      const { attested, attestationVersion } = req.body as {
        attested?: boolean;
        attestationVersion?: string;
      };
      const userId = await requireInternalUserId(req);
      const result = await bootstrapStudentIntake(userId, { attested, attestationVersion });
      res.status(201).json(result);
    }),
  );

  /**
   * GET /api/profile/sharing — current career-profile visibility (default
   * private). Auth-scoped to the signed-in clinician.
   */
  app.get(
    '/api/profile/sharing',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      res.json(await getProfileSharing(userId));
    }),
  );

  /**
   * POST /api/profile/sharing  { careerProfile: 'public' | 'private' }
   * Publishes or unpublishes the clinician's public career-profile page.
   */
  app.post(
    '/api/profile/sharing',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const body = req.body as { careerProfile?: unknown } | undefined;
      // Publishing a page under a clinician's registry name is an
      // impersonation vector — it unlocks at work_email_confirmed. Going
      // private is always allowed.
      if (body?.careerProfile === 'public') {
        await requireIdentityTier(userId, 'work_email_confirmed');
      }
      res.json(await updateProfileSharing(userId, body?.careerProfile));
    }),
  );

  /**
   * GET /api/profile/identity — the derived clinician-identity tier and the
   * exact signals behind it (nothing here is a license verification).
   */
  app.get(
    '/api/profile/identity',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      res.json(await identityStateForUser(userId));
    }),
  );

  /**
   * GET /api/profile/notification-target — N1.
   *
   * The caller's OWN notification-relevant facts, so the web app can grant
   * contact consent for the right NPI without ever accepting an NPI from the
   * browser. Read-only, and deliberately returns no address: whether a
   * verified email exists is all a settings screen needs, and the sweep
   * reads the address itself server-side.
   */
  app.get(
    '/api/profile/notification-target',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const profile = await prisma.personProfile.findUnique({
        where: { userId },
        select: { npi: true, verifiedEmail: true },
      });
      const email = profile?.verifiedEmail?.trim() ?? '';
      res.json({
        npi: profile?.npi ?? null,
        hasVerifiedEmail: email.includes('@'),
        // Domain only. Enough for a settings screen to say "we'd write to
        // your @example.org address" without handing the address back out.
        verifiedEmailDomain: email.includes('@') ? email.split('@')[1] : null,
      });
    }),
  );

  /**
   * GET /api/profile/public/:npi — the clinician-published career profile.
   * Public read; 404 unless the holder has explicitly set sharing to public.
   */
  app.get(
    '/api/profile/public/:npi',
    publicApiRateLimit,
    asyncHandler(async (req, res) => {
      const npi = req.params.npi?.trim() ?? '';
      if (!NPI_RE.test(npi)) {
        throw new HttpError(404, 'Career profile not found.');
      }
      const profile = await getPublicCareerProfile(npi);
      if (!profile) {
        throw new HttpError(404, 'This career profile is not shared.');
      }
      res.json({ shared: true, profile });
    }),
  );

  /**
   * GET /api/profile/completeness
   * Returns current profile completeness score and dimension breakdown.
   */
  app.get(
    '/api/profile/completeness',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const result = await getProfileCompleteness(userId);
      res.json(result);
    }),
  );
}

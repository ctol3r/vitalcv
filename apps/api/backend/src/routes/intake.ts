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
  getProfileCompleteness,
  ingestLinks,
  ingestResumeUpload,
  ingestWorkAuth,
} from '../services/intake/intakeService';
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

export function registerIntakeRoutes(app: Express): void {

  /**
   * POST /api/profile/resume/upload
   * Body: { fileName: string; fileUrl: string }
   */
  app.post(
    '/api/profile/resume/upload',
    asyncHandler(async (req, res) => {
      const userId = requireUserId(req);
      const { fileName, fileUrl } = req.body as { fileName?: string; fileUrl?: string };

      if (!fileName || !fileUrl) {
        throw new HttpError(400, 'fileName and fileUrl are required.');
      }

      const result = await ingestResumeUpload(userId, fileName, fileUrl);
      res.status(201).json(result);
    }),
  );

  /**
   * POST /api/profile/links
   * Body: { linkedinUrl?: string; portfolioUrl?: string; otherUrls?: string[] }
   */
  app.post(
    '/api/profile/links',
    asyncHandler(async (req, res) => {
      const userId = requireUserId(req);
      const { linkedinUrl, portfolioUrl, otherUrls } =
        req.body as { linkedinUrl?: string; portfolioUrl?: string; otherUrls?: string[] };

      const result = await ingestLinks(userId, linkedinUrl, portfolioUrl, otherUrls ?? []);
      res.json(result);
    }),
  );

  /**
   * POST /api/profile/work-auth
   * Body: { workAuthStatus: 'authorized' | 'visa_required' | 'other' }
   */
  app.post(
    '/api/profile/work-auth',
    asyncHandler(async (req, res) => {
      const userId = requireUserId(req);
      const { workAuthStatus } = req.body as { workAuthStatus?: string };

      const ALLOWED = ['authorized', 'visa_required', 'other'];
      if (!workAuthStatus || !ALLOWED.includes(workAuthStatus)) {
        throw new HttpError(400, `workAuthStatus must be one of: ${ALLOWED.join(', ')}`);
      }

      const result = await ingestWorkAuth(userId, workAuthStatus);
      res.json(result);
    }),
  );

  /**
   * POST /api/profile/npi/bootstrap
   * Body: { npi: string }
   */
  app.post(
    '/api/profile/npi/bootstrap',
    asyncHandler(async (req, res) => {
      const userId = requireUserId(req);
      const { npi, profession, attested, attestationVersion } = req.body as {
        npi?: string;
        profession?: string;
        attested?: boolean;
        attestationVersion?: string;
      };

      if (!npi || !NPI_RE.test(npi)) {
        throw new HttpError(400, 'npi must be exactly 10 digits.');
      }

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
   * Student / no-NPI lane — starts a preview-only profile.
   * Body: { attested?: boolean, attestationVersion?: string }
   */
  app.post(
    '/api/profile/student/bootstrap',
    asyncHandler(async (req, res) => {
      const userId = requireUserId(req);
      const { attested, attestationVersion } = req.body as {
        attested?: boolean;
        attestationVersion?: string;
      };
      const result = await bootstrapStudentIntake(userId, { attested, attestationVersion });
      res.status(201).json(result);
    }),
  );

  /**
   * GET /api/profile/completeness
   * Returns current profile completeness score and dimension breakdown.
   */
  app.get(
    '/api/profile/completeness',
    asyncHandler(async (req, res) => {
      const userId = requireUserId(req);
      const result = await getProfileCompleteness(userId);
      res.json(result);
    }),
  );
}

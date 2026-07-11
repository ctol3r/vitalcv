/**
 * Identity-binding routes — the email-OTP possession factor.
 *
 *   POST /api/profile/identity/email-otp/issue    { email }
 *   POST /api/profile/identity/email-otp/verify    { email, code }
 *
 * Auth-scoped to the Clerk user (x-clerk-user-id, forwarded by the web proxy).
 * The verify success records a possession signal on the clinician's profile.
 */
import type { Express, NextFunction, Request, Response } from 'express';

import { HttpError } from '../utils/httpError';
import { issueEmailOtp, verifyEmailOtp } from '../services/identity/emailOtpService';
import { ensureWorkspaceUser } from '../services/workspace/workspaceService';

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
 * Resolve the signed-in Clerk identity to the internal `User.id` UUID (same
 * rationale as intake.ts): the verify success writes the possession signal to
 * `PersonProfile.userId`, a UUID column keyed to `User.id` — the raw Clerk id
 * can never match it. EmailOtp challenge rows are keyed by the same internal
 * id so issue and verify stay in one id-space.
 */
async function requireInternalUserId(req: Request): Promise<string> {
  const clerkUserId = requireUserId(req);
  const email = getHeader(req, 'x-clerk-user-email') || undefined;
  const user = await ensureWorkspaceUser(clerkUserId, email);
  return user.id;
}

const VERIFY_FAILURES: Record<string, [number, string]> = {
  no_challenge: [400, 'No active code — request a new one.'],
  expired: [400, 'That code expired — request a new one.'],
  already_used: [400, 'That code was already used — request a new one.'],
  locked_out: [429, 'Too many attempts — request a new code.'],
  code_mismatch: [400, 'That code is incorrect.'],
};

export function registerEmailOtpRoutes(app: Express): void {
  app.post(
    '/api/profile/identity/email-otp/issue',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const { email } = req.body as { email?: string };
      if (!email || typeof email !== 'string') {
        throw new HttpError(400, 'email is required.');
      }

      const result = await issueEmailOtp(userId, email);
      if (result.outcome === 'invalid_email') {
        throw new HttpError(400, 'Enter a valid email address.');
      }
      if (result.outcome === 'rate_limited') {
        throw new HttpError(429, 'Too many codes requested. Try again later.');
      }
      if (result.outcome === 'delivery_unavailable') {
        throw new HttpError(
          503,
          'Email delivery is not configured on this environment yet, so a code cannot be sent. This optional step can be skipped for now.',
        );
      }
      // Never echo the code; delivery is out of band.
      res.status(200).json({ sent: true });
    }),
  );

  app.post(
    '/api/profile/identity/email-otp/verify',
    asyncHandler(async (req, res) => {
      const userId = await requireInternalUserId(req);
      const { email, code } = req.body as { email?: string; code?: string };
      if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
        throw new HttpError(400, 'email and code are required.');
      }

      const { outcome } = await verifyEmailOtp(userId, email, code);
      if (outcome === 'verified') {
        res.status(200).json({ verified: true });
        return;
      }
      const [status, message] = VERIFY_FAILURES[outcome] ?? [400, 'Verification failed.'];
      res.status(status).json({ verified: false, reason: message });
    }),
  );
}

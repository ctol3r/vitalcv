import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { haipConfig } from '@vitalcv/haip-config';
import { consumeNonce } from './security/nonceTable';
import { verifyAccessTokenStrict } from './services/tokenService';

const EXPECTED_AUDIENCE = haipConfig.tokenAudience;

function readAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const match = authHeader.match(/^(Bearer|DPoP)\s+(.+)$/i);
  return match?.[2]?.trim() || null;
}

function fail(res: Response, status: number, error: string, error_description: string): Response {
  return res.status(status).json({ error, error_description });
}

export function enforceTokenPolicy(req: Request, res: Response, next: NextFunction): void {
  const dpopHeader = req.headers.dpop;
  if (!dpopHeader || typeof dpopHeader !== 'string') {
    fail(
      res,
      401,
      'dpop_required',
      'DPoP proof is required for token endpoint requests.',
    );
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const grantType = typeof body.grant_type === 'string' ? body.grant_type : '';

  if (grantType !== 'refresh_token') {
    const requestUri = typeof body.request_uri === 'string' ? body.request_uri.trim() : '';
    if (!requestUri) {
      fail(
        res,
        400,
        'par_required',
        'PAR is required. Provide request_uri from the PAR endpoint.',
      );
      return;
    }
  }

  const challengeMethod =
    typeof body.code_challenge_method === 'string' ? body.code_challenge_method.trim() : '';

  if (challengeMethod && challengeMethod !== 'S256') {
    fail(
      res,
      400,
      'invalid_request',
      "PKCE code_challenge_method must be 'S256'.",
    );
    return;
  }

  const hasPkceInputs =
    typeof body.code_challenge === 'string' ||
    typeof body.code_verifier === 'string' ||
    challengeMethod.length > 0;

  if (grantType === 'authorization_code' || hasPkceInputs) {
    if (challengeMethod !== 'S256') {
      fail(
        res,
        400,
        'invalid_request',
        "PKCE code_challenge_method must be provided as 'S256'.",
      );
      return;
    }

    const codeVerifier = typeof body.code_verifier === 'string' ? body.code_verifier.trim() : '';
    if (!codeVerifier) {
      fail(
        res,
        400,
        'invalid_request',
        'PKCE code_verifier is required.',
      );
      return;
    }

    // PKCE S256 hash verification: BASE64URL(SHA256(code_verifier)) must match code_challenge
    const codeChallenge = typeof body.code_challenge === 'string' ? body.code_challenge.trim() : '';
    if (codeChallenge) {
      const computed = createHash('sha256').update(codeVerifier).digest('base64url');
      if (computed !== codeChallenge) {
        fail(res, 400, 'invalid_grant', 'PKCE code_verifier does not match code_challenge.');
        return;
      }
    }
  }

  next();
}

export async function enforceCredentialPolicy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const dpopHeader = req.headers.dpop;
  if (!dpopHeader || typeof dpopHeader !== 'string') {
    fail(
      res,
      401,
      'dpop_required',
      'DPoP proof is required for credential endpoint requests.',
    );
    return;
  }

  const token = readAccessToken(req);
  if (!token) {
    fail(res, 401, 'missing_token', 'Access token is required.');
    return;
  }

  try {
    const payload = await verifyAccessTokenStrict(token, {
      audience: EXPECTED_AUDIENCE,
      maxClockSkewSeconds: haipConfig.dpop.maxClockSkewSeconds,
    });
    (req as Request & { accessTokenPayload?: unknown }).accessTokenPayload = payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_access_token';
    fail(res, 401, 'invalid_token', message);
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const nonceHeader =
    typeof req.headers['x-c-nonce'] === 'string' ? req.headers['x-c-nonce'].trim() : '';
  const nonceBody = typeof body.c_nonce === 'string' ? body.c_nonce.trim() : '';
  const nonce = nonceBody || nonceHeader;

  if (!nonce) {
    fail(res, 400, 'invalid_nonce', 'c_nonce is required and must be single-use.');
    return;
  }

  const nonceResult = consumeNonce(nonce);
  if (nonceResult === 'accepted') {
    next();
    return;
  }

  if (nonceResult === 'missing' || nonceResult === 'expired') {
    fail(res, 401, 'invalid_nonce', 'c_nonce is invalid or expired.');
    return;
  }

  fail(res, 401, 'invalid_nonce', 'c_nonce replay detected.');
}

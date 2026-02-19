import { NextFunction, Request, Response } from 'express';
import {
  calculateJwkThumbprint,
  decodeJwt,
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
} from 'jose';
import { haipConfig } from '@vitalcv/haip-config';
import { isReplayJti } from './security/dpopReplayTable';

const EXPECTED_AUDIENCE = haipConfig.tokenAudience;
const MAX_CLOCK_SKEW_SECONDS = haipConfig.dpop.maxClockSkewSeconds;

function parseAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const match = authHeader.match(/^(Bearer|DPoP)\s+(.+)$/i);
  return match?.[2]?.trim() || null;
}

function badRequest(res: Response, status: number, error: string, error_description: string): Response {
  return res.status(status).json({ error, error_description });
}

function validateAccessToken(token: string): { cnfJkt?: string } {
  const protectedHeader = decodeProtectedHeader(token);
  if (protectedHeader.alg !== 'ES256') {
    throw new Error('Access token must use ES256.');
  }

  const payload = decodeJwt(token) as {
    aud?: string | string[];
    iat?: number;
    cnf?: { jkt?: string };
  };

  if (Array.isArray(payload.aud) || payload.aud !== EXPECTED_AUDIENCE) {
    throw new Error('Access token aud must match expected audience exactly.');
  }

  if (!payload.iat) {
    throw new Error('Access token iat is required.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(payload.iat - now) > MAX_CLOCK_SKEW_SECONDS) {
    throw new Error('Access token iat is outside 60-second clock skew tolerance.');
  }

  return { cnfJkt: payload.cnf?.jkt };
}

async function validateDpopProof(req: Request, expectedCnfJkt?: string): Promise<void> {
  const dpopHeaderRaw = req.headers.dpop;
  if (!dpopHeaderRaw || typeof dpopHeaderRaw !== 'string') {
    throw new Error('DPoP proof is required.');
  }

  const parts = dpopHeaderRaw.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid DPoP proof format.');
  }

  const protectedHeader = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const jwk = protectedHeader?.jwk;
  const alg = protectedHeader?.alg;
  const typ = protectedHeader?.typ;
  const kid = protectedHeader?.kid;

  if (!(haipConfig.dpop.allowedAlgorithms as readonly string[]).includes(alg)) {
    throw new Error(`DPoP proof must use ${haipConfig.dpop.allowedAlgorithms.join(', ')}.`);
  }

  if (typ !== 'dpop+jwt') {
    throw new Error("DPoP typ must be 'dpop+jwt'.");
  }

  if (!kid) {
    throw new Error('DPoP kid is required.');
  }

  if (!jwk) {
    throw new Error('DPoP JWK is required.');
  }

  const htuPath = req.originalUrl.split('?')[0];
  const expectedHtu = `${req.protocol}://${req.get('host')}${htuPath}`;
  const expectedHtm = req.method.toUpperCase();

  const publicKey = await importJWK(jwk, 'ES256');
  const verified = await jwtVerify(dpopHeaderRaw, publicKey, { algorithms: ['ES256'] });
  const payload = verified.payload as {
    htu?: string;
    htm?: string;
    iat?: number;
    jti?: string;
  };

  if (payload.htu !== expectedHtu) {
    throw new Error('DPoP htu mismatch.');
  }

  if ((payload.htm || '').toUpperCase() !== expectedHtm) {
    throw new Error('DPoP htm mismatch.');
  }

  if (!payload.iat) {
    throw new Error('DPoP iat is required.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(payload.iat - now) > MAX_CLOCK_SKEW_SECONDS) {
    throw new Error('DPoP iat is outside 60-second clock skew tolerance.');
  }

  // SPECIFICATION §2: exp ≤ 5 minutes from iat
  const exp = (verified.payload as { exp?: number }).exp;
  if (exp && payload.iat && exp - payload.iat > haipConfig.dpop.maxProofLifetimeSeconds) {
    throw new Error(`DPoP exp exceeds max proof lifetime (${haipConfig.dpop.maxProofLifetimeSeconds}s).`);
  }

  if (!payload.jti) {
    throw new Error('DPoP jti is required.');
  }

  if (await isReplayJti(payload.jti)) {
    throw new Error('DPoP jti replay detected.');
  }

  if (expectedCnfJkt) {
    const thumbprint = await calculateJwkThumbprint(jwk);
    if (thumbprint !== expectedCnfJkt) {
      throw new Error('DPoP key thumbprint does not match token cnf.jkt.');
    }
  }
}

export async function policyEnforcer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = parseAccessToken(req);
    if (!token) {
      badRequest(res, 401, 'missing_token', 'Access token is required.');
      return;
    }

    const { cnfJkt } = validateAccessToken(token);
    await validateDpopProof(req, cnfJkt);
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verifier policy enforcement failed.';
    const isDpop = message.includes('DPoP');
    badRequest(
      res,
      401,
      isDpop ? 'invalid_dpop' : 'invalid_token',
      message,
    );
  }
}

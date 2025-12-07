/**
 * Simplified DPoP guard for widget endpoints
 * Full implementation exists in issuer-api
 */

import { Request, Response, NextFunction } from 'express';
import { calculateJwkThumbprint, decodeJwt, jwtVerify, importJWK } from 'jose';

// JTI replay cache
const jtiCache = new Map<string, { timestamp: number }>();
const JTI_CACHE_TTL_MS = 60000;

function checkAndStoreJti(jti: string): boolean {
  if (!jti) return false;
  if (jtiCache.has(jti)) return true;
  jtiCache.set(jti, { timestamp: Date.now() });

  const now = Date.now();
  for (const [cachedJti, data] of jtiCache.entries()) {
    if (now - data.timestamp > JTI_CACHE_TTL_MS) {
      jtiCache.delete(cachedJti);
    }
  }

  return false;
}

async function verifyDPoPProof(
  dpopHeader: string,
  htu: string,
  htm: string
): Promise<{ valid: boolean; thumbprint?: string; error?: string }> {
  try {
    const parts = dpopHeader.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid DPoP proof format' };
    }

    const headerObj = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const jwk = headerObj.jwk;
    const alg = headerObj.alg;
    const typ = headerObj.typ;

    if (!jwk || !alg) {
      return { valid: false, error: 'Missing JWK or alg in DPoP proof header' };
    }

    if (typ !== 'dpop+jwt') {
      return { valid: false, error: `invalid_typ: expected 'dpop+jwt', got '${typ || 'missing'}'` };
    }

    const ALLOWED_ALGORITHMS = ['ES256', 'EdDSA'];
    if (!ALLOWED_ALGORITHMS.includes(alg)) {
      return { valid: false, error: `invalid_alg: algorithm '${alg}' not allowed` };
    }

    const publicKey = await importJWK(jwk, alg);
    const verified = await jwtVerify(dpopHeader, publicKey, {
      algorithms: ALLOWED_ALGORITHMS,
    });

    const payload = verified.payload;

    if (payload.htu !== htu) {
      return { valid: false, error: `htu mismatch: expected ${htu}, got ${payload.htu}` };
    }

    if (payload.htm?.toUpperCase() !== htm.toUpperCase()) {
      return { valid: false, error: `htm mismatch` };
    }

    const now = Math.floor(Date.now() / 1000);
    if (!payload.iat || Math.abs(payload.iat - now) > 60) {
      return { valid: false, error: `iat too old or missing` };
    }

    if (!payload.jti) {
      return { valid: false, error: 'Missing jti in DPoP proof' };
    }

    if (checkAndStoreJti(payload.jti)) {
      return { valid: false, error: `jti reused (replay attack detected)` };
    }

    const thumbprint = await calculateJwkThumbprint(jwk);
    return { valid: true, thumbprint };
  } catch (error) {
    return { valid: false, error: `DPoP proof validation error: ${error instanceof Error ? error.message : 'unknown'}` };
  }
}

export function dpopGuard(req: Request, res: Response, next: NextFunction) {
  const dpopHeader = req.headers['dpop'] as string;

  if (!dpopHeader) {
    return res.status(401).json({
      error: 'use_dpop',
      error_description: 'DPoP proof is required',
    });
  }

  const htu = `${req.protocol}://${req.get('host')}${req.path}`;
  const htm = req.method;

  verifyDPoPProof(dpopHeader, htu, htm).then(result => {
    if (!result.valid) {
      return res.status(401).json({
        error: 'invalid_dpop',
        error_description: result.error || 'DPoP proof validation failed'
      });
    }

    (req as any).dpop = { jkt: result.thumbprint };
    next();
  }).catch((error) => {
    res.status(401).json({
      error: 'dpop_verification_failed',
      error_description: error instanceof Error ? error.message : 'DPoP verification failed'
    });
  });
}


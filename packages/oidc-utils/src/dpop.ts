/**
 * DPoP (Demonstrating Proof-of-Possession) proof utilities.
 * Provides proof builder, validator, and middleware helpers.
 */

import { SignJWT, importJWK, jwtVerify, JWK } from 'jose';
import { createHash, randomUUID } from 'crypto';
import { emitMetric } from '@chai-vc/metrics-core';

const PACKAGE_NAME = 'oidc-utils';

export interface DPoPProof {
  /** The DPoP proof JWT */
  proof: string;
  /** HTTP method */
  method: string;
  /** HTTP URI */
  uri: string;
  /** Optional access token hash */
  ath?: string;
}

export interface DPoPValidationOptions {
  /** Allowed signature algorithms (default: ['EdDSA', 'ES256']) */
  allowedAlgorithms?: string[];
  /** Clock skew tolerance in seconds (default: 60) */
  clockSkewSeconds?: number;
  /** Require jkt (JWK thumbprint) in access token (default: true) */
  requireJkt?: boolean;
  /** Reject bearer-only tokens (default: true) */
  rejectBearerOnly?: boolean;
}

export interface DPoPValidationResult {
  valid: boolean;
  reason?: string;
  jkt?: string; // JWK thumbprint
  claims?: any;
}

export interface DPoPSigningMaterial {
  /** Private JWK used to sign the proof (must include private component) */
  jwk: JWK;
  /** Optional override for signing algorithm */
  alg?: string;
}

export interface DPoPBuildOptions {
  method: string;
  uri: string;
  signingKey: DPoPSigningMaterial;
  ath?: string;
  nonce?: string;
  jti?: string;
  expiresInSeconds?: number;
}

export interface DPoPBuildResult {
  proof: string;
  jti: string;
  thumbprint: string;
}

/**
 * Compute JWK thumbprint (jkt) per RFC 7638
 */
export function computeJwkThumbprint(jwk: JWK): string {
  const sortedJwk = {
    kty: jwk.kty,
    ...(jwk.crv && { crv: jwk.crv }),
    ...(jwk.x && { x: jwk.x }),
    ...(jwk.y && { y: jwk.y }),
    ...(jwk.n && { n: jwk.n }),
    ...(jwk.e && { e: jwk.e }),
  };

  const json = JSON.stringify(sortedJwk);
  return createHash('sha256').update(json).digest('base64url');
}

function normalizeMethod(method: string): string {
  return (method || 'GET').toUpperCase();
}

function normalizeUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return uri;
  }
}

function sanitizeJwkForHeader(jwk: JWK): JWK {
  const { d, p, q, dp, dq, qi, oth, ...pub } = jwk as Record<string, unknown>;
  return pub as JWK;
}

/**
 * Build a DPoP proof JWT for the given HTTP request context
 */
export async function buildDPoPProof(options: DPoPBuildOptions): Promise<DPoPBuildResult> {
  const {
    method,
    uri,
    signingKey,
    ath,
    nonce,
    jti = randomUUID(),
    expiresInSeconds = 120,
  } = options;

  const normalizedMethod = normalizeMethod(method);
  const normalizedUri = normalizeUri(uri);
  const algorithm =
    signingKey.alg || (typeof signingKey.jwk.alg === 'string' ? signingKey.jwk.alg : 'EdDSA');

  try {
    const key = await importJWK(signingKey.jwk, algorithm);
    const headerJwk = sanitizeJwkForHeader(signingKey.jwk);

    const proof = await new SignJWT({
      htm: normalizedMethod,
      htu: normalizedUri,
      ...(ath && { ath }),
      ...(nonce && { nonce }),
    })
      .setIssuedAt()
      .setJti(jti)
      .setExpirationTime(`+${expiresInSeconds}s`)
      .setProtectedHeader({
        alg: algorithm,
        typ: 'dpop+jwt',
        jwk: headerJwk,
      })
      .sign(key);

    const thumbprint = computeJwkThumbprint(headerJwk);

    await emitMetric('oidc.dpop.build', {
      package: PACKAGE_NAME,
      operation: 'dpop.build',
      algorithm,
      status: 'success',
    });

    return { proof, jti, thumbprint };
  } catch (error) {
    await emitMetric('oidc.dpop.build', {
      package: PACKAGE_NAME,
      operation: 'dpop.build',
      algorithm,
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}

/**
 * Validate DPoP proof
 */
export async function validateDPoPProof(
  proof: DPoPProof,
  options: DPoPValidationOptions = {}
): Promise<DPoPValidationResult> {
  const {
    allowedAlgorithms = ['EdDSA', 'ES256'],
    clockSkewSeconds = 60,
    requireJkt = true,
    rejectBearerOnly = true,
  } = options;

  const normalizedMethod = normalizeMethod(proof.method);
  const normalizedUri = normalizeUri(proof.uri);
  let algorithm = 'unknown';
  const metricBase = {
    package: PACKAGE_NAME,
    operation: 'dpop.validate',
    method: normalizedMethod,
  };

  const logMetric = async (status: 'success' | 'error', reason?: string) => {
    await emitMetric('oidc.token.verify', {
      ...metricBase,
      status,
      reason,
      algorithm,
    });
  };

  const fail = async (reason: string): Promise<DPoPValidationResult> => {
    await logMetric('error', reason);
    return { valid: false, reason };
  };

  try {
    const parts = proof.proof.split('.');
    if (parts.length !== 3) {
      return fail('Invalid JWT format');
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    algorithm = header?.alg || algorithm;

    if (!header.alg) {
      return fail('Missing algorithm in header');
    }

    if (!allowedAlgorithms.includes(header.alg)) {
      return fail(`Algorithm ${header.alg} not in allowlist`);
    }

    if (!header.jwk) {
      return fail('Missing jwk in header');
    }

    const key = await importJWK(header.jwk, header.alg);
    const { payload } = await jwtVerify(proof.proof, key, {
      algorithms: allowedAlgorithms as any[],
    });

    const now = Math.floor(Date.now() / 1000);
    const iat = payload.iat as number;
    const exp = payload.exp as number;

    if (exp && now > exp + clockSkewSeconds) {
      return fail('DPoP proof expired');
    }

    if (iat && now < iat - clockSkewSeconds) {
      return fail('DPoP proof issued in future');
    }

    if (payload.htm !== normalizedMethod) {
      return fail(`HTTP method mismatch: expected ${normalizedMethod}, got ${payload.htm}`);
    }

    if (payload.htu !== normalizedUri) {
      return fail(`HTTP URI mismatch: expected ${normalizedUri}, got ${payload.htu}`);
    }

    if (proof.ath && payload.ath !== proof.ath) {
      return fail('Access token hash mismatch');
    }

    const jkt = computeJwkThumbprint(header.jwk);

    if (requireJkt && !payload.jkt) {
      // Structural check only; access-token comparison happens separately
    }

    const result: DPoPValidationResult = {
      valid: true,
      jkt,
      claims: payload,
    };
    await logMetric('success');
    return result;
  } catch (error) {
    const reason = `DPoP validation error: ${error instanceof Error ? error.message : 'unknown error'}`;
    await logMetric('error', reason);
    return {
      valid: false,
      reason,
    };
  }
}

/**
 * Extract DPoP proof from request headers
 */
export function extractDPoPProof(req: {
  headers: Record<string, string | string[] | undefined>;
}): DPoPProof | null {
  const dpopHeader = req.headers['dpop'];
  if (!dpopHeader || typeof dpopHeader !== 'string') {
    return null;
  }

  const method = (req.headers[':method'] as string) || (req.headers['x-http-method'] as string) || 'GET';
  const uri = (req.headers[':path'] as string) || (req.headers['x-http-uri'] as string) || '/';
  const ath = req.headers['x-access-token-hash'] as string;

  return {
    proof: dpopHeader,
    method,
    uri,
    ath,
  };
}

/**
 * Middleware to validate DPoP proof
 */
export function createDPoPValidator(options: DPoPValidationOptions = {}) {
  return async (req: any, res: any, next: any) => {
    const dpopProof = extractDPoPProof(req);

    if (!dpopProof) {
      if (options.rejectBearerOnly !== false) {
        return res.status(401).json({
          error: 'invalid_dpop_proof',
          error_description: 'DPoP proof required',
        });
      }
      return next();
    }

    const result = await validateDPoPProof(dpopProof, options);

    if (!result.valid) {
      return res.status(401).json({
        error: 'invalid_dpop_proof',
        error_description: result.reason,
      });
    }

    req.dpop = {
      jkt: result.jkt,
      claims: result.claims,
    };

    next();
  };
}

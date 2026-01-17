/**
 * S72-D1-A-008: Simple Credential Verification Endpoint
 *
 * Accepts a VC JWS and verifies its signature against known issuer keys.
 * Returns {valid: true/false, reason}.
 * No complex status or expiry logic yet - just signature verification.
 */

import { createReceipt, type TrustOutcome } from '@vitalcv/audit-receipts';
import express, { Request, Response, Router } from 'express';
import { createLocalJWKSet, decodeJwt, generateKeyPair, importJWK, JWK, jwtVerify } from 'jose';
import { getPublicJwksPayload, PublicJwkWithStatus } from '../services/signingKeyProvider';
import { resolveCredentialStatus } from '../services/statusListResolver';

const router: Router = express.Router();

const TRUSTED_ISSUERS = (process.env.TRUSTED_ISSUERS || 'did:web:issuer.vitalcv.com')
  .split(',')
  .map((issuer) => issuer.trim())
  .filter(Boolean);

const JWKS_REFRESH_INTERVAL_MS = Number(process.env.JWKS_REFRESH_INTERVAL_MS || 60_000);
const VERIFIER_DID = process.env.VERIFIER_DID || 'did:web:verifier.vitalcv.com';

let localIssuerJwks: ReturnType<typeof createLocalJWKSet> | null = null;
let cachedJwksVersion: string | null = null;
let lastJwksLoad = 0;

// Verifier signing key for audit receipts
let verifierSigningKey: any = null;

async function getVerifierSigningKey() {
  if (verifierSigningKey) {
    return verifierSigningKey;
  }

  if (process.env.VERIFIER_SIGNING_KEY_JWK) {
    const jwk = JSON.parse(process.env.VERIFIER_SIGNING_KEY_JWK);
    verifierSigningKey = await importJWK(jwk, 'EdDSA');
    return verifierSigningKey;
  }

  // Generate ephemeral key if not configured
  const { privateKey } = await generateKeyPair('EdDSA', { extractable: true });
  verifierSigningKey = privateKey;
  return verifierSigningKey;
}

function stripMetadata(key: PublicJwkWithStatus): JWK {
  const { status, createdAt, rotatedAt, ...rest } = key;
  return rest;
}

async function ensureIssuerJwks(force = false) {
  const now = Date.now();
  if (!force && localIssuerJwks && now - lastJwksLoad < JWKS_REFRESH_INTERVAL_MS) {
    return localIssuerJwks;
  }

  const payload = await getPublicJwksPayload();
  if (!payload.keys.length) {
    throw new Error('Issuer JWKS is empty');
  }

  if (!force && localIssuerJwks && cachedJwksVersion === payload.version) {
    lastJwksLoad = now;
    return localIssuerJwks;
  }

  const sanitized = {
    keys: payload.keys.map(stripMetadata),
  };

  localIssuerJwks = createLocalJWKSet(sanitized);
  cachedJwksVersion = payload.version;
  lastJwksLoad = now;
  return localIssuerJwks;
}

/**
 * POST /verify/credential
 *
 * Verifies a verifiable credential JWS signature
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        valid: false,
        reason: 'Missing or invalid credential parameter. Expected a JWS string.',
      });
    }

    // Decode to inspect issuer
    let decoded: any;
    try {
      decoded = decodeJwt(credential);
    } catch (decodeError) {
      return res.json({
        valid: false,
        reason: `Invalid JWT format: ${
          decodeError instanceof Error ? decodeError.message : 'unknown error'
        }`,
      });
    }

    const issuer = decoded.iss;
    if (!issuer) {
      return res.json({
        valid: false,
        reason: 'Credential missing issuer (iss) claim',
      });
    }

    // Attempt to verify signature
    try {
      // In production, fetch public key from issuer's JWKS endpoint
      // For now, we'll use a simple verification approach

      const refreshParam = req.query?.refresh;
      const refreshRequested =
        typeof refreshParam === 'string'
          ? ['1', 'true'].includes(refreshParam.toLowerCase())
          : Array.isArray(refreshParam)
          ? refreshParam.some((value) => ['1', 'true'].includes(String(value).toLowerCase()))
          : false;
      const isTrustedIssuer = TRUSTED_ISSUERS.includes(issuer);

      if (!isTrustedIssuer) {
        return res.json({
          valid: false,
          reason: `Issuer not trusted: ${issuer}`,
        });
      }

      const JWKS = await ensureIssuerJwks(refreshRequested);
      const verified = await jwtVerify(credential, JWKS, {
        issuer,
      });

      // Check credential status (revocation)
      const vc = verified.payload.vc as Record<string, unknown>;
      const statusResolution = await resolveCredentialStatus(vc);

      // Map status to TrustOutcome
      let trustOutcome: TrustOutcome;
      let valid = false;
      let reason = '';

      if (statusResolution.status === 'revoked') {
        trustOutcome = 'REVOKED';
        valid = false;
        reason = 'Credential has been revoked';
      } else if (statusResolution.status === 'uncheckable') {
        trustOutcome = 'UNCHECKABLE';
        valid = false;
        reason = `Credential status uncheckable: ${statusResolution.reason || 'unknown'}`;
      } else {
        trustOutcome = 'VALID';
        valid = true;
        reason = 'Signature verified and credential is active';
      }

      // Generate CREDENTIAL_VERIFIED audit receipt
      try {
        const signingKey = await getVerifierSigningKey();
        await createReceipt(
          'CREDENTIAL_VERIFIED',
          { type: 'verifier', id: VERIFIER_DID },
          {
            credential_id: (vc.id as string) || 'unknown',
            holder_did: decoded.sub,
            issuer_did: issuer,
          },
          trustOutcome,
          {
            status: statusResolution.status,
            status_reason: statusResolution.reason,
            status_index: statusResolution.index,
            status_list_id: statusResolution.listId,
          },
          signingKey,
        );
      } catch (error) {
        console.error('[AUDIT] Failed to generate CREDENTIAL_VERIFIED receipt:', error);
      }

      // Return verification result
      return res.json({
        valid,
        trust_outcome: trustOutcome,
        reason,
        issuer: issuer,
        subject: decoded.sub,
        issuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : undefined,
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined,
        status: statusResolution.status,
        status_details: statusResolution,
      });
    } catch (verifyError) {
      return res.json({
        valid: false,
        reason: `Signature verification failed: ${
          verifyError instanceof Error ? verifyError.message : 'unknown error'
        }`,
      });
    }
  } catch (error) {
    console.error('[VerifyCredential] Error:', error);
    return res.status(500).json({
      valid: false,
      reason: `Server error: ${error instanceof Error ? error.message : 'unknown error'}`,
    });
  }
});

/**
 * GET /verify/credential/health
 *
 * Health check for verification service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'credential-verifier',
    timestamp: new Date().toISOString(),
  });
});

export default router;

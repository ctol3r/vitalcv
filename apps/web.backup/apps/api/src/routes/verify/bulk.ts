import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import {
  calculateJwkThumbprint,
  createLocalJWKSet,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
} from 'jose';
import { randomUUID } from 'crypto';
import type { VerificationResult } from '../../services/oidc4vp/types';
import { validateSdJwtProof, validateJwtVcProof } from '../../services/verify/validator';
import { normalizeCredentialEntries } from './utils';
import { verificationStore } from '../../services/oidc4vp/verificationStore';
import { createAnchor } from '../../services/verify/anchor';

const router = Router();

const JWKS_URL =
  process.env.ISSUER_JWKS_URL ||
  `${process.env.PUBLIC_URL || 'http://localhost:4000'}/.well-known/jwks.json`;
const STATUSLIST_FALLBACK_URL =
  process.env.STATUS_LIST_URL || `${process.env.PUBLIC_URL || 'http://localhost:4000'}/status/1`;
const MAX_BULK = Number(process.env.VERIFIER_BULK_LIMIT || 50);

let jwksCache:
  | {
      verifier: ReturnType<typeof createLocalJWKSet>;
      keys: JWK[];
      fetchedAt: number;
    }
  | undefined;

router.post('/bulk', async (req: Request, res: Response) => {
  const payload = Array.isArray(req.body?.tokens) ? req.body.tokens : req.body;
  if (!Array.isArray(payload) || payload.length === 0) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'Provide an array of vp tokens or { tokens: [] }',
    });
  }

  if (payload.length > MAX_BULK) {
    return res.status(400).json({
      error: 'bulk_limit_exceeded',
      message: `Maximum of ${MAX_BULK} tokens per request`,
    });
  }

  const { verifier, keys } = await getJwks();

  const results = await Promise.all(
    payload.map(async (entry) => {
      try {
        const { vpToken, presentationSubmission } = normalizeBulkEntry(entry);
        if (!vpToken) {
          throw new Error('missing_vp_token');
        }
        return await verifyPresentationToken(vpToken, presentationSubmission, verifier, keys);
      } catch (error) {
        const tokenHint =
          typeof entry === 'string'
            ? entry
            : entry?.vp_token || entry?.vpToken;
        return buildErroredResult(error, tokenHint);
      }
    }),
  );

  return res.json({ results });
});

async function verifyPresentationToken(
  vpToken: string,
  presentationSubmission: any,
  verifier: ReturnType<typeof createLocalJWKSet>,
  keys: JWK[],
): Promise<VerificationResult> {
  const jwtVerification = await jwtVerify(vpToken, verifier, {
    audience: process.env.VERIFIER_AUDIENCE,
    clockTolerance: 5,
  });
  const { payload, protectedHeader } = jwtVerification;

  const issuerDid = extractIssuerDid(payload);
  const jwkForHeader = protectedHeader.kid
    ? keys.find((key) => key.kid === protectedHeader.kid)
    : undefined;

  if (protectedHeader.kid && !jwkForHeader) {
    throw new Error(`Key ${protectedHeader.kid} not found in JWKS`);
  }

  const keyThumbprint = jwkForHeader ? await calculateJwkThumbprint(jwkForHeader, 'sha256') : '';

  const normalizedCredentials = normalizeCredentialEntries(payload.vp);
  if (!normalizedCredentials.length) {
    throw new Error('vp_token missing verifiable credentials');
  }

  const proofResults = await Promise.all(
    normalizedCredentials.map((entry) =>
      entry.format === 'sd-jwt'
        ? validateSdJwtProof({
            token: entry.token,
            disclosures: entry.disclosures,
            revealGroups: entry.revealGroups,
            expectedNonce: payload.nonce as string | undefined,
            fallbackStatusListUrl: STATUSLIST_FALLBACK_URL,
          })
        : validateJwtVcProof({
            token: entry.token,
            expectedAudience: process.env.VERIFIER_AUDIENCE,
            expectedNonce: payload.nonce as string | undefined,
            fallbackStatusListUrl: STATUSLIST_FALLBACK_URL,
          }),
    ),
  );

  const primary = proofResults[0];
  const presentationId = payload.jti || randomUUID();
  const chain = createAnchor([
    presentationId,
    primary.issuer.did ?? issuerDid,
    vpToken.slice(0, 32),
  ]);
  const status = primary.status === 'revoked' ? 'revoked' : primary.valid ? 'valid' : 'invalid';

  const rawPayload = {
    ...payload,
    __proofs: proofResults,
  };

  const result: VerificationResult = {
    presentationId,
    status,
    valid: primary.valid,
    reason: primary.reason,
    reasonCode: primary.reasonCode,
    issuer: {
      did: primary.issuer.did ?? issuerDid,
      name: primary.issuer.name,
      thumbprint: keyThumbprint,
      jwksUri: JWKS_URL,
      kid: primary.issuer.kid ?? protectedHeader.kid,
      jwk: jwkForHeader,
    },
    credentialType: primary.credentialType,
    holder: primary.holder,
    timestamps: {
      verifiedAt: new Date().toISOString(),
      expiresAt: primary.timestamps.expiresAt,
    },
    disclosure: primary.disclosure,
    chain,
    revocation: primary.revocation,
    dpop: {
      bound: false,
      jkt: '',
      iat: Math.floor(Date.now() / 1000),
    },
    raw: {
      vpToken,
      payload: rawPayload,
    },
    presentationSubmission,
  };

  verificationStore.save(result);
  return result;
}

function normalizeBulkEntry(entry: any): { vpToken?: string; presentationSubmission?: any } {
  if (typeof entry === 'string') {
    return { vpToken: entry };
  }
  if (entry && typeof entry === 'object') {
    return {
      vpToken: entry.vp_token || entry.vpToken,
      presentationSubmission: entry.presentation_submission || entry.presentationSubmission,
    };
  }
  return { vpToken: undefined };
}

function buildErroredResult(error: unknown, vpToken?: string): VerificationResult {
  const message = error instanceof Error ? error.message : 'verification_failed';
  const presentationId = randomUUID();
  const chain = createAnchor([presentationId, 'did:error:vitalcv', (vpToken ?? message).slice(0, 16)], 'anchor');
  const revocation = {
    revoked: false,
    checkedAt: new Date().toISOString(),
  };

  return {
    presentationId,
    status: 'invalid',
    valid: false,
    reason: message,
    issuer: { did: 'did:error:vitalcv' },
    timestamps: { verifiedAt: new Date().toISOString() },
    disclosure: { fields: {} },
    chain,
    revocation,
    dpop: {
      bound: false,
      jkt: '',
      iat: Math.floor(Date.now() / 1000),
    },
    raw: {
      vpToken: vpToken ?? '',
      payload: {},
    },
  };
}

async function getJwks() {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 5 * 60 * 1000) {
    return jwksCache;
  }

  const response = await fetch(JWKS_URL);
  if (!response.ok) {
    throw new Error(`Unable to fetch JWKS (${response.status})`);
  }

  const json = (await response.json()) as { keys: JWK[] };
  if (!Array.isArray(json.keys) || json.keys.length === 0) {
    throw new Error('JWKS payload empty');
  }

  jwksCache = {
    verifier: createLocalJWKSet(json),
    keys: json.keys,
    fetchedAt: Date.now(),
  };

  return jwksCache;
}

function extractIssuerDid(payload: JWTPayload): string {
  return (payload.iss as string) || 'did:web:vitalcv.example';
}

export default router;



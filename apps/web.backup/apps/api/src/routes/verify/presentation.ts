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
import { createAnchor } from '../../services/verify/anchor';
import { verificationStore } from '../../services/oidc4vp/verificationStore';
import { normalizeCredentialEntries } from './utils';
import { isProofRequired } from '../../services/verification/settings';
import { assertKillSwitchAllows, KillSwitchError } from '../../services/security/kill-switch';
import { enforceVerificationRateLimit, RateLimitError } from '../../services/security/rate-limit';
import { dispatchProofBundle } from '../../services/proofs/dispatcher';
import type { ProofCredential, ChainProofPayload } from '../../services/proofs/graph';

const router = Router();

const JWKS_URL =
  process.env.ISSUER_JWKS_URL ||
  `${process.env.PUBLIC_URL || 'http://localhost:4000'}/.well-known/jwks.json`;
const STATUSLIST_FALLBACK_URL =
  process.env.STATUS_LIST_URL || `${process.env.PUBLIC_URL || 'http://localhost:4000'}/status/1`;
const CHAIN_NETWORK = process.env.VERIFIER_CHAIN_NETWORK || 'pilot-l2';
const DPOP_MAX_AGE_MS = Number(process.env.VERIFIER_DPOP_MAX_AGE_MS || 5 * 60 * 1000);

let jwksCache:
  | {
      verifier: ReturnType<typeof createLocalJWKSet>;
      keys: JWK[];
      fetchedAt: number;
    }
  | undefined;

router.post('/presentation', async (req: Request, res: Response) => {
  try {
    assertKillSwitchAllows('verification');

    const vpToken = req.body?.vp_token || req.body?.vpToken;
    const presentationSubmission =
      req.body?.presentation_submission || req.body?.presentationSubmission;
    const chainProofPayload = extractChainProof(req);

    if (!vpToken) {
      return res.status(400).json({ error: 'missing_vp_token' });
    }

    const dpopHeader = req.get('dpop') || req.get('DPoP');
    if (!dpopHeader) {
      return res.status(400).json({ error: 'missing_dpop', message: 'DPoP proof required' });
    }

    const requestUrl = buildAbsoluteUrl(req);
    const dpopValidation = await validateDpop(dpopHeader, req.method, requestUrl);

    if (isProofRequired()) {
      if (!chainProofPayload?.blockHash || chainProofPayload.merklePath.length === 0) {
        return res.status(412).json({
          error: 'chain_proof_required',
          message: 'Cryptographic chain proof is required for verification.',
        });
      }
    }

    const { verifier, keys } = await getJwks();
    const jwtVerification = await jwtVerify(vpToken, verifier, {
      audience: process.env.VERIFIER_AUDIENCE,
      clockTolerance: 5,
    }).catch((error) => {
      throw new Error(`presentation_signature_invalid: ${error.message}`);
    });

    const { payload, protectedHeader } = jwtVerification;
    if (payload.cnf?.jkt && payload?.cnf?.jkt !== dpopValidation.jkt) {
      return res.status(400).json({
        error: 'dpop_mismatch',
        message: 'DPoP proof does not match VP confirmation key',
      });
    }

    const issuerDid = extractIssuerDid(payload);
    const verifierId =
      req.body?.metadata?.verifierId ??
      req.get('x-verifier-id') ??
      req.get('x-api-client') ??
      req.get('x-forwarded-host') ??
      'verifier:anonymous';

    try {
      enforceVerificationRateLimit({ issuerDid, verifierId });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json({
          error: `${error.scope}_rate_limited`,
          message: `Too many ${error.scope} verification requests`,
          limit: error.limit,
          windowMs: error.windowMs,
        });
      }
      throw error;
    }

    const jwkForHeader = protectedHeader.kid
      ? keys.find((key) => key.kid === protectedHeader.kid)
      : undefined;

    if (protectedHeader.kid && !jwkForHeader) {
      return res.status(400).json({
        error: 'missing_kid',
        message: `Key ${protectedHeader.kid} not found in JWKS`,
      });
    }

    const keyThumbprint = jwkForHeader ? await calculateJwkThumbprint(jwkForHeader, 'sha256') : '';

    const normalizedCredentials = normalizeCredentialEntries(payload.vp);
    if (!normalizedCredentials.length) {
      return res.status(400).json({
        error: 'missing_credentials',
        message: 'vp_token does not contain verifiable credentials',
      });
    }

    const proofCredentials: ProofCredential[] = normalizedCredentials.map((entry) => ({
      format: entry.format,
      token: entry.token,
      disclosures: entry.disclosures,
      revealGroups: entry.revealGroups,
    }));

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
    const proofThreadId =
      typeof payload.nonce === 'string'
        ? payload.nonce
        : typeof payload.jti === 'string'
          ? String(payload.jti)
          : presentationId;
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

    const proofDispatch = await dispatchProofBundle({
      threadId: proofThreadId,
      presentationId,
      credentials: proofCredentials,
      chainProof: chainProofPayload ?? undefined,
      priority: req.body?.metadata?.priority === 'urgent' ? 'urgent' : 'standard',
      expectedNonce: payload.nonce as string | undefined,
      issuerDid: primary.issuer.did ?? issuerDid,
      source: req.body?.metadata?.source ?? 'portal-scan',
    });

    const result: VerificationResult = {
      presentationId,
      status,
      valid: primary.valid,
      reason: primary.reason,
      reasonCode: primary.reasonCode,
      issuer: {
        did: primary.issuer.did ?? issuerDid,
        name: primary.issuer.name || req.body?.metadata?.issuerName,
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
        bound: true,
        jkt: dpopValidation.jkt,
        iat: dpopValidation.iat,
        nonce: dpopValidation.nonce,
      },
      raw: {
        vpToken,
        payload: rawPayload,
      },
      presentationSubmission,
      proofThreadId: proofDispatch.threadId,
      proofStreamSummary: proofDispatch.summary,
    };

    verificationStore.save(result);

    return res.json(result);
  } catch (error) {
    if (error instanceof KillSwitchError) {
      return res.status(503).json({
        error: 'kill_switch_engaged',
        message: error.message,
        killSwitch: error.state,
      });
    }
    if (error instanceof RateLimitError) {
      return res.status(429).json({
        error: `${error.scope}_rate_limited`,
        message: `Too many ${error.scope} verification requests`,
        limit: error.limit,
        windowMs: error.windowMs,
      });
    }
    console.error('[verify:presentation] failed', error);
    const message = error instanceof Error ? error.message : 'verification_failed';
    const status = message.startsWith('presentation_signature_invalid') ? 400 : 500;
    return res.status(status).json({ error: 'verification_failed', message });
  }
});

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

async function validateDpop(token: string, method: string, url: string) {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, async (header) => {
      if (!header.jwk) {
        throw new Error('DPoP header missing jwk');
      }
      return importJWK(header.jwk as JWK, header.alg);
    });

    if (!payload.htm || payload.htm !== method) {
      throw new Error('DPoP method mismatch');
    }

    if (!payload.htu) {
      throw new Error('DPoP proof missing htu');
    }

    if (normalizeUrl(payload.htu as string) !== normalizeUrl(url)) {
      throw new Error('DPoP URL mismatch');
    }

    if (payload.iat) {
      const issued = Number(payload.iat) * 1000;
      if (Date.now() - issued > DPOP_MAX_AGE_MS) {
        throw new Error('DPoP proof expired');
      }
    }

    if (!protectedHeader.jwk) {
      throw new Error('DPoP jwk missing');
    }

    const jkt = await calculateJwkThumbprint(protectedHeader.jwk as JWK, 'sha256');

    return {
      jkt,
      iat: Number(payload.iat || 0),
      nonce: payload.nonce as string | undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DPoP verification failed';
    throw new Error(`dpop_invalid: ${message}`);
  }
}

function extractIssuerDid(payload: JWTPayload): string {
  return (payload.iss as string) || 'did:web:vitalcv.example';
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    if (parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildAbsoluteUrl(req: Request) {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}${req.originalUrl}`;
}

function extractChainProof(req: Request): ChainProofPayload | null {
  const proof = req.body?.chainProof || req.body?.metadata?.chainProof;
  if (!proof || typeof proof !== 'object') {
    return null;
  }
  const blockHash =
    typeof proof.blockHash === 'string' ? proof.blockHash : proof.txHash ?? proof.block_hash;
  const merklePath = Array.isArray(proof.merklePath ?? proof.path)
    ? (proof.merklePath ?? proof.path).map((node: unknown) => String(node))
    : [];

  if (!blockHash) {
    return null;
  }

  return {
    blockHash,
    merklePath,
  };
}

export default router;


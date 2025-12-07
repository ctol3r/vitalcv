import { Router, Request, Response } from 'express';
import { randomUUID, generateKeyPairSync } from 'crypto';
import { SignJWT, importJWK, exportJWK, type JWK, type KeyLike } from 'jose';
import { credentialOfferService, type CredentialTemplate } from '../../services/oidc4vci/offer';
import { verifyDpopProof } from '../../services/security/dpop';

const router = Router();

const CREDENTIAL_TTL_SECONDS = parsePositiveInt(process.env.OIDC4VCI_CREDENTIAL_TTL_SECONDS, 600);

router.post('/', async (req: Request, res: Response) => {
  const authorization = req.header('authorization') ?? req.header('Authorization');
  if (!authorization) {
    res.setHeader('WWW-Authenticate', 'DPoP realm="vitalcv"');
    return res.status(401).json({
      error: 'use_dpop',
      error_description: 'DPoP-bound access token required',
    });
  }

  if (!authorization.startsWith('DPoP ')) {
    return res.status(401).json({
      error: 'use_dpop',
      error_description: 'Authorization scheme must be DPoP',
    });
  }

  const accessToken = authorization.slice(5).trim();
  const dpopProof = req.header('dpop') ?? req.header('DPoP');

  if (!dpopProof) {
    return res.status(401).json({
      error: 'use_dpop',
      error_description: 'DPoP proof missing',
    });
  }

  let dpopResult;
  try {
    const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    dpopResult = await verifyDpopProof({
      proof: dpopProof,
      method: req.method,
      url: requestUrl,
      accessToken,
    });
  } catch (error) {
    const description = error instanceof Error ? error.message : 'DPoP verification failed';
    return res.status(401).json({
      error: 'invalid_dpop',
      error_description: description,
    });
  }

  let tokenRecord;
  try {
    tokenRecord = credentialOfferService.validateAccessToken(accessToken, { jkt: dpopResult.jkt });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_token';
    const description =
      code === 'expired_token'
        ? 'Access token expired'
        : code === 'dpop_jkt_mismatch'
          ? 'DPoP key thumbprint mismatch'
          : 'Access token invalid';
    return res.status(401).json({
      error: 'invalid_token',
      error_description: description,
    });
  }

  const body = req.body as CredentialEndpointRequest;
  const template = credentialOfferService.getTemplate(tokenRecord.credentialId);
  const issuerMetadata = credentialOfferService.getIssuerMetadata();
  const subjectId = coerceSubjectId(body.subject_id, tokenRecord.subjectDid ?? body.credential_subject?.id);

  if (!subjectId) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'subject_id is required to build credential',
    });
  }

  try {
    const credentialId = `urn:uuid:${randomUUID()}`;
    const claims = sanitizeClaims(body.claims ?? body.credential_subject);
    delete claims.id;

    const vcPayload = buildVerifiableCredential({
      template,
      issuer: issuerMetadata.credential_issuer,
      subjectId,
      credentialId,
      claims,
    });

    const signingMaterial = await getSigningMaterial();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const envelope = new SignJWT({
      ...vcPayload,
      iss: issuerMetadata.credential_issuer,
      sub: subjectId,
      jti: credentialId,
      nbf: nowSeconds,
      iat: nowSeconds,
      exp: nowSeconds + CREDENTIAL_TTL_SECONDS,
      cnf: tokenRecord.jkt ? { jkt: tokenRecord.jkt } : undefined,
      scope: tokenRecord.scope,
    })
      .setProtectedHeader({ alg: 'EdDSA', kid: signingMaterial.kid, typ: 'JWT' });

    const signedCredential = await envelope.sign(signingMaterial.key);
    const nonce = credentialOfferService.issueCredentialNonce({ token: tokenRecord.token });

    return res.json({
      format: template.format,
      credential: signedCredential,
      credential_id: credentialId,
      c_nonce: nonce.value,
      c_nonce_expires_in: nonce.expiresIn,
      issuer: issuerMetadata.credential_issuer,
    });
  } catch (error) {
    const description = error instanceof Error ? error.message : 'Credential issuance failed';
    console.error('[oidc4vci][credential] failed to issue credential', description);
    return res.status(500).json({
      error: 'issuance_failed',
      error_description: description,
    });
  }
});

export default router;

interface CredentialEndpointRequest {
  subject_id?: string;
  credential_subject?: {
    id?: string;
    [key: string]: unknown;
  };
  claims?: Record<string, unknown>;
}

interface SigningMaterial {
  key: KeyLike;
  kid: string;
  jwk: JWK;
}

let signingMaterialPromise: Promise<SigningMaterial> | null = null;

async function getSigningMaterial(): Promise<SigningMaterial> {
  if (!signingMaterialPromise) {
    signingMaterialPromise = loadSigningMaterial();
  }
  return signingMaterialPromise;
}

async function loadSigningMaterial(): Promise<SigningMaterial> {
  const issuer = credentialOfferService.getIssuerMetadata().credential_issuer;
  const configured = process.env.OIDC4VCI_SIGNING_JWK;
  if (configured) {
    const jwk = JSON.parse(configured) as JWK;
    const key = await importJWK(jwk, 'EdDSA');
    return {
      key,
      kid: jwk.kid ?? `${issuer}#oidc4vci`,
      jwk,
    };
  }

  console.warn('[oidc4vci][credential] OIDC4VCI_SIGNING_JWK not configured. Generating ephemeral Ed25519 key for local development.');
  const { privateKey } = generateKeyPairSync('ed25519');
  const jwk = await exportJWK(privateKey);
  return {
    key: privateKey,
    kid: jwk.kid ?? `${issuer}#oidc4vci`,
    jwk,
  };
}

function buildVerifiableCredential(params: {
  template: CredentialTemplate;
  issuer: string;
  subjectId: string;
  credentialId: string;
  claims: Record<string, unknown>;
}) {
  const issuanceDate = new Date().toISOString();
  const context = [
    'https://www.w3.org/2018/credentials/v1',
    'https://w3id.org/vc/status-list/2021/v1',
    'https://schema.org',
  ];

  return {
    vc: {
      '@context': context,
      type: Array.from(new Set(['VerifiableCredential', ...params.template.types])),
      issuer: params.issuer,
      issuanceDate,
      credentialSubject: {
        id: params.subjectId,
        ...params.claims,
        credentialId: params.credentialId,
      },
      credentialStatus: {
        id: `${params.issuer}/status/${params.template.id}`,
        type: 'StatusList2021Entry',
        statusPurpose: 'revocation',
        statusListCredential: `${params.issuer}/status/${params.template.id}`,
        statusListIndex: 0,
      },
      credentialSchema: params.template.schema,
    },
  };
}

function sanitizeClaims(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    return {};
  }
  return { ...input } as Record<string, unknown>;
}

function coerceSubjectId(primary?: string, fallback?: string): string | undefined {
  if (primary && typeof primary === 'string') {
    return primary;
  }
  if (fallback && typeof fallback === 'string') {
    return fallback;
  }
  return undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}



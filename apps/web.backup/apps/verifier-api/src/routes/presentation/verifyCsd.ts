import { createHash } from 'crypto';
import express from 'express';
import { importJWK, type JWK, type KeyLike } from 'jose';
import { CredentialSchemaRegistry, CsdJwtVerifier } from '@chai-vc/vc-formats-csdjwt';
import type { CsdPresentationDisclosure } from '@chai-vc/vc-formats-csdjwt';
import { validateVC, formatValidationResponse } from '../../services/vcValidator';
import { getPublicJwksPayload, type PublicJwkWithStatus } from '../../../../services/identity/signingKeyProvider';
import { validateDPoPProof } from '@packages/oidc-utils/src/dpop';

const router = express.Router();

const schemaRegistry = new CredentialSchemaRegistry();
const issuerKeyCache = new Map<string, Promise<KeyLike>>();

async function resolveIssuerKey(kid?: string, alg?: string): Promise<KeyLike> {
  if (!kid) {
    throw new Error('Missing kid in proof');
  }
  if (issuerKeyCache.has(kid)) {
    return issuerKeyCache.get(kid)!;
  }

  const cachePromise = (async () => {
    const payload = await getPublicJwksPayload();
    const match = payload.keys.find((key: PublicJwkWithStatus) => key.kid === kid);
    if (!match) {
      throw new Error(`Issuer key ${kid} not found`);
    }
    const { d, status, createdAt, rotatedAt, ...publicJwk } = match;
    return importJWK(publicJwk as JWK, alg ?? (publicJwk.alg as string) ?? 'EdDSA');
  })();

  issuerKeyCache.set(kid, cachePromise);
  return cachePromise;
}

const csdVerifier = new CsdJwtVerifier({
  schemaRegistry,
  keyResolver: async ({ kid, alg }) => resolveIssuerKey(kid, alg),
});

router.post('/verify', async (req, res) => {
  try {
    const {
      csdJwt,
      disclosures,
      revealGroups = [],
      nonce,
      nonceBinding,
      dpopProof,
    } = req.body ?? {};

    if (!csdJwt || typeof csdJwt !== 'string') {
      return res.status(400).json({ error: 'invalid_request', error_description: 'csdJwt is required' });
    }

    if (!Array.isArray(disclosures) || disclosures.length === 0) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'disclosures array is required',
      });
    }

    if (!nonce || typeof nonce !== 'string' || !nonceBinding) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'nonce and nonceBinding are required',
      });
    }

    if (!dpopProof || typeof dpopProof !== 'string') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'dpopProof is required',
      });
    }

    const uri = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const dpopResult = await validateDPoPProof(
      {
        proof: dpopProof,
        method: req.method,
        uri,
      },
      { allowedAlgorithms: ['EdDSA', 'ES256'], requireJkt: true },
    );

    if (!dpopResult.valid || !dpopResult.jkt) {
      return res.status(401).json({
        error: 'invalid_dpop_proof',
        error_description: dpopResult.reason || 'Unable to validate DPoP proof',
      });
    }

    const computedBinding = createHash('sha256').update(`${nonce}.${dpopResult.jkt}`).digest('base64url');
    if (computedBinding !== nonceBinding) {
      return res.status(401).json({
        error: 'invalid_nonce_binding',
        error_description: 'Nonce binding does not match DPoP proof thumbprint',
      });
    }

    const normalizedDisclosures: CsdPresentationDisclosure[] = disclosures.map((entry: any) => ({
      groupId: entry.groupId,
      path: entry.path,
      salt: entry.salt,
      value: entry.value,
    }));

    const verification = await csdVerifier.verify({
      csdJwt,
      disclosures: normalizedDisclosures,
      revealGroups,
    });

    if (!verification.valid) {
      return res.status(400).json({
        valid: false,
        error: verification.error,
        code: verification.code,
      });
    }

    const statusResult = await validateVC(JSON.stringify(verification.credential));

    return res.json({
      valid: true,
      issuer: verification.issuer,
      subject: verification.subject,
      schemaId: verification.schemaId,
      claims: verification.revealedClaims,
      groups: verification.groups,
      proof: verification.proof,
      status: formatValidationResponse(statusResult),
    });
  } catch (error) {
    console.error('[verifyCsd] Error validating presentation', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


